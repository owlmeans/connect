import { DEFAULT_COLLECT_LIMITS } from '@owlmeans/llm-reader'
import type { ReaderSourceContext } from '@owlmeans/llm-reader'
import { makeGates } from '@owlmeans/test'
import type { GoogleDriveOrigins } from '../src/index.js'
import { bytesOf, childrenOf, itemOf, ROOT } from './fixtures.js'
import type { StandInItem } from './fixtures.js'

export const gates = makeGates({ live: ['LLM_READER_GDRIVE_LIVE'] })

export const API_KEY = 'test-api-key'
export const WARN_UUID = 'b1a2c3d4-uuid'
/** The size the Drive API declares for the file behind the warning form — past Drive's 100 MiB scan limit. */
export const WARN_DECLARED_SIZE = 150 * 1024 * 1024

export interface StandInHit {
  role: 'drive' | 'usercontent' | 'docs' | 'accounts' | 'api' | 'short'
  /** Path and query as requested. */
  url: string
  headers: Record<string, string>
}

export interface DriveStandIn {
  /** Origins pointing a source at the stand-in. */
  origins: Required<GoogleDriveOrigins>
  /** A link shortener that redirects to the root folder's share link. */
  short: string
  hits: StandInHit[]
  stop: () => void
}

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const html = (body: string, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } })

const notFound = (): Response => html('<html><title>Error 404 (Not Found)!!1</title><p>404. That’s an error.</p></html>', 404)

const GOOGLE_TYPES: Record<StandInItem['kind'], string | undefined> = {
  folder: 'application/vnd.google-apps.folder',
  document: 'application/vnd.google-apps.document',
  form: 'application/vnd.google-apps.form',
  file: undefined,
}

/**
 * Real local HTTP servers answering like Google Drive: the embedded folder view (Drive's own markup),
 * `open?id=` redirects, usercontent downloads with Range, Content-Disposition, the "can't scan for
 * viruses" form and the quota page, Docs exports behind a redirect, the sign-in host private items
 * redirect to, and Drive API v3 (`X-Goog-Api-Key`, pages of two, a refused key) — plus a shortener.
 */
