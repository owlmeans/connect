import type { SourceFetchInit } from '@owlmeans/llm-reader'
import type { GoogleDriveKind } from '../consts.js'
import type { GoogleDriveError } from '../errors.js'
import type { GoogleDriveLink } from '../types.js'

/** One folder to list, where its files go and how deep it is. */
export interface DriveFolder {
  id: string
  resourceKey?: string
  /** The folder's path inside the linked folder, `''` or ending in `/`. */
  prefix: string
  /** `0` for the linked folder. */
  level: number
}

/** A folder's child as a listing names it. */
export interface DriveItem {
  id: string
  kind: GoogleDriveKind
  name: string
  /** Its real media type — never a Google item type. */
  mime?: string
  size?: number
  resourceKey?: string
}

/** A link with what Drive told about it. */
export interface ResolvedLink extends GoogleDriveLink {
  name?: string
  mime?: string
  size?: number
}

/** A file's bytes: the URL a plain GET downloads, with what Drive declared. */
export interface ProbedFile {
  url: string
  name?: string
  size?: number
}

/** One way of listing Drive folders — the keyless embedded view, or Drive API v3. */
export interface DriveLister {
  /** A folder's children, up to about `limit`. Throws `GoogleDriveError` when Drive refuses. */
  list: (folder: DriveFolder, limit: number) => Promise<DriveItem[]>
  /** What an `open?id=` link points at. */
  resolve: (url: string, link: GoogleDriveLink) => Promise<ResolvedLink>
}

/** Downloads asked before they are handed to the collector. */
export interface DriveProbe {
  /**
   * A stored file's download followed through Drive's warning form: a URL that serves the bytes to a
   * plain GET, its name and size. Throws `GoogleDriveError` for a private, missing or quota-bound file.
   */
  file: (id: string, resourceKey?: string) => Promise<ProbedFile>
  /** An editor file's export, asked for its name (its body is dropped). */
  exported: (url: string) => Promise<ProbedFile>
}

/** Requests to Google and the reading of its refusals. */
export interface DriveHttp {
  /** A GET through the reader's guarded fetch; a file-streams Drive resolver's refusal becomes `GoogleDriveError('resolver')`. */
  get: (url: string, init?: SourceFetchInit) => Promise<Response>
  /**
   * The refusal an answer stands for — Google's sign-in host, 401/403/404/429, quota and API-key
   * errors, any other status ≥ 400 — or `undefined` for a usable answer. Reads the body of a refusal only.
   */
  refusal: (response: Response) => Promise<GoogleDriveError | undefined>
  /** What an HTML page served instead of the expected answer says: quota, sign-in, no access. */
  pageFailure: (page: string) => GoogleDriveError | undefined
  /** A body read as text; `''` when it cannot be read. */
  text: (response: Response) => Promise<string>
  /** Drop a body that is not read. */
  discard: (response: Response) => Promise<void>
}

/** A Drive API v3 file resource — the fields asked for. */
export interface DriveApiFile {
  id?: string
  name?: string
  mimeType?: string
  size?: string
  resourceKey?: string
  shortcutDetails?: { targetId?: string, targetMimeType?: string, targetResourceKey?: string }
}

/** A Drive API v3 `files.list` page. */
export interface DriveApiList {
  nextPageToken?: string
  files?: DriveApiFile[]
}
