import { logger } from '@owlmeans/log'
import { parseHTML } from 'linkedom'
import { GoogleDriveFailure, GoogleDriveKind } from '../consts.js'
import { DRIVE_ID_PATTERN } from '../consts.local.js'
import { GoogleDriveError } from '../errors.js'
import type { GoogleDriveUrlHelper } from '../types.js'
import { DRIVE_LISTING_BYTES, GOOGLE_APPS_KINDS, GOOGLE_APPS_PREFIX, LOG_SCOPE } from './consts.local.js'
import type { DriveHttp, DriveItem, DriveLister } from './types.local.js'

const log = logger(LOG_SCOPE)

/**
 * Folders listed without a key, from Drive's static embedded folder view
 * (`/embeddedfolderview?id=<id>`): every `div.flip-entry` (`id="entry-<fileId>"`) carries a link
 * (`/file/d/<id>/view` for a file, `/drive/folders/<id>` for a sub-folder, `docs.google.com/…` for an
 * editor file), its `.flip-entry-title` and a type icon (`…/type/<media type>`). No sizes.
 */
export const makeEmbeddedLister = (http: DriveHttp, urls: GoogleDriveUrlHelper): DriveLister => {
  const mimeOf = (src: string | null | undefined, base: string): string | undefined => {
    if (src == null || src === '') return undefined
    try {
      const type = /\/type\/(.+)$/.exec(new URL(src, base).pathname)?.[1]
      return type != null ? decodeURIComponent(type) : undefined
    } catch {
      return undefined
    }
  }

  const list: DriveLister['list'] = async folder => {
    const response = await http.get(urls.folderViewUrl(folder.id, folder.resourceKey), { maxBytes: DRIVE_LISTING_BYTES })
    const refused = await http.refusal(response)
    if (refused != null) throw refused
    const base = response.url !== '' ? response.url : urls.folderViewUrl(folder.id)
    const page = await response.text()
    const { document } = parseHTML(page)
    if (document.querySelector('#flip-contents, .flip-entries, .flip-entry') == null) {
      throw http.pageFailure(page) ?? new GoogleDriveError(`${GoogleDriveFailure.Unrecognized}:folder-view`)
    }
    const items: DriveItem[] = []
    let unsupported = 0
    for (const entry of document.querySelectorAll('.flip-entry')) {
      const href = entry.querySelector('a[href]')?.getAttribute('href')
      let link
      try {
        link = href != null ? urls.parse(new URL(href, base).href) : undefined
      } catch {
        link = undefined
      }
      const mime = mimeOf(entry.querySelector('.flip-entry-list-icon img, .flip-entry-icon img')?.getAttribute('src'), base)
      const fallback = /^entry-(.+)$/.exec(entry.getAttribute('id') ?? '')?.[1]
      const id = link?.id ?? (fallback != null && DRIVE_ID_PATTERN.test(fallback) ? fallback : undefined)
      const kind = link != null && link.kind !== GoogleDriveKind.Unresolved ? link.kind
        : mime != null && mime.startsWith(GOOGLE_APPS_PREFIX) ? GOOGLE_APPS_KINDS[mime]
          : id != null ? GoogleDriveKind.File : undefined
      if (id == null || kind == null) {
        unsupported++
        continue
      }
      const title = entry.querySelector('.flip-entry-title')?.textContent?.trim()
      items.push({
        id, kind, name: title != null && title !== '' ? title : id,
        ...(mime != null && !mime.startsWith(GOOGLE_APPS_PREFIX) ? { mime } : {}),
        ...(link?.resourceKey != null ? { resourceKey: link.resourceKey } : {}),
      })
    }
    log.debug('Listed a folder', { folder: folder.id, items: items.length, unsupported })
    return items
  }

  const resolve: DriveLister['resolve'] = async (url, link) => {
    // `open?id=` answers with a redirect to the item's own page; only where it lands is read.
    const response = await http.get(url, { maxBytes: DRIVE_LISTING_BYTES })
    const refused = await http.refusal(response)
    if (refused != null) throw refused
    await http.discard(response)
    const landed = response.url !== '' ? urls.parse(response.url) : undefined
    const resourceKey = landed?.resourceKey ?? link.resourceKey
    const kind = landed != null && landed.kind !== GoogleDriveKind.Unresolved ? landed.kind : GoogleDriveKind.File
    return { kind, id: landed?.id ?? link.id, ...(resourceKey != null ? { resourceKey } : {}) }
  }

  return { list, resolve }
}
