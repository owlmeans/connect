import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CollectKind, CollectStatus, createDirectoryCollectSink, createLlmReader } from '@owlmeans/llm-reader'
import type { CollectSink, LlmReader } from '@owlmeans/llm-reader'
import {
  createGoogleDriveSource, createGoogleDriveUrlHelper, GOOGLE_DRIVE_SOURCE, GoogleDriveError, GoogleDriveFailure, GoogleDriveKind,
} from '../src/index.js'
import type { GoogleDriveSourceOptions } from '../src/index.js'
import { API_KEY, plainContext, startDriveStandIn, WARN_DECLARED_SIZE, WARN_UUID } from './context.js'
import {
  ACCENTED, BIG, BIG_BODY, KEYED_FOLDER, KEYED_RESOURCE, LOGO, MISSING, PNG, PRIVATE_FOLDER, QUOTA, ROOT, SECRET, SPEC, STALL_FOLDER, WIDE,
} from './fixtures.js'

const drive = startDriveStandIn()
const scratch = await mkdtemp(join(tmpdir(), 'llm-reader-google-drive-'))
afterAll(async () => {
  drive.stop()
  await rm(scratch, { recursive: true, force: true })
})

let dirs = 0
const target = (): { root: string, sink: CollectSink } => {
  const root = join(scratch, `run-${++dirs}`)
  return { root, sink: createDirectoryCollectSink(root) }
}
const files = async (root: string): Promise<string[]> =>
  (await readdir(root, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name).slice(root.length + 1)).sort()

/** A real reader with the source pointed at the stand-in; the guard allows only the loopback stand-in. */
const readerWith = (options: GoogleDriveSourceOptions = {}): LlmReader =>
  createLlmReader({ sources: [createGoogleDriveSource({ origins: drive.origins, ...options })], allowHosts: ['127.0.0.1'], timeout: 1500, s3: false })

const reader = readerWith()
const folderLink = (id: string, query = '?usp=share_link'): string => `${drive.origins.drive}/drive/folders/${id}${query}`
const fileLink = (id: string): string => `${drive.origins.drive}/file/d/${id}/view?usp=drive_web`

const ROOT_FILES = ['Spec.docx', 'assets/deep/deep.txt', 'assets/photo.png', 'big.bin', 'index.html', 'logo.svg', 'notes.md']

