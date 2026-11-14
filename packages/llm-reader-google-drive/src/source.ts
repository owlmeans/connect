import type { ReaderSource, ReaderSourceContext, SourceEntry } from '@owlmeans/llm-reader'
import { logger } from '@owlmeans/log'
import {
  DEFAULT_GOOGLE_DRIVE_DEPTH, DEFAULT_GOOGLE_DRIVE_MAX_ENTRIES, DEFAULT_GOOGLE_DRIVE_MAX_FOLDERS, GOOGLE_DRIVE_SOURCE, GoogleDriveFailure,
  GoogleDriveKind,
} from './consts.js'
import { GoogleDriveError } from './errors.js'
import { DRIVE_PROBE_CONCURRENCY, DRIVE_SCAN_LIMIT_BYTES, LOG_SCOPE } from './source/consts.local.js'
import { makeApiLister } from './source/api.js'
import { makeEmbeddedLister } from './source/embedded.js'
import { makeDriveHttp } from './source/http.js'
import { makeDriveProbe } from './source/probe.js'
import type { DriveFolder, DriveItem, DriveLister, DriveProbe, ResolvedLink } from './source/types.local.js'
import type { GoogleDriveSourceOptions, GoogleEditorKind } from './types.js'
import { createGoogleDriveUrlHelper } from './url.js'
import { nameUtils } from './utils/names.js'

const log = logger(LOG_SCOPE)

/** Run `work` over `items`, at most `width` at once, keeping their order. */
const pooled = async <T, R>(items: T[], width: number, work: (item: T) => Promise<R>): Promise<R[]> => {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++
      results[index] = await work(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, worker))
  return results
}

/**
 * Google Drive as a reader source — public folder, file and Docs links expanded into entries the
 * collector downloads with a plain GET:
 *
 * - a folder (`drive/folders/<id>`, `open?id=` of a folder) is listed breadth-first down to `depth`
 *   sub-folder levels, at most `maxEntries` entries (and the collect's `maxFiles + 1`, so the cut is
 *   reported) from at most `maxFolders` folders — keyless from the embedded folder view, or through
 *   Drive API v3 with `apiKey`; entry paths are `<sub-folder>/<name>` relative to the linked folder;
 * - a stored file becomes its usercontent download (`confirm=t`); a file whose size is unknown or
 *   past Drive's scan limit is probed first (one ranged GET) for its name, size and — behind Drive's
 *   warning form — the URL that really serves the bytes; a file Drive refuses is left out and logged;
 * - an editor file (Docs, Sheets, Slides, Drawings) becomes its export in the configured format, its
 *   name with that extension;
 * - a single file or editor link is one entry named as Drive names it (`Content-Disposition`).
 *
 * A private item throws `GoogleDriveError` (`not-public`), an exhausted quota `quota`, a 404
 * `not-found`. Every request is the reader's guarded fetch, under its timeout and the collect's signal.
 */
