import { DEFAULT_GOOGLE_DRIVE_ORIGINS, DEFAULT_GOOGLE_EXPORTS, GoogleDriveKind } from './consts.js'
import type { GoogleDriveLink, GoogleDriveUrlHelper, GoogleDriveUrlOptions } from './types.js'
import { DRIVE_ID_PATTERN } from './consts.local.js'
import { DRIVE_API_ITEM_FIELDS, DRIVE_API_PAGE_SIZE, EDITOR_PATHS, EXPORT_EXTENSIONS } from './url/consts.local.js'

/**
 * Drive and Docs links read from the URL alone, and the URLs the source asks Google: the direct
 * usercontent download (`confirm=t`), editor exports in the configured formats, the keyless embedded
 * folder view and Drive API v3. Links match the configured hosts over http or https.
 */
export const createGoogleDriveUrlHelper = (options: GoogleDriveUrlOptions = {}): GoogleDriveUrlHelper => {
  const origins = { ...DEFAULT_GOOGLE_DRIVE_ORIGINS, ...options.origins }
  const formats = { ...DEFAULT_GOOGLE_EXPORTS, ...options.exports }
  const originOf = (origin: string): string => new URL(origin).origin
  const drive = originOf(origins.drive)
  const usercontent = originOf(origins.usercontent)
  const docs = originOf(origins.docs)
  const api = originOf(origins.api)
  const hosts = {
    drive: new URL(drive).host, usercontent: new URL(usercontent).host, docs: new URL(docs).host, accounts: new URL(origins.accounts).host,
  }

  const read = (url: string): URL | undefined => {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed : undefined
    } catch {
      return undefined
    }
  }

  const parse: GoogleDriveUrlHelper['parse'] = url => {
    const parsed = read(url)
    if (parsed == null) return undefined
    const host = parsed.host.toLowerCase()
    const path = parsed.pathname
    const resourceKey = parsed.searchParams.get('resourcekey') ?? undefined
    const link = (kind: GoogleDriveKind, id: string | null | undefined): GoogleDriveLink | undefined =>
      id != null && DRIVE_ID_PATTERN.test(id) ? { kind, id, ...(resourceKey != null && resourceKey !== '' ? { resourceKey } : {}) } : undefined

    if (host === hosts.drive) {
      const folder = /^\/drive\/(?:u\/\d+\/|mobile\/)?folders\/([^/]+)/.exec(path)
      if (folder != null) return link(GoogleDriveKind.Folder, folder[1])
      if (/^\/(?:embedded)?folderview\/?$/.test(path)) return link(GoogleDriveKind.Folder, parsed.searchParams.get('id'))
      const file = /^\/file\/(?:u\/\d+\/)?d\/([^/]+)/.exec(path)
      if (file != null) return link(GoogleDriveKind.File, file[1])
      if (/^\/(?:u\/\d+\/)?uc\/?$/.test(path)) return link(GoogleDriveKind.File, parsed.searchParams.get('id'))
      if (/^\/open\/?$/.test(path)) return link(GoogleDriveKind.Unresolved, parsed.searchParams.get('id'))
      return undefined
    }
    if (host === hosts.usercontent) {
      return /^\/(?:download|uc)\/?$/.test(path) ? link(GoogleDriveKind.File, parsed.searchParams.get('id')) : undefined
    }
    if (host === hosts.docs) {
      const editor = /^\/(document|spreadsheets|presentation|drawings)\/(?:u\/\d+\/)?d\/([^/]+)/.exec(path)
      if (editor != null) return link(EDITOR_PATHS[editor[1]!]!, editor[2])
    }
    return undefined
  }

  const withKey = (url: URL, resourceKey?: string): string => {
    if (resourceKey != null && resourceKey !== '') url.searchParams.set('resourcekey', resourceKey)
    return url.href
  }

  const downloadUrl: GoogleDriveUrlHelper['downloadUrl'] = (id, resourceKey) => {
    const url = new URL('/download', usercontent)
    url.searchParams.set('id', id)
    url.searchParams.set('export', 'download')
    url.searchParams.set('confirm', 't')
    return withKey(url, resourceKey)
  }

  const exportOf: GoogleDriveUrlHelper['exportOf'] = (kind, id) => {
    const format = kind === GoogleDriveKind.Document ? formats.document
      : kind === GoogleDriveKind.Spreadsheet ? formats.spreadsheet
        : kind === GoogleDriveKind.Presentation ? formats.presentation
          : formats.drawing
    const path = kind === GoogleDriveKind.Document ? `/document/d/${id}/export?format=${format}`
      : kind === GoogleDriveKind.Spreadsheet ? `/spreadsheets/d/${id}/export?format=${format}`
        : kind === GoogleDriveKind.Presentation ? `/presentation/d/${id}/export/${format}`
          : `/drawings/d/${id}/export/${format}`
    return { url: new URL(path, docs).href, extension: EXPORT_EXTENSIONS[format] ?? format }
  }

  const folderViewUrl: GoogleDriveUrlHelper['folderViewUrl'] = (id, resourceKey) => {
    const url = new URL('/embeddedfolderview', drive)
    url.searchParams.set('id', id)
    return withKey(url, resourceKey)
  }

  const apiListUrl: GoogleDriveUrlHelper['apiListUrl'] = (folderId, pageToken) => {
    if (!DRIVE_ID_PATTERN.test(folderId)) throw new SyntaxError(`Not a Drive id: ${folderId}`)
    const url = new URL('/drive/v3/files', api)
    url.searchParams.set('q', `'${folderId}' in parents and trashed=false`)
    url.searchParams.set('fields', `nextPageToken,files(${DRIVE_API_ITEM_FIELDS})`)
    url.searchParams.set('pageSize', String(DRIVE_API_PAGE_SIZE))
    url.searchParams.set('supportsAllDrives', 'true')
    url.searchParams.set('includeItemsFromAllDrives', 'true')
    if (pageToken != null) url.searchParams.set('pageToken', pageToken)
    return url.href
  }

  const apiFileUrl: GoogleDriveUrlHelper['apiFileUrl'] = id => {
    const url = new URL(`/drive/v3/files/${encodeURIComponent(id)}`, api)
    url.searchParams.set('fields', DRIVE_API_ITEM_FIELDS)
    url.searchParams.set('supportsAllDrives', 'true')
    return url.href
  }

  const hostOf = (url: string): string | undefined => read(url)?.host.toLowerCase()

  const isSignIn: GoogleDriveUrlHelper['isSignIn'] = url => hostOf(url) === hosts.accounts

  const owns: GoogleDriveUrlHelper['owns'] = url => {
    const host = hostOf(url)
    return host != null && (host === hosts.drive || host === hosts.usercontent || host === hosts.docs)
  }

  return { parse, downloadUrl, exportOf, folderViewUrl, apiListUrl, apiFileUrl, isSignIn, owns }
}
