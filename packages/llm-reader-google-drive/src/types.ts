import type { GoogleDriveKind } from './consts.js'

/** The format each Google editor file exports as. */
export interface GoogleExportFormats {
  /** Docs: `docx` (default), `pdf`, `odt`, `rtf`, `txt`, `epub`, `md`, or `html` (a zip). */
  document?: 'docx' | 'pdf' | 'odt' | 'rtf' | 'txt' | 'epub' | 'md' | 'html'
  /** Sheets: `xlsx` (default), `ods`, `pdf`, `csv` or `tsv` (the first sheet). */
  spreadsheet?: 'xlsx' | 'ods' | 'pdf' | 'csv' | 'tsv'
  /** Slides: `pptx` (default), `odp`, `pdf` or `txt`. */
  presentation?: 'pptx' | 'odp' | 'pdf' | 'txt'
  /** Drawings: `png` (default), `svg`, `pdf` or `jpg`. */
  drawing?: 'png' | 'svg' | 'pdf' | 'jpg'
}

export interface GoogleDriveUrlOptions {
  /** Where Google answers; tests point these at a stand-in. */
  origins?: GoogleDriveOrigins
  /** Export formats of Docs, Sheets, Slides and Drawings. */
  exports?: GoogleExportFormats
}

/** Every one is an origin (`https://host[:port]`); links match its host over http or https. */
export interface GoogleDriveOrigins {
  drive?: string
  usercontent?: string
  docs?: string
  accounts?: string
  /** The Drive API (`/drive/v3/files`), used only with an `apiKey`. */
  api?: string
}

export interface GoogleDriveSourceOptions extends GoogleDriveUrlOptions {
  /**
   * A Google API key with the Drive API enabled: folders are listed through Drive API v3 (pages,
   * sizes, media types, shortcuts) instead of the keyless embedded folder view. Sent as the
   * `X-Goog-Api-Key` header — never in a URL.
   */
  apiKey?: string
  /** Sub-folder levels listed below the linked folder; `0` lists its own files only. Default 3. */
  depth?: number
  /** Entries one link expands to at most (the collect's `maxFiles + 1` caps it too). Default 200. */
  maxEntries?: number
  /** Folders one link lists at most — each costs a request. Default 50. */
  maxFolders?: number
}

/** A Drive or Docs link as read from its URL alone. */
export interface GoogleDriveLink {
  kind: GoogleDriveKind
  id: string
  /** The `resourcekey` of a link shared before Drive's 2021 security update. */
  resourceKey?: string
}

/** Google editor files — the kinds that are exported, not downloaded. */
export type GoogleEditorKind = GoogleDriveKind.Document | GoogleDriveKind.Spreadsheet | GoogleDriveKind.Presentation | GoogleDriveKind.Drawing

/** An editor file's export: where its bytes come from and the extension its name takes. */
export interface GoogleExport {
  url: string
  extension: string
}

/** Drive and Docs URLs read and built, against the configured origins. */
export interface GoogleDriveUrlHelper {
  /**
   * What a link points at: `drive/folders/<id>` (also `/drive/u/<n>/…`, `folderview`,
   * `embeddedfolderview`), `file/d/<id>`, `uc?id=`, a usercontent download, `open?id=` (unresolved),
   * `docs.google.com/{document,spreadsheets,presentation,drawings}/d/<id>` — `undefined` for anything else.
   */
  parse: (url: string) => GoogleDriveLink | undefined
  /** The direct bytes of a stored file — the large-file warning already confirmed (`confirm=t`). */
  downloadUrl: (id: string, resourceKey?: string) => string
  /** An editor file's export in the configured format. */
  exportOf: (kind: GoogleEditorKind, id: string) => GoogleExport
  /** The keyless, static listing page of a folder. */
  folderViewUrl: (id: string, resourceKey?: string) => string
  /** A Drive API v3 page of a folder's children. */
  apiListUrl: (folderId: string, pageToken?: string) => string
  /** A Drive API v3 item's metadata. */
  apiFileUrl: (id: string) => string
  /** Whether a URL is Google's sign-in host. */
  isSignIn: (url: string) => boolean
  /** Whether a URL is served by Drive itself — drive, usercontent or docs. */
  owns: (url: string) => boolean
}