export const createGoogleDriveSource = (options: GoogleDriveSourceOptions = {}): ReaderSource => {
  const urls = createGoogleDriveUrlHelper(options)
  const depth = Math.max(0, Math.floor(options.depth ?? DEFAULT_GOOGLE_DRIVE_DEPTH))
  const maxEntries = Math.max(1, Math.floor(options.maxEntries ?? DEFAULT_GOOGLE_DRIVE_MAX_ENTRIES))
  const maxFolders = Math.max(1, Math.floor(options.maxFolders ?? DEFAULT_GOOGLE_DRIVE_MAX_FOLDERS))
  const apiKey = options.apiKey != null && options.apiKey.trim() !== '' ? options.apiKey.trim() : undefined

  const matches: ReaderSource['matches'] = url => urls.parse(url) != null

  // A link nothing matched that landed on Drive (a shortener, a redirecting page) is taken by where it landed.
  const recognizes: NonNullable<ReaderSource['recognizes']> = async answer => matches(answer.finalUrl)

  const aborted = (context: ReaderSourceContext): boolean => context.signal?.aborted === true

  const editorEntry = (path: string, kind: GoogleEditorKind, id: string, name: string): SourceEntry => {
    const exported = urls.exportOf(kind, id)
    const named = nameUtils.withExtension(nameUtils.segment(name), exported.extension)
    return { path: `${path}${named}`, url: exported.url, name: named }
  }

  /** A listed file as an entry — probed unless its size is known and below the scan limit (or over the collect's cap). */
  const fileEntry = async (path: string, item: DriveItem, probe: DriveProbe, context: ReaderSourceContext): Promise<SourceEntry | undefined> => {
    const name = nameUtils.segment(item.name)
    const plain: SourceEntry = {
      path: `${path}${name}`, url: urls.downloadUrl(item.id, item.resourceKey), name,
      ...(item.size != null ? { size: item.size } : {}), ...(item.mime != null ? { mime: item.mime } : {}),
    }
    if (item.size != null && (item.size < DRIVE_SCAN_LIMIT_BYTES || item.size > context.limits.maxFileBytes)) return plain
    try {
      const probed = await probe.file(item.id, item.resourceKey)
      return { ...plain, url: probed.url, ...(probed.size != null ? { size: probed.size } : {}) }
    } catch (error) {
      if (aborted(context)) throw error
      if (error instanceof GoogleDriveError) {
        log.warn('A Drive file was left out', { file: item.id, reason: error.reason })
        return undefined
      }
      // A probe that failed on the wire leaves the download to the collector, which reports its own outcome.
      log.debug('A Drive file was not probed', { file: item.id, error })
      return plain
    }
  }

  const walk = async (root: ResolvedLink, lister: DriveLister, probe: DriveProbe, context: ReaderSourceContext): Promise<SourceEntry[]> => {
    const wanted = Math.min(maxEntries, context.limits.maxFiles + 1)
    const queue: DriveFolder[] = [{ id: root.id, ...(root.resourceKey != null ? { resourceKey: root.resourceKey } : {}), prefix: '', level: 0 }]
    const seen = new Set<string>([root.id])
    const found: Array<{ path: string, item: DriveItem }> = []
    const cut = { folders: 0, depth: 0, entries: false }
    let listed = 0
    while (queue.length > 0 && found.length < wanted) {
      if (listed >= maxFolders) {
        cut.folders = queue.length
        break
      }
      const folder = queue.shift()!
      let items: DriveItem[]
      try {
        items = await lister.list(folder, wanted - found.length)
      } catch (error) {
        if (folder.level === 0 || aborted(context)) throw error
        log.warn('A Drive sub-folder was not listed', { folder: folder.id, error })
        continue
      } finally {
        listed++
      }
      for (const item of items) {
        if (item.kind === GoogleDriveKind.Folder) {
          if (seen.has(item.id)) continue
          seen.add(item.id)
          if (folder.level >= depth) {
            cut.depth++
            continue
          }
          queue.push({
            id: item.id, ...(item.resourceKey != null ? { resourceKey: item.resourceKey } : {}),
            prefix: `${folder.prefix}${nameUtils.segment(item.name)}/`, level: folder.level + 1,
          })
          continue
        }
        if (found.length >= wanted) {
          cut.entries = true
          break
        }
        found.push({ path: folder.prefix, item })
      }
    }
    if (queue.length > 0 && found.length >= wanted) cut.entries = true
    if (cut.entries || cut.folders > 0 || cut.depth > 0) {
      log.warn('A Drive folder was cut', { folder: root.id, entries: found.length, wanted, folders: cut.folders, belowDepth: cut.depth })
    }
    const entries = await pooled(found, DRIVE_PROBE_CONCURRENCY, async ({ path, item }) =>
      item.kind === GoogleDriveKind.File
        ? await fileEntry(path, item, probe, context)
        : editorEntry(path, item.kind as GoogleEditorKind, item.id, item.name),
    )
    const kept = entries.filter((entry): entry is SourceEntry => entry != null)
    log.debug('Expanded a Drive folder', { folder: root.id, folders: listed, entries: kept.length })
    return kept
  }

  const single = async (target: ResolvedLink, probe: DriveProbe): Promise<SourceEntry[]> => {
    if (target.kind === GoogleDriveKind.File) {
      const probed = await probe.file(target.id, target.resourceKey)
      const name = nameUtils.segment(probed.name ?? target.name ?? target.id)
      return [{
        path: name, url: probed.url, name, ...(probed.size != null ? { size: probed.size } : target.size != null ? { size: target.size } : {}),
        ...(target.mime != null ? { mime: target.mime } : {}),
      }]
    }
    const kind = target.kind as GoogleEditorKind
    const probed = await probe.exported(urls.exportOf(kind, target.id).url)
    const named = editorEntry('', kind, target.id, probed.name ?? target.name ?? target.id)
    return [{ ...named, url: probed.url }]
  }

  const expand: ReaderSource['expand'] = async (url, context) => {
    const link = urls.parse(url)
    if (link == null) throw new GoogleDriveError(GoogleDriveFailure.NotALink)
    const http = makeDriveHttp(context, urls)
    const lister = apiKey != null ? makeApiLister(http, urls, apiKey) : makeEmbeddedLister(http, urls)
    const probe = makeDriveProbe(http, urls)
    const target: ResolvedLink = link.kind === GoogleDriveKind.Unresolved ? await lister.resolve(url, link) : link
    return target.kind === GoogleDriveKind.Folder ? await walk(target, lister, probe, context) : await single(target, probe)
  }

  return { name: GOOGLE_DRIVE_SOURCE, matches, recognizes, expand }
}
