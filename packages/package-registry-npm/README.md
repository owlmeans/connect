# @owlmeans/package-registry-npm

The npm registry adapter of [`@owlmeans/package-inspector`](https://github.com/owlmeans/common/tree/main/packages/package-inspector):
packuments and readmes, bulk weekly download counts of a name's neighbours, and the repository's own
`package.json` name check — so the inspector can tell `dayjs` (genuine) from `loadsh` (a lookalike of
`lodash` with its description copied) or `momnet` (an npm security holding package).

## Installation

```sh
bun add @owlmeans/package-registry-npm@^0.2.2-alpha.0 @owlmeans/package-inspector@^0.2.2-alpha.0
```

## Usage

```ts
import { createPackageInspector, PackageVerdictKind } from '@owlmeans/package-inspector'
import { createNpmRegistry } from '@owlmeans/package-registry-npm'

const inspector = createPackageInspector({ registry: createNpmRegistry() })
const verdict = await inspector.inspect('loadsh')
// verdict.verdict === PackageVerdictKind.Suspicious, verdict.lookalikeOf === 'lodash'
```

In a context:

```ts
import { ensurePackageInspectorService } from '@owlmeans/package-inspector'
import { appendNpmRegistry, NPM_REGISTRY } from '@owlmeans/package-registry-npm'

appendNpmRegistry(context, { timeoutMs: 8_000, thresholds: { popularDownloads: 500_000 } })
const inspector = ensurePackageInspectorService(context).get(NPM_REGISTRY)
```

## Configuration

`createNpmRegistry(options?)`; `appendNpmRegistry(ctx, options?)` takes the same options plus the
inspector's `thresholds`, `concurrency` and `now`.

| Option | Default | Purpose |
|---|---|---|
| `fetch` | the global `fetch` | The one call the adapter makes — a pinned or proxied client, or a test stand-in. |
| `registryUrl` | `NPM_REGISTRY_URL` (`https://registry.npmjs.org`) | Where packuments are read. |
| `downloadsUrl` | `NPM_DOWNLOADS_URL` (`https://api.npmjs.org`) | Where download counts are read. |
| `repositoryHosts` | `{ githubRaw: GITHUB_RAW_URL, gitlab: GITLAB_URL }` | Where repository manifests are read. |
| `timeoutMs` | `NPM_TIMEOUT` (10 s) | Per request, headers and body. |
| `userAgent` | `NPM_USER_AGENT` | Sent with every request. |
| `retries` | `NPM_RETRIES` (3) | Retries of a 429/502/503/504, after `retry-after` (else 1 s doubling, ≤ 10 s). |
| `maxNeighbours` · `maxVariants` · `maxScopedLookups` | 5 · 1024 · 8 | Neighbours returned; name variants priced; scoped variants looked up one by one. |
| `maxDocumentBytes` | `NPM_MAX_DOCUMENT_BYTES` (4 MiB) | A larger packument is read through its latest version (`partial` facts). |
| `maxReadmeChars` | `NPM_MAX_README_CHARS` (64 000) | A longer readme is cut (`readmeTruncated`). |
| `cacheTtlMs` | `NPM_CACHE_TTL` (10 min) | How long a download count is reused; `0` disables the cache. |

## Security and limits

- Every request carries a timeout and a byte cap (4 MiB packument, 1 MiB for a version document, a
  downloads answer or a repository manifest); a packument declared past its cap is not read.
- Install scripts are reported by hook name only, never their commands.
- A 404 is `null`; any other failure throws `PackageRegistryError`
  (`npm:<packument|latest|downloads|repository|readme>:<subject>:<status|timeout|unreachable|malformed>`),
  which the inspector turns into an `unknown` verdict — a throttled npm never yields `genuine`.
- Repository manifests are read only from GitHub and GitLab, at `HEAD`; other hosts are `null`.
- Nothing registers on import: call `appendNpmRegistry` or pass the registry to `createPackageInspector`.

## API

| Export | Purpose |
|---|---|
| `createNpmRegistry(options?)` | An `NpmRegistry` (`PackageRegistry`, id `'npm'`): `manifest`, `downloads`, `neighbours`, `repositoryManifest`. |
| `appendNpmRegistry(ctx, options?)` | Register an npm inspector in the context's package inspector host under `NPM_REGISTRY`. |
| `createRepositoryLocator(hosts?)` · `repositoryLocator` | `locate(url, directory?)` → `RepositoryLocation \| null`, `webOf(location)`, `rawUrlOf(location, file)`. |
| `RepositoryHost` | `github`, `gitlab`. |
| `NPM_REGISTRY`, `NPM_REGISTRY_URL`, `NPM_DOWNLOADS_URL`, `NPM_PACKAGE_PAGE_URL`, `NPM_DOWNLOADS_PERIOD` | The registry id, npm's hosts and the counted period (`last-week`). |
| `NPM_BULK_LIMIT`, `NPM_BULK_CONCURRENCY`, `NPM_SCOPED_CONCURRENCY`, `NPM_RETRIES`, `NPM_RETRY_STATUSES`, `NPM_RETRY_BACKOFF`, `NPM_RETRY_MAX_WAIT`, `NPM_TIMEOUT` | Request pacing: 128 names a bulk call, 2 calls in flight, retry policy, 10 s timeout. |
| `NPM_MAX_DOCUMENT_BYTES`, `NPM_MAX_SMALL_BYTES`, `NPM_MAX_README_CHARS`, `NPM_README_FILES`, `NPM_MAX_NEIGHBOURS`, `NPM_MAX_VARIANTS`, `NPM_MAX_SCOPED_LOOKUPS`, `NPM_CACHE_TTL`, `NPM_CACHE_SIZE`, `NPM_USER_AGENT` | Caps and defaults. |
| `NPM_HOLDING_VERSION`, `NPM_HOLDING_DESCRIPTION`, `NPM_INSTALL_SCRIPTS` | npm's security-holding marker (`0.0.1-security`) and the install hooks read. |
| `GITHUB_RAW_URL`, `GITHUB_URL`, `GITLAB_URL` | The repository hosts. |
| `NpmRegistry`, `NpmRegistryOptions`, `AppendNpmRegistryOptions`, `NpmFetch`, `NpmRepositoryHosts`, `RepositoryLocation`, `RepositoryLocator` | Types. |

The package has one entry point; there are no subpath exports.

## Common pitfalls

- Neighbours come from name variants priced in bulk (`api.npmjs.org`, ≤ 128 names per call); npm
  search does not surface `lodash` for `loadsh`.
- A packument past `maxDocumentBytes` (4 MiB) is read through its latest version, the readme from the
  repository; such facts are `partial` (no dates, no version count).
- Download counts are cached per registry instance for `cacheTtlMs`.

## Related packages

- [`@owlmeans/package-inspector`](https://github.com/owlmeans/common/tree/main/packages/package-inspector) — the verdict engine, its rules, thresholds and context host
- [`@owlmeans/web-research`](https://github.com/owlmeans/common/tree/main/packages/web-research) — package research and skills built on the inspector's verdicts

The `package-registry-npm` skill covers the same adapter for agents.

<!-- owlmeans:agent-guidance:start -->
## Agent guidance

This package ships embedded agent skills under `agent-meta/`. After installing your
`@owlmeans/*` packages, run the OwlMeans agent-skills installer to place them into
your project's skill store (`.agents/skills/`):

```sh
npx @owlmeans/agent-skills@^0.2.2-alpha.0
```

The embedded files are version-matched to this package release. Do not edit them
directly — they are regenerated on each publish. To contribute guidance edits,
open a PR against the source monorepo.
<!-- owlmeans:agent-guidance:end -->
