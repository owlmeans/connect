import type { NpmFetch } from '../types.js'
import type { PackageFacts } from '@owlmeans/package-inspector'
import type { RepositoryLocator } from '../repository/types.js'
import type { NpmPackument, NpmVersion } from '../types.local.js'

export interface NpmHttpOptions {
  fetch?: NpmFetch
  timeoutMs: number
  userAgent: string
  /** Retries of a throttled (429) or briefly unavailable (502–504) request. */
  retries: number
}

/** A document read with a size cap. */
export interface NpmDocument<T> {
  /** The parsed document (`null` when a JSON one was cut at the cap), or the text read. */
  body: T | null
  /** Larger than the cap: the rest was never read. */
  truncated: boolean
}

/** GET of JSON documents over the injected fetch, with a timeout and a size cap. */
export interface NpmHttp {
  /**
   * The document at `url`; `null` for a 404. A throttled or briefly unavailable answer is retried
   * after the server's `retry-after` (else a doubling backoff), at most `retries` times.
   *
   * @throws {PackageRegistryError} `<label>:<status>` for another failure status, `<label>:timeout`,
   *   `<label>:unreachable`, `<label>:malformed` for a body that is not JSON.
   */
  json: <T>(url: string, label: string, maxBytes: number) => Promise<NpmDocument<T> | null>
  /**
   * The text at `url`, its first `maxBytes` when longer (`truncated`); `null` for a 404.
   *
   * @throws {PackageRegistryError} as `json` does.
   */
  text: (url: string, label: string, maxBytes: number) => Promise<NpmDocument<string> | null>
}

export interface NpmFactsOptions {
  locator: RepositoryLocator
  maxReadmeChars: number
}

/** npm documents → the inspector's provider-neutral facts. */
export interface NpmFactsMapper {
  /**
   * The facts of `name` from its full packument, or — when the packument was too large to read —
   * from the latest version's own document alone (`partial`).
   */
  factsOf: (name: string, packument: NpmPackument | null, latest: NpmVersion | null) => PackageFacts
}
