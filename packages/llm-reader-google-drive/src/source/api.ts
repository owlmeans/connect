import { logger } from '@owlmeans/log'
import { GoogleDriveFailure, GoogleDriveKind } from '../consts.js'
import { DRIVE_ID_PATTERN } from '../consts.local.js'
import { GoogleDriveError } from '../errors.js'
import type { GoogleDriveUrlHelper } from '../types.js'
import { DRIVE_API_MAX_PAGES, DRIVE_LISTING_BYTES, GOOGLE_APPS_KINDS, GOOGLE_APPS_PREFIX, GOOGLE_APPS_SHORTCUT, LOG_SCOPE } from './consts.local.js'
import type { DriveApiFile, DriveApiList, DriveHttp, DriveItem, DriveLister } from './types.local.js'

const log = logger(LOG_SCOPE)

/**
 * Folders listed through Drive API v3 with an API key (the `X-Goog-Api-Key` header, never the URL):
 * `files.list` pages of `'<id>' in parents and trashed=false`, with sizes and media types; a
 * shortcut is listed as its target; Google item types other than folders and editor files are left out.
 */
export const makeApiLister = (http: DriveHttp, urls: GoogleDriveUrlHelper, apiKey: string): DriveLister => {
  const headersOf = (id: string, resourceKey?: string): Record<string, string> => ({
    'x-goog-api-key': apiKey,
    accept: 'application/json',
    ...(resourceKey != null ? { 'x-goog-drive-resource-keys': `${id}/${resourceKey}` } : {}),
  })

  const json = async <T>(url: string, headers: Record<string, string>): Promise<T> => {
    const response = await http.get(url, { headers, maxBytes: DRIVE_LISTING_BYTES })
    const refused = await http.refusal(response)
    if (refused != null) throw refused
    try {
      return JSON.parse(await response.text()) as T
    } catch {
      throw new GoogleDriveError(`${GoogleDriveFailure.Unrecognized}:api-answer`)
    }
  }

  const itemOf = (file: DriveApiFile): DriveItem | undefined => {
    const shortcut = file.mimeType === GOOGLE_APPS_SHORTCUT ? file.shortcutDetails : undefined
    const id = shortcut != null ? shortcut.targetId : file.id
    const mime = shortcut != null ? shortcut.targetMimeType : file.mimeType
    const resourceKey = shortcut != null ? shortcut.targetResourceKey : file.resourceKey
    if (id == null || !DRIVE_ID_PATTERN.test(id)) return undefined
    const native = mime != null && mime.startsWith(GOOGLE_APPS_PREFIX)
    const kind = native ? GOOGLE_APPS_KINDS[mime] : GoogleDriveKind.File
    if (kind == null) return undefined
    const size = Number(file.size ?? NaN)
    return {
      id, kind, name: file.name != null && file.name !== '' ? file.name : id,
      ...(mime != null && !native ? { mime } : {}), ...(Number.isFinite(size) ? { size } : {}),
      ...(resourceKey != null && resourceKey !== '' ? { resourceKey } : {}),
    }
  }

  const list: DriveLister['list'] = async (folder, limit) => {
    const items: DriveItem[] = []
    let token: string | undefined
    let unsupported = 0
    let files = 0
    for (let page = 0; page < DRIVE_API_MAX_PAGES; page++) {
      const answer = await json<DriveApiList>(urls.apiListUrl(folder.id, token), headersOf(folder.id, folder.resourceKey))
      for (const file of answer.files ?? []) {
        const item = itemOf(file)
        if (item == null) {
          unsupported++
          continue
        }
        items.push(item)
        if (item.kind !== GoogleDriveKind.Folder) files++
      }
      token = answer.nextPageToken
      if (token == null || token === '' || files >= limit) break
    }
    log.debug('Listed a folder through the Drive API', { folder: folder.id, items: items.length, unsupported, more: token != null })
    return items
  }

  const resolve: DriveLister['resolve'] = async (_url, link) => {
    const item = itemOf(await json<DriveApiFile>(urls.apiFileUrl(link.id), headersOf(link.id, link.resourceKey)))
    if (item == null) throw new GoogleDriveError(`${GoogleDriveFailure.Unrecognized}:item-type`)
    return { ...item }
  }

  return { list, resolve }
}