describe('@owlmeans/llm-reader-google-drive', () => {
  test('Drive and Docs links are recognised from the URL alone; URLs are built for downloads, exports and listings', () => {
    const source = createGoogleDriveSource()
    const id = '1knWJ30Rs2f6R8QEdch2I9WMQ8xU7k7_G'
    for (const url of [
      `https://drive.google.com/drive/folders/${id}?usp=share_link`, `https://drive.google.com/drive/u/1/folders/${id}`,
      `https://drive.google.com/drive/folders/${id}?resourcekey=0-abc`, `https://drive.google.com/file/d/${id}/view?usp=drive_web`,
      `https://drive.google.com/open?id=${id}`, `https://drive.google.com/uc?id=${id}&export=download`, `http://drive.google.com/file/d/${id}`,
      `https://drive.usercontent.google.com/download?id=${id}&export=download`, `https://docs.google.com/document/d/${id}/edit`,
      `https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`, `https://docs.google.com/presentation/d/${id}/edit`,
      `https://docs.google.com/drawings/d/${id}/edit`, `https://docs.google.com/document/u/0/d/${id}/edit`,
    ]) expect([url, source.matches(url)]).toEqual([url, true])
    for (const url of [
      'https://drive.google.com/', 'https://drive.google.com/drive/my-drive', `https://docs.google.com/forms/d/${id}/viewform`,
      `https://docs.google.com/document/d/e/2PACX-1vQx/pub`, 'https://drive.google.com/drive/folders/short', `https://example.com/drive/folders/${id}`,
      `ftp://drive.google.com/file/d/${id}`, 'not a url',
    ]) expect([url, source.matches(url)]).toEqual([url, false])

    const urls = createGoogleDriveUrlHelper({ exports: { document: 'md', spreadsheet: 'csv' } })
    expect(urls.parse(`https://drive.google.com/drive/folders/${id}?resourcekey=0-abc`)).toEqual({ kind: GoogleDriveKind.Folder, id, resourceKey: '0-abc' })
    expect(urls.parse(`https://drive.google.com/open?id=${id}`)).toEqual({ kind: GoogleDriveKind.Unresolved, id })
    expect(urls.parse(`https://docs.google.com/spreadsheets/d/${id}/edit`)).toEqual({ kind: GoogleDriveKind.Spreadsheet, id })
    expect(urls.downloadUrl(id)).toBe(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`)
    expect(urls.exportOf(GoogleDriveKind.Document, id)).toEqual({ url: `https://docs.google.com/document/d/${id}/export?format=md`, extension: 'md' })
    expect(urls.exportOf(GoogleDriveKind.Presentation, id).url).toBe(`https://docs.google.com/presentation/d/${id}/export/pptx`)
    expect(urls.folderViewUrl(id, '0-abc')).toBe(`https://drive.google.com/embeddedfolderview?id=${id}&resourcekey=0-abc`)
  })

  test('a public folder is collected through a real reader: sub-folders, an exported Doc, the warning form followed, private and form items left out', async () => {
    const { root, sink } = target()
    const before = drive.hits.length
    const result = await reader.collect(folderLink(ROOT), { sink, prefix: 'links/01-drive' })
    expect(result).toMatchObject({ kind: CollectKind.Source, source: GOOGLE_DRIVE_SOURCE, files: ROOT_FILES.length })
    expect(result.items.every(item => item.status === CollectStatus.Written)).toBe(true)
    expect(await files(root)).toEqual(ROOT_FILES.map(path => `links/01-drive/${path}`))
    const at = (path: string): Promise<Buffer> => readFile(join(root, 'links/01-drive', path))
    expect(Buffer.compare(await at('big.bin'), BIG_BODY)).toBe(0)
    expect(new Uint8Array(await at('assets/photo.png'))).toEqual(PNG)
    expect((await at('Spec.docx')).toString()).toBe('PK-docx-of-Spec')
    // An HTML file is a file like any other: kept as served, never bundled.
    expect((await at('index.html')).toString()).toContain('<script>alert(1)</script>')
    const items = Object.fromEntries(result.items.map(item => [item.path, item]))
    expect(items['links/01-drive/notes.md']?.mime).toBe('text/markdown')
    expect(items['links/01-drive/big.bin']?.url).toContain(`uuid=${WARN_UUID}`)

    const hits = drive.hits.slice(before)
    // Probes are ranged; the collector's own downloads are not.
    const probes = hits.filter(hit => hit.role === 'usercontent' && hit.headers.range === 'bytes=0-0')
    expect(probes.length).toBeGreaterThanOrEqual(6)
    expect(hits.filter(hit => hit.role === 'drive' && hit.url.startsWith('/embeddedfolderview')).length).toBe(3)
    expect(hits.some(hit => hit.url.includes(SECRET) && hit.headers.range == null)).toBe(false)
  }, 30_000)

  test('depth, maxEntries and the collect\'s maxFiles bound the walk; the cut is reported', async () => {
    const shallow = await readerWith({ depth: 0 }).collect(folderLink(ROOT), target())
    expect(shallow.items.map(item => item.path).sort()).toEqual(['Spec.docx', 'big.bin', 'index.html', 'logo.svg', 'notes.md'])
    const one = await readerWith({ depth: 1 }).collect(folderLink(ROOT), target())
    expect(one.items.map(item => item.path)).toContain('assets/photo.png')
    expect(one.items.map(item => item.path)).not.toContain('assets/deep/deep.txt')

    const limited = await reader.collect(folderLink(WIDE), { ...target(), limits: { maxFiles: 5 } })
    expect(limited.items.filter(item => item.status === CollectStatus.Written)).toHaveLength(5)
    expect(limited.items.filter(item => item.status === CollectStatus.Skipped).map(item => item.reason)).toEqual(['max-files'])
    const capped = await readerWith({ maxEntries: 3 }).collect(folderLink(WIDE), target())
    expect(capped.items.map(item => item.path)).toEqual(['wide-00.txt', 'wide-01.txt', 'wide-02.txt'])
  }, 30_000)

  test('editor exports follow the options; single links are one entry named as Drive names it', async () => {
    const { root, sink } = target()
    const markdown = await readerWith({ exports: { document: 'md' } }).collect(folderLink(ROOT), { sink, prefix: 'md' })
    expect(markdown.items.map(item => item.path)).toContain('md/Spec.md')
    expect((await readFile(join(root, 'md/Spec.md'), 'utf8'))).toBe('# Spec\n\nExported as Markdown.\n')

    const single = async (url: string): Promise<{ entry?: string, kind: CollectKind, bytes: number }> => {
      const result = await reader.collect(url, target())
      expect(result.items.every(item => item.status === CollectStatus.Written)).toBe(true)
      return { ...(result.entry != null ? { entry: result.entry } : {}), kind: result.kind, bytes: result.bytes }
    }
    expect(await single(fileLink(LOGO))).toMatchObject({ entry: 'logo.svg', kind: CollectKind.Source })
    expect(await single(`${drive.origins.drive}/uc?id=${LOGO}&export=download`)).toMatchObject({ entry: 'logo.svg' })
    expect(await single(`${drive.origins.drive}/open?id=${LOGO}`)).toMatchObject({ entry: 'logo.svg' })
    expect(await single(fileLink(ACCENTED))).toMatchObject({ entry: 'résumé 2026.txt' })
    expect(await single(fileLink(BIG))).toMatchObject({ entry: 'big.bin', bytes: BIG_BODY.length })
    expect(await single(`${drive.origins.docs}/document/d/${SPEC}/edit?usp=sharing`)).toMatchObject({ entry: 'Spec.docx' })
    const opened = await reader.collect(`${drive.origins.drive}/open?id=${ROOT}`, target())
    expect(opened.files).toBe(ROOT_FILES.length)
    // A link that lands on Drive through a redirect (a shortener) is taken by where it landed.
    const shortened = await reader.collect(drive.short, target())
    expect(shortened).toMatchObject({ kind: CollectKind.Source, source: GOOGLE_DRIVE_SOURCE, files: ROOT_FILES.length })
    // A pre-2021 link carries its resource key to the folder view.
    const keyed = await reader.collect(folderLink(KEYED_FOLDER, `?resourcekey=${KEYED_RESOURCE}`), target())
    expect(keyed.items.map(item => [item.path, item.status])).toEqual([['keyed.txt', CollectStatus.Written]])
  }, 30_000)

  test('refusals are clear errors: private → not-public, quota, 404 → not-found; a stalled answer times out', async () => {
    const source = createGoogleDriveSource({ origins: drive.origins })
    const reason = async (url: string): Promise<GoogleDriveFailure | string> => {
      const error = await source.expand(url, plainContext()).then(() => 'expanded', (e: unknown) => e)
      return error instanceof GoogleDriveError ? error.reason : String(error)
    }
    expect(await reason(folderLink(PRIVATE_FOLDER))).toBe(GoogleDriveFailure.NotPublic)
    expect(await reason(fileLink(SECRET))).toBe(GoogleDriveFailure.NotPublic)
    expect(await reason(fileLink(QUOTA))).toBe(GoogleDriveFailure.Quota)
    expect(await reason(folderLink(MISSING))).toBe(GoogleDriveFailure.NotFound)
    expect(await reason(folderLink(KEYED_FOLDER))).toBe(GoogleDriveFailure.NotFound)
    expect(await reason('https://example.com/file')).toBe(GoogleDriveFailure.NotALink)

    const refused = await reader.collect(folderLink(PRIVATE_FOLDER), target())
    expect(refused).toMatchObject({ kind: CollectKind.Source, files: 0 })
    expect(refused.items).toEqual([expect.objectContaining({ status: CollectStatus.Failed, reason: 'llm-reader:fetch:google-drive:not-public' })])
    const started = Date.now()
    const stalled = await reader.collect(folderLink(STALL_FOLDER), target())
    expect(stalled.items[0]).toMatchObject({ status: CollectStatus.Failed, reason: 'llm-reader:fetch:timeout' })
    expect(Date.now() - started).toBeLessThan(5_000)
  }, 30_000)

  test('with an API key: Drive API pages with sizes and media types, the key only as a header, a refused key is api-key', async () => {
    const before = drive.hits.length
    const source = createGoogleDriveSource({ origins: drive.origins, apiKey: API_KEY })
    const entries = await source.expand(folderLink(ROOT), plainContext())
    // The file behind the warning form declares a size past the default file cap: not probed, admitted by size.
    expect(entries.map(entry => entry.path).sort()).toEqual(ROOT_FILES)
    expect(entries.find(entry => entry.path === 'notes.md')).toMatchObject({ size: 22, mime: 'text/markdown' })
    expect(entries.find(entry => entry.path === 'big.bin')).toMatchObject({ size: WARN_DECLARED_SIZE })
    const apiHits = drive.hits.slice(before).filter(hit => hit.role === 'api')
    expect(apiHits.some(hit => hit.url.includes('pageToken='))).toBe(true)
    expect(apiHits.every(hit => hit.headers['x-goog-api-key'] === API_KEY && !hit.url.includes(API_KEY))).toBe(true)
    expect(drive.hits.slice(before).some(hit => hit.role === 'drive')).toBe(false)

    const keyed = createLlmReader({ sources: [source], allowHosts: ['127.0.0.1'], timeout: 1500, s3: false })
    const capped = await keyed.collect(folderLink(ROOT), target())
    expect(capped.items.find(item => item.path === 'big.bin')).toMatchObject({ status: CollectStatus.Skipped, reason: 'max-file-bytes' })
    expect(capped.items.filter(item => item.status === CollectStatus.Written)).toHaveLength(ROOT_FILES.length - 1)
    // Past the scan limit and under a raised cap, the file is probed and its warning form followed.
    const { root, sink } = target()
    const raised = await keyed.collect(folderLink(ROOT), { sink, limits: { maxFileBytes: 200 * 1024 * 1024, maxTotalBytes: 400 * 1024 * 1024 } })
    expect(raised.items.find(item => item.path === 'big.bin')).toMatchObject({ status: CollectStatus.Written, bytes: BIG_BODY.length })
    expect(Buffer.compare(await readFile(join(root, 'big.bin')), BIG_BODY)).toBe(0)
    expect((await keyed.collect(`${drive.origins.drive}/open?id=${SPEC}`, target())).entry).toBe('Spec.docx')

    const wrong = createGoogleDriveSource({ origins: drive.origins, apiKey: 'wrong-key' })
    const error = await wrong.expand(folderLink(ROOT), plainContext()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(GoogleDriveError)
    expect((error as GoogleDriveError).reason).toBe(GoogleDriveFailure.ApiKey)
    expect(((await source.expand(folderLink(PRIVATE_FOLDER), plainContext()).catch((e: unknown) => e)) as GoogleDriveError).reason)
      .toBe(GoogleDriveFailure.NotFound)
  }, 30_000)
})
