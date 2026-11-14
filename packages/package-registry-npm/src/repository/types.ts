import type { RepositoryHost } from '../consts.js'

/** A repository located on a host the adapter can read. */
export interface RepositoryLocation {
  host: RepositoryHost
  /** `owner/name` — on GitLab `group/subgroup/name`. */
  path: string
  /** The package's directory inside the repository. */
  directory?: string
}

/**
 * Locates a declared repository on GitHub or GitLab, whatever form it was declared in:
 * `git+https://github.com/o/r.git`, `git://…`, `git+ssh://git@…`, `git@github.com:o/r.git`,
 * `github:o/r`, `gitlab:g/r`, the bare `o/r` shorthand, and browse URLs whose `tree/<ref>/<dir>`
 * names the directory.
 */
export interface RepositoryLocator {
  /** The location; `null` for another host or an address it cannot read. An explicit `directory` wins over a browse path. */
  locate: (url: string, directory?: string) => RepositoryLocation | null
  /** The browsable https page of the repository (and its directory) on the public host. */
  webOf: (location: RepositoryLocation) => string
  /** Where the raw `file` at the location's directory (or root) is read, at the default branch. */
  rawUrlOf: (location: RepositoryLocation, file: string) => string
}
