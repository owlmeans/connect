import { GoogleDriveKind } from '../consts.js'
import type { GoogleEditorKind } from '../types.js'

/** The Docs path segment of each editor kind. */
export const EDITOR_PATHS: Readonly<Record<string, GoogleEditorKind>> = Object.freeze({
  document: GoogleDriveKind.Document,
  spreadsheets: GoogleDriveKind.Spreadsheet,
  presentation: GoogleDriveKind.Presentation,
  drawings: GoogleDriveKind.Drawing,
})

/** An export format whose file extension differs from its name — Docs' web page export is a zip. */
export const EXPORT_EXTENSIONS: Readonly<Record<string, string>> = Object.freeze({ html: 'zip' })

/** The Drive API fields of one listed child. */
export const DRIVE_API_ITEM_FIELDS = 'id,name,mimeType,size,resourceKey,shortcutDetails(targetId,targetMimeType,targetResourceKey)'

/** Children per Drive API page (the API's maximum). */
export const DRIVE_API_PAGE_SIZE = 1000
