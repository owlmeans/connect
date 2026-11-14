import type { PackageInspectorOptions, PackageRegistry } from '@owlmeans/package-inspector'

/** The one call the adapter makes — `fetch`, or a stand-in a test injects. */
export interface NpmFetch {
  (url: string, init: RequestInit): Promise<Response>
}

/** Where repository manifests are read from — the public hosts unless a test points elsewhere. */
export interface NpmRepositoryHosts {
  /** GitHub's raw file host. Default `GITHUB_RAW_URL`. */
  githubRaw?: string
  /** GitLab's host (raw files under `/-/raw/`). Default `GITLAB_URL`. */
  gitlab?: string
}

export interface NpmRegistryOptions {
  /** Default: the global `fetch`. */
  fetch?: NpmFetch
  /** Default `NPM_REGISTRY_URL`. */
  registryUrl?: string
  /** Default `NPM_DOWNLOADS_URL`. */
  downloadsUrl?: string
  repositoryHosts?: NpmRepositoryHosts
  /** Per request, headers and body. Default `NPM_TIMEOUT`. */
  timeoutMs?: number
  /** Default `NPM_USER_AGENT`. */
  userAgent?: string
  /** Retries of a throttled (429) or briefly unavailable (502–504) request. Default `NPM_RETRIES`. */
  retries?: number
  /** Default `NPM_MAX_NEIGHBOURS`. */
  maxNeighbours?: number
  /** Default `NPM_MAX_VARIANTS`. */
  maxVariants?: number
  /** Default `NPM_MAX_SCOPED_LOOKUPS`. */
  maxScopedLookups?: number
  /** Default `NPM_MAX_DOCUMENT_BYTES`. */
  maxDocumentBytes?: number
  /** Default `NPM_MAX_README_CHARS`. */
  maxReadmeChars?: number
  /** Default `NPM_CACHE_TTL`; `0` disables the download count cache. */
  cacheTtlMs?: number
}

/** The npm registry behind `@owlmeans/package-inspector`'s port. */
export interface NpmRegistry extends PackageRegistry {}

export interface AppendNpmRegistryOptions extends NpmRegistryOptions, Omit<PackageInspectorOptions, 'registry'> {}
