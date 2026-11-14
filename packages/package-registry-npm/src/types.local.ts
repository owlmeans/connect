/** A repository as npm documents declare it. */
export type NpmRepositoryField = string | { type?: string, url?: string, directory?: string }

/** The fields of one version's document the adapter reads. */
export interface NpmVersion {
  name?: string
  version?: string
  description?: string
  deprecated?: string | boolean
  scripts?: Record<string, unknown>
  gypfile?: boolean
  repository?: NpmRepositoryField
  homepage?: string
  license?: string | { type?: string }
  maintainers?: unknown[]
  dist?: { attestations?: { url?: string, provenance?: unknown } }
  /** The module system of its `.js` files (`module`, `commonjs`). */
  type?: string
  main?: string
  module?: string
  types?: string
  /** The older spelling of `types`. */
  typings?: string
  exports?: unknown
}

/** The fields of a full packument the adapter reads. */
export interface NpmPackument {
  name?: string
  description?: string
  'dist-tags'?: Record<string, string>
  versions?: Record<string, NpmVersion>
  time?: Record<string, unknown> & { created?: string, modified?: string, unpublished?: unknown }
  maintainers?: unknown[]
  repository?: NpmRepositoryField
  homepage?: string
  license?: string | { type?: string }
  readme?: string
}

/** One package's weekly count, alone or as a bulk entry. */
export interface NpmDownloadsPoint {
  downloads?: number
  package?: string
}

/** A bulk answer: name → its point, `null` for a name npm does not know. */
export interface NpmDownloadsBulk {
  [name: string]: NpmDownloadsPoint | null
}