export const startDriveStandIn = (): DriveStandIn => {
  const hits: StandInHit[] = []
  const servers: Array<ReturnType<typeof Bun.serve>> = []
  const origins = { drive: '', usercontent: '', docs: '', accounts: '', api: '' }

  const serve = (role: StandInHit['role'], answer: (url: URL, request: Request) => Response | Promise<Response>): string => {
    const server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch: request => {
        const url = new URL(request.url)
        hits.push({ role, url: `${url.pathname}${url.search}`, headers: Object.fromEntries(request.headers.entries()) })
        return answer(url, request)
      },
    })
    servers.push(server)
    return `http://127.0.0.1:${server.port}`
  }

  const signIn = (): Response => new Response(null, { status: 302, headers: { location: `${origins.accounts}/v3/signin/identifier?continue=drive` } })

  const keyed = (item: StandInItem, url: URL): boolean => item.resourceKey == null || url.searchParams.get('resourcekey') === item.resourceKey

  const hrefOf = (item: StandInItem): string => {
    switch (item.kind) {
      case 'folder': return `${origins.drive}/drive/folders/${item.id}${item.resourceKey != null ? `?resourcekey=${item.resourceKey}` : ''}`
      case 'document': return `${origins.docs}/document/d/${item.id}/edit?usp=drive_web`
      case 'form': return `${origins.docs}/forms/d/${item.id}/edit?usp=drive_web`
      default: return `${origins.drive}/file/d/${item.id}/view?usp=drive_web`
    }
  }

  const entryOf = (item: StandInItem): string => {
    const type = GOOGLE_TYPES[item.kind] ?? item.mime ?? 'application/octet-stream'
    return `<div class="flip-entry" id="entry-${item.id}" tabindex="0" role="link"><div class="flip-entry-info"><a href="${escapeHtml(hrefOf(item))}" target="_blank">`
      + `<div class="flip-entry-visual"><div class="flip-entry-visual-card"><div class="flip-entry-icon"><img src="https://drive-thirdparty.googleusercontent.com/128/type/${type}" alt=""/></div></div></div>`
      + `<div class="flip-entry-list-icon"><img src="https://drive-thirdparty.googleusercontent.com/16/type/${type}" alt=""/></div>`
      + `<div class="flip-entry-title">${escapeHtml(item.name)}</div></a></div><div class="flip-entry-last-modified"><div>Nov 11</div></div></div>`
  }

  const folderView = (folder: StandInItem): string =>
    `<!DOCTYPE html><html><head><title>${escapeHtml(folder.name)}</title><meta http-equiv="content-type" content="text/html; charset=utf-8"/></head>`
    + `<body class="flip-embedded"><div class="flip-butter-container"><div id="flip-butter"></div></div><div id="flip-contents" class="flip-list-view">`
    + `<div class="flip-entries">${childrenOf(folder.id).map(entryOf).join('')}</div></div></body></html>`

  origins.drive = serve('drive', url => {
    const id = url.searchParams.get('id') ?? ''
    if (url.pathname === '/embeddedfolderview') {
      const folder = itemOf(id)
      if (folder?.kind !== 'folder' || !keyed(folder, url)) return notFound()
      if (folder.private === true) return signIn()
      if (folder.stall === true) return new Promise(resolve => setTimeout(() => resolve(html(folderView(folder))), 10_000))
      return html(folderView(folder))
    }
    if (url.pathname === '/open') {
      const item = itemOf(id)
      if (item == null) return notFound()
      const location = item.kind === 'folder' ? `/drive/folders/${id}?usp=drive_open`
        : item.kind === 'document' ? `${origins.docs}/document/d/${id}/edit?usp=drive_open` : `/file/d/${id}/view?usp=drive_open`
      return new Response(null, { status: 307, headers: { location, 'content-type': 'application/binary' } })
    }
    if (/^\/(drive\/folders|file\/d)\//.test(url.pathname)) return html('<!DOCTYPE html><html><head><title>Drive</title></head><body><script>app()</script></body></html>')
    return notFound()
  })

  origins.usercontent = serve('usercontent', (url, request) => {
    const item = itemOf(url.searchParams.get('id') ?? '')
    if (url.pathname !== '/download' || item?.kind !== 'file' || !keyed(item, url)) return notFound()
    if (item.private === true) return signIn()
    if (item.quota === true) {
      return html('<html><head><title>Google Drive - Quota exceeded</title></head><body><p>Sorry, you can\'t view or download this file at this time.</p>'
        + '<p>Too many users have viewed or downloaded this file recently. Please try accessing the file again later.</p></body></html>')
    }
    if (item.warn === true && url.searchParams.get('uuid') !== WARN_UUID) {
      return html(`<!DOCTYPE html><html><head><title>Google Drive - Virus scan warning</title></head><body><div class="uc-main"><div id="uc-text">`
        + `<p class="uc-warning-caption">Google Drive can't scan this file for viruses.</p><p class="uc-warning-subcaption"><span class="uc-name-size"><a href="/open?id=${item.id}">${escapeHtml(item.name)}</a> (64K)</span> is too large for Google to scan for viruses. Would you still like to download this file?</p>`
        + `<form id="download-form" action="${origins.usercontent}/download" method="get"><input type="submit" id="uc-download-link" class="goog-inline-block jfk-button jfk-button-action" value="Download anyway"/>`
        + `<input type="hidden" name="id" value="${item.id}"><input type="hidden" name="export" value="download"><input type="hidden" name="confirm" value="t"><input type="hidden" name="uuid" value="${WARN_UUID}"></form></div></div></body></html>`)
    }
    const bytes = bytesOf(item)
    const ascii = /^[\x20-\x7e]*$/.test(item.name)
    const headers: Record<string, string> = {
      'content-type': 'application/octet-stream',
      'content-disposition': ascii ? `attachment; filename="${item.name}"` : `attachment; filename="${item.name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(item.name)}`,
    }
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.get('range') ?? '')
    if (range != null) {
      const start = Number(range[1])
      const end = Math.min(range[2] !== '' ? Number(range[2]) : bytes.length - 1, bytes.length - 1)
      return new Response(bytes.slice(start, end + 1), { status: 206, headers: { ...headers, 'content-range': `bytes ${start}-${end}/${bytes.length}` } })
    }
    return new Response(bytes, { status: 200, headers })
  })

  origins.docs = serve('docs', url => {
    const exported = /^\/exported\/([^/]+)\/([a-z]+)$/.exec(url.pathname)
    if (exported != null) {
      const item = itemOf(exported[1]!)
      const format = item?.exports?.[exported[2]!]
      if (item == null || format == null) return notFound()
      return new Response(format.body, {
        status: 200,
        headers: { 'content-type': format.mime, 'content-disposition': `attachment; filename="${item.name}.${exported[2]}"; filename*=UTF-8''${encodeURIComponent(item.name)}.${exported[2]}` },
      })
    }
    const doc = /^\/document\/d\/([^/]+)\/(export|edit)$/.exec(url.pathname)
    const item = doc != null ? itemOf(doc[1]!) : undefined
    if (doc == null || item?.kind !== 'document') return notFound()
    if (item.private === true) return signIn()
    if (doc[2] === 'edit') return html('<!DOCTYPE html><html><head><title>Spec - Google Docs</title></head><body><script>docs()</script></body></html>')
    // Docs answers an export with a redirect to a googleusercontent host that serves the bytes.
    return new Response(null, { status: 307, headers: { location: `/exported/${item.id}/${url.searchParams.get('format') ?? 'docx'}` } })
  })

  origins.accounts = serve('accounts', () => html('<!DOCTYPE html><html><head><title>Sign in - Google Accounts</title></head><body>Sign in to continue to Google Drive</body></html>'))

  const apiError = (status: number, reason: string, message: string, details?: string): Response =>
    new Response(JSON.stringify({
      error: { code: status, message, errors: [{ message, domain: 'global', reason }], ...(details != null ? { status: 'INVALID_ARGUMENT', details: [{ reason: details }] } : {}) },
    }), { status, headers: { 'content-type': 'application/json; charset=UTF-8' } })

  const apiFile = (item: StandInItem): Record<string, unknown> => ({
    id: item.id, name: item.name, mimeType: GOOGLE_TYPES[item.kind] ?? item.mime ?? 'application/octet-stream',
    // Drive shows its warning form only past its scan limit — the API declares such a size.
    ...(item.kind === 'file' ? { size: String(item.warn === true ? WARN_DECLARED_SIZE : bytesOf(item).length) } : {}),
    ...(item.resourceKey != null ? { resourceKey: item.resourceKey } : {}),
  })

  origins.api = serve('api', (url, request) => {
    const key = request.headers.get('x-goog-api-key')
    if (key !== API_KEY) return apiError(400, 'badRequest', 'API key not valid. Please pass a valid API key.', 'API_KEY_INVALID')
    if (url.pathname === '/drive/v3/files') {
      const parent = /^'([^']+)' in parents and trashed=false$/.exec(url.searchParams.get('q') ?? '')?.[1]
      const folder = parent != null ? itemOf(parent) : undefined
      if (folder?.kind !== 'folder' || folder.private === true) return apiError(404, 'notFound', `File not found: ${parent}.`)
      const children = childrenOf(folder.id).filter(item => item.private !== true)
      const start = Number(url.searchParams.get('pageToken') ?? '0')
      const page = children.slice(start, start + 2)
      return Response.json({
        files: page.map(apiFile),
        ...(start + 2 < children.length ? { nextPageToken: String(start + 2) } : {}),
      })
    }
    const file = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname)
    const item = file != null ? itemOf(decodeURIComponent(file[1]!)) : undefined
    if (item == null || item.private === true) return apiError(404, 'notFound', 'File not found.')
    return Response.json(apiFile(item))
  })

  const short = serve('short', () => new Response(null, { status: 302, headers: { location: `${origins.drive}/drive/folders/${ROOT}?usp=sharing` } }))

  return {
    origins, short: `${short}/s/project-files`, hits,
    stop: () => servers.forEach(server => void server.stop(true)),
  }
}

/** The source seam over plain `fetch` (redirects followed, `response.url` set) — what `expand` needs, without a reader. */
export const plainContext = (): ReaderSourceContext => ({
  fetch: (url, init = {}) => fetch(url, { ...(init.headers != null ? { headers: init.headers } : {}), ...(init.signal != null ? { signal: init.signal } : {}) }),
  limits: { ...DEFAULT_COLLECT_LIMITS },
})
