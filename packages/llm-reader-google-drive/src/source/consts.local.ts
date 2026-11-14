import { GoogleDriveKind } from '../consts.js'

/** The log scope of the package. */
export const LOG_SCOPE = 'llm-reader-google-drive'

/** File downloads probed at once. */
export const DRIVE_PROBE_CONCURRENCY = 4

/** Requests one probe may take: the download, then Drive's warning form (and its legacy link). */
export const DRIVE_PROBE_STEPS = 3

/** Bytes of a probe's answer read — an interstitial or refusal page. */
export const DRIVE_PAGE_BYTES = 256 * 1024

/** Bytes of one folder listing (a page of the embedded view, a Drive API page). */
export const DRIVE_LISTING_BYTES = 4 * 1024 * 1024

/** Drive API pages read per folder at most. */
export const DRIVE_API_MAX_PAGES = 20

/**
 * Drive serves files below this size without its "can't scan for viruses" form; an entry whose size
 * is known and below it is not probed.
 */
export const DRIVE_SCAN_LIMIT_BYTES = 100 * 1024 * 1024

/** The media type prefix of Google's own item types — none has bytes of its own. */
export const GOOGLE_APPS_PREFIX = 'application/vnd.google-apps.'

/** The shortcut type; its target is listed in its place. */
export const GOOGLE_APPS_SHORTCUT = 'application/vnd.google-apps.shortcut'

/** The Google item types the source reads; every other `application/vnd.google-apps.*` is left out. */
export const GOOGLE_APPS_KINDS: Readonly<Record<string, GoogleDriveKind>> = Object.freeze({
  'application/vnd.google-apps.folder': GoogleDriveKind.Folder,
  'application/vnd.google-apps.document': GoogleDriveKind.Document,
  'application/vnd.google-apps.spreadsheet': GoogleDriveKind.Spreadsheet,
  'application/vnd.google-apps.presentation': GoogleDriveKind.Presentation,
  'application/vnd.google-apps.drawing': GoogleDriveKind.Drawing,
})

/** A refusal that means an exhausted download or API quota. */
export const QUOTA_PATTERN = /too many users have viewed or downloaded|quota|dailyLimitExceeded|userRateLimitExceeded|rateLimitExceeded|RESOURCE_EXHAUSTED/i

/** A Drive API refusal of the key itself. */
export const API_KEY_PATTERN = /API_KEY_INVALID|API key not valid|keyInvalid|keyExpired|accessNotConfigured|SERVICE_DISABLED|API_KEY_SERVICE_BLOCKED/

/** A page that asks to sign in or to request access. */
export const NOT_PUBLIC_PATTERN = /ServiceLogin|\/v3\/signin|you need access|request access|need permission/i

/** A refusal raised by a file-streams Drive resolver inside an injected fetch. */
export const RESOLVER_PATTERN = /resolver:google-drive/
