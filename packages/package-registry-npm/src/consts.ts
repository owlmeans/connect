/** The registry id the npm adapter registers under in the package inspector host. */
export const NPM_REGISTRY = 'npm'

/** The public npm registry: packuments at `/<name>`, a version's document at `/<name>/<version>`. */
export const NPM_REGISTRY_URL = 'https://registry.npmjs.org'

/** npm's download counts API: `/downloads/point/<period>/<names>`. */
export const NPM_DOWNLOADS_URL = 'https://api.npmjs.org'

/** The public page of a package: `<url>/<name>`. */
export const NPM_PACKAGE_PAGE_URL = 'https://www.npmjs.com/package'

/** The period every count covers. */
export const NPM_DOWNLOADS_PERIOD = 'last-week'

/** The most unscoped names one bulk downloads call accepts; scoped names are never bulk. */
export const NPM_BULK_LIMIT = 128

/** Bulk downloads calls in flight at once — npm's download counts API throttles bursts. */
export const NPM_BULK_CONCURRENCY = 2

/** Single scoped downloads calls in flight at once. */
export const NPM_SCOPED_CONCURRENCY = 2

/** How many times a throttled (429) or briefly unavailable request is retried. */
export const NPM_RETRIES = 3

/** The statuses that are retried. */
export const NPM_RETRY_STATUSES: readonly number[] = Object.freeze([429, 502, 503, 504])

/** The first backoff without a `retry-after`, in ms; it doubles per retry. */
export const NPM_RETRY_BACKOFF = 1_000

/** The longest single wait before a retry, in ms, whatever `retry-after` says. */
export const NPM_RETRY_MAX_WAIT = 10_000

/** Milliseconds before one request (headers and body) is abandoned. */
export const NPM_TIMEOUT = 10_000

/** The packument is read up to this many bytes; a larger one is read through the latest version's document. */
export const NPM_MAX_DOCUMENT_BYTES = 4 * 1024 * 1024

/** The cap of a version document, a downloads answer and a repository manifest. */
export const NPM_MAX_SMALL_BYTES = 1024 * 1024

/** A readme longer than this is cut (`readmeTruncated`). */
export const NPM_MAX_README_CHARS = 64_000

/** The readme files tried in a repository when the packument was too large to carry its readme. */
export const NPM_README_FILES: readonly string[] = Object.freeze(['README.md', 'readme.md'])

/** How many neighbours `neighbours` returns. */
export const NPM_MAX_NEIGHBOURS = 5

/** How many name variants are priced by downloads. */
export const NPM_MAX_VARIANTS = 1024

/** How many scoped variants are looked up — each one is a call of its own. */
export const NPM_MAX_SCOPED_LOOKUPS = 8

/** How long a download count is reused, in ms; `0` disables the cache. */
export const NPM_CACHE_TTL = 10 * 60_000

/** The most download counts kept. */
export const NPM_CACHE_SIZE = 20_000

/** The `user-agent` every request carries unless the options name another. */
export const NPM_USER_AGENT = '@owlmeans/package-registry-npm'

/** The version npm publishes over a removed malicious package's name. */
export const NPM_HOLDING_VERSION = '0.0.1-security'

/** The description of npm's security holding packages. */
export const NPM_HOLDING_DESCRIPTION = 'security holding package'

/** The lifecycle scripts npm runs while a package is installed. */
export const NPM_INSTALL_SCRIPTS: readonly string[] = Object.freeze(['preinstall', 'install', 'postinstall'])

/** Where GitHub serves a repository's raw files: `<url>/<owner>/<name>/<ref>/<path>`. */
export const GITHUB_RAW_URL = 'https://raw.githubusercontent.com'

export const GITHUB_URL = 'https://github.com'

/** GitLab's web host; raw files at `<url>/<path>/-/raw/<ref>/<file>`. */
export const GITLAB_URL = 'https://gitlab.com'

/** The repository hosts whose manifests the adapter reads. */
export enum RepositoryHost {
  GitHub = 'github',
  GitLab = 'gitlab',
}
