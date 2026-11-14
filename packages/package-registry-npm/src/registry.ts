import { packageNameHelper, PackageRegistryError } from '@owlmeans/package-inspector'
import type { PackageRepository } from '@owlmeans/package-inspector'
import {
  NPM_BULK_CONCURRENCY, NPM_BULK_LIMIT, NPM_CACHE_SIZE, NPM_CACHE_TTL, NPM_DOWNLOADS_PERIOD, NPM_DOWNLOADS_URL,
  NPM_MAX_DOCUMENT_BYTES, NPM_MAX_NEIGHBOURS, NPM_MAX_README_CHARS, NPM_README_FILES, NPM_MAX_SCOPED_LOOKUPS, NPM_MAX_SMALL_BYTES,
  NPM_MAX_VARIANTS, NPM_REGISTRY, NPM_REGISTRY_URL, NPM_RETRIES, NPM_SCOPED_CONCURRENCY, NPM_TIMEOUT, NPM_USER_AGENT,
} from './consts.js'
import { createNpmFactsMapper } from './registry/facts.js'
import { createNpmHttp } from './registry/http.js'
import type { NpmDocument } from './registry/types.local.js'
import { createRepositoryLocator } from './repository.js'
import type { NpmRegistry, NpmRegistryOptions } from './types.js'
import type { NpmDownloadsBulk, NpmDownloadsPoint, NpmPackument, NpmVersion } from './types.local.js'

/**
 * The npm registry behind the package inspector's port, over the injected `fetch`:
 *
 * - `manifest` — the full packument (scoped names as `@scope%2fname`), read up to `maxDocumentBytes`;
 *   a larger one is read through `/<name>/latest` (`partial` facts: no dates or version count) and
 *   the readme from the repository.
 *   Holding = latest `0.0.1-security` or the description "security holding package".
 * - `downloads` — the weekly point API: unscoped names in bulk calls of ≤ 128, scoped names one call
 *   each; `null` for a name npm does not know. Counts are cached for `cacheTtlMs`.
 * - `neighbours` — the name helper's variants (≤ `maxVariants`, ≤ `maxScopedLookups` scoped ones)
 *   priced in bulk; the existing ones, most downloaded first (≤ `maxNeighbours`). npm search does not
 *   surface them: it answers `loadsh` without `lodash`.
 * - `repositoryManifest` — the repository's own `package.json` at its default branch on GitHub or
 *   GitLab, at the declared `directory`.
 *
 * A 404 is `null` everywhere; any other failure throws `PackageRegistryError`.
 */
