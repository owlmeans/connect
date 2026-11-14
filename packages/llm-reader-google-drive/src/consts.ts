import type { GoogleDriveOrigins, GoogleExportFormats } from './types.js'

/** The name the source expands links under (`CollectResult.source`). */
export const GOOGLE_DRIVE_SOURCE = 'google-drive'

/** Where Google answers; tests point these at a stand-in. */
export const DEFAULT_GOOGLE_DRIVE_ORIGINS: Readonly<Required<GoogleDriveOrigins>> = Object.freeze({
  drive: 'https://drive.google.com',
  usercontent: 'https://drive.usercontent.google.com',
  docs: 'https://docs.google.com',
  accounts: 'https://accounts.google.com',
  api: 'https://www.googleapis.com',
})

/** The format each Google editor file is exported as unless `exports` names another. */
export const DEFAULT_GOOGLE_EXPORTS: Readonly<Required<GoogleExportFormats>> = Object.freeze({
  document: 'docx', spreadsheet: 'xlsx', presentation: 'pptx', drawing: 'png',
})

/** Sub-folder levels listed below the linked folder (`0` = its own files only). */
export const DEFAULT_GOOGLE_DRIVE_DEPTH = 3

/** Entries one link expands to at most — under the collect's own `maxFiles + 1`. */
export const DEFAULT_GOOGLE_DRIVE_MAX_ENTRIES = 200

/** Folders one link lists at most (each is one request). */
export const DEFAULT_GOOGLE_DRIVE_MAX_FOLDERS = 50

/** What a Drive link points at. */
export enum GoogleDriveKind {
  Folder = 'folder',
  /** A stored file — bytes behind the usercontent download. */
  File = 'file',
  Document = 'document',
  Spreadsheet = 'spreadsheet',
  Presentation = 'presentation',
  Drawing = 'drawing',
  /** An `open?id=` link: Drive itself tells what it is. */
  Unresolved = 'unresolved',
}

/** Why a link or an entry could not be expanded — the `reason` of a `GoogleDriveError`. */
export enum GoogleDriveFailure {
  /** Shared privately: Google answered with its sign-in page, 401/403 or "you need access". */
  NotPublic = 'not-public',
  /** Download or API quota exhausted ("too many users have viewed or downloaded", 429, rate limits). */
  Quota = 'quota',
  /** Drive answered 404 — no such item, or one an API key may not see. */
  NotFound = 'not-found',
  /** The Drive API refused the key (invalid, or the Drive API not enabled for it). */
  ApiKey = 'api-key',
  /** The URL is not a Drive or Docs link this source reads. */
  NotALink = 'not-a-link',
  /** A Drive answer this source does not know how to read. */
  Unrecognized = 'unrecognized',
  /** A file-streams Drive resolver inside the injected fetch refused the folder page. */
  Resolver = 'resolver',
  /** Any other refusing status (`status:<code>`). */
  Status = 'status',
}