export const createNpmRegistry = (options: NpmRegistryOptions = {}): NpmRegistry => {
  const registryUrl = (options.registryUrl ?? NPM_REGISTRY_URL).replace(/\/+$/, '')
  const downloadsUrl = (options.downloadsUrl ?? NPM_DOWNLOADS_URL).replace(/\/+$/, '')
  const maxDocumentBytes = options.maxDocumentBytes ?? NPM_MAX_DOCUMENT_BYTES
  const maxNeighbours = options.maxNeighbours ?? NPM_MAX_NEIGHBOURS
  const maxVariants = options.maxVariants ?? NPM_MAX_VARIANTS
  const maxScopedLookups = options.maxScopedLookups ?? NPM_MAX_SCOPED_LOOKUPS
  const cacheTtl = options.cacheTtlMs ?? NPM_CACHE_TTL
  const http = createNpmHttp({
    fetch: options.fetch, timeoutMs: options.timeoutMs ?? NPM_TIMEOUT, userAgent: options.userAgent ?? NPM_USER_AGENT,
    retries: options.retries ?? NPM_RETRIES,
  })
  const locator = createRepositoryLocator(options.repositoryHosts)
  const maxReadmeChars = options.maxReadmeChars ?? NPM_MAX_README_CHARS
  const mapper = createNpmFactsMapper({ locator, maxReadmeChars })
  const counts = new Map<string, { count: number | null, at: number }>()

  /** `@scope/name` as one path segment of the registry (`@scope%2fname`) or as two (`@scope/name`). */
  const pathOf = (name: string, separator: '%2f' | '/'): string => {
    const slash = name.indexOf('/')
    return name.startsWith('@') && slash > 1
      ? `@${encodeURIComponent(name.slice(1, slash))}${separator}${encodeURIComponent(name.slice(slash + 1))}`
      : encodeURIComponent(name)
  }

  /** A name a downloads URL can carry; a comma would split a bulk list. */
  const askable = (name: string): boolean => /^@?[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)?$/.test(name)

  const pool = async <T>(items: T[], width: number, work: (item: T) => Promise<void>): Promise<void> => {
    let next = 0
    const worker = async (): Promise<void> => {
      while (next < items.length) {
        await work(items[next++])
      }
    }
    await Promise.all(Array.from({ length: Math.min(width, items.length) }, worker))
  }

  const remembered = (name: string): number | null | undefined => {
    const entry = counts.get(name)
    return entry != null && Date.now() - entry.at < cacheTtl ? entry.count : undefined
  }

  const remember = (name: string, count: number | null): void => {
    if (cacheTtl <= 0) {
      return
    }
    counts.delete(name)
    counts.set(name, { count, at: Date.now() })
    for (const oldest of counts.keys()) {
      if (counts.size <= NPM_CACHE_SIZE) {
        break
      }
      counts.delete(oldest)
    }
  }

  const countOf = (point: NpmDownloadsPoint | null | undefined): number | null =>
    typeof point?.downloads === 'number' ? point.downloads : null

  /** One bulk call — or, for a single name, the single-package answer, which has another shape. */
  const bulk = async (batch: string[]): Promise<Record<string, number | null>> => {
    const label = `${NPM_REGISTRY}:downloads:${batch.length === 1 ? batch[0] : `${batch[0]}+${batch.length - 1}`}`
    const url = `${downloadsUrl}/downloads/point/${NPM_DOWNLOADS_PERIOD}/${batch.map(name => encodeURIComponent(name)).join(',')}`
    const document = await http.json<NpmDownloadsBulk & NpmDownloadsPoint>(url, label, NPM_MAX_SMALL_BYTES)
    if (document == null) {
      return Object.fromEntries(batch.map(name => [name, null]))
    }
    const body = document.body
    if (body == null || typeof body !== 'object') {
      throw new PackageRegistryError(`${label}:malformed`)
    }
    if (batch.length === 1 && typeof body.package === 'string') {
      return { [batch[0]]: countOf(body) }
    }

    return Object.fromEntries(batch.map(name => [name, countOf(body[name] as NpmDownloadsPoint | null | undefined)]))
  }

  const scoped = async (name: string): Promise<number | null> => {
    const label = `${NPM_REGISTRY}:downloads:${name}`
    const document = await http.json<NpmDownloadsPoint>(
      `${downloadsUrl}/downloads/point/${NPM_DOWNLOADS_PERIOD}/${pathOf(name, '/')}`, label, NPM_MAX_SMALL_BYTES
    )

    return countOf(document?.body)
  }

  const downloads: NpmRegistry['downloads'] = async names => {
    const found = new Map<string, number | null>()
    const missing: string[] = []
    for (const name of new Set(names.map(entry => entry.trim()))) {
      const known = remembered(name)
      if (known !== undefined) {
        found.set(name, known)
      } else if (!askable(name)) {
        found.set(name, null)
      } else {
        missing.push(name)
      }
    }
    const batches: string[][] = []
    const plain = missing.filter(name => !name.startsWith('@'))
    for (let start = 0; start < plain.length; start += NPM_BULK_LIMIT) {
      batches.push(plain.slice(start, start + NPM_BULK_LIMIT))
    }
    await pool(batches, NPM_BULK_CONCURRENCY, async batch => {
      for (const [name, count] of Object.entries(await bulk(batch))) {
        found.set(name, count)
        remember(name, count)
      }
    })
    await pool(missing.filter(name => name.startsWith('@')), NPM_SCOPED_CONCURRENCY, async name => {
      const count = await scoped(name)
      found.set(name, count)
      remember(name, count)
    })

    return Object.fromEntries(names.map(name => [name, found.get(name.trim()) ?? null]))
  }

  const manifest: NpmRegistry['manifest'] = async raw => {
    const name = raw.trim()
    const label = `${NPM_REGISTRY}:packument:${name}`
    const document = await http.json<NpmPackument>(`${registryUrl}/${pathOf(name, '%2f')}`, label, maxDocumentBytes)
    if (document == null) {
      return null
    }
    if (!document.truncated) {
      if (document.body == null || typeof document.body !== 'object') {
        throw new PackageRegistryError(`${label}:malformed`)
      }
      return mapper.factsOf(name, document.body, null)
    }
    // Too large to read whole: the latest version's own document carries what the rules need, the
    // repository the readme.
    const latest = await http.json<NpmVersion>(`${registryUrl}/${pathOf(name, '%2f')}/latest`, `${NPM_REGISTRY}:latest:${name}`, NPM_MAX_SMALL_BYTES)
    const facts = mapper.factsOf(name, null, latest?.body != null && typeof latest.body === 'object' ? latest.body : {})
    const readme = facts.repository != null ? await repositoryReadme(facts.repository) : null

    return readme != null && readme.body != null && readme.body.trim() !== ''
      ? {
          ...facts,
          readme: readme.body.slice(0, maxReadmeChars),
          ...(readme.truncated || readme.body.length > maxReadmeChars ? { readmeTruncated: true } : {}),
        }
      : facts
  }

  /** The repository's readme at the package's directory; `null` when there is none or the host fails. */
  const repositoryReadme = async (repository: PackageRepository): Promise<NpmDocument<string> | null> => {
    const location = locator.locate(repository.url, repository.directory)
    if (location == null) {
      return null
    }
    for (const file of NPM_README_FILES) {
      const label = `${NPM_REGISTRY}:readme:${location.path}`
      const document = await http.text(locator.rawUrlOf(location, file), label, maxReadmeChars * 4).catch(() => null)
      if (document != null) {
        return document
      }
    }

    return null
  }

  const neighbours: NpmRegistry['neighbours'] = async raw => {
    const name = raw.trim()
    const variants = packageNameHelper.variants(name, { limit: maxVariants })
    const candidates = [
      ...variants.filter(variant => !variant.startsWith('@')),
      ...variants.filter(variant => variant.startsWith('@')).slice(0, maxScopedLookups),
    ]
    const priced = await downloads([name, ...candidates])

    return candidates
      .flatMap(candidate => {
        const count = priced[candidate]
        return typeof count === 'number' && candidate !== name ? [{ candidate, count }] : []
      })
      .sort((a, b) => b.count - a.count || a.candidate.localeCompare(b.candidate))
      .slice(0, maxNeighbours)
      .map(entry => entry.candidate)
  }

  const repositoryManifest: NpmRegistry['repositoryManifest'] = async repository => {
    const location = locator.locate(repository.url, repository.directory)
    if (location == null) {
      return null
    }
    const document = await http.json<{ name?: unknown, private?: unknown, workspaces?: unknown }>(
      locator.rawUrlOf(location, 'package.json'), `${NPM_REGISTRY}:repository:${location.path}`, NPM_MAX_SMALL_BYTES
    )
    const body = document?.body
    if (body == null || typeof body !== 'object' || typeof body.name !== 'string' || body.name.trim() === '') {
      return null
    }

    return { name: body.name.trim(), root: body.private === true || body.workspaces != null }
  }

  return { id: NPM_REGISTRY, manifest, downloads, neighbours, repositoryManifest }
}
