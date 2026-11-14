# @owlmeans/package-registry-npm

The npm registry adapter of [`@owlmeans/package-inspector`](https://github.com/owlmeans/common/tree/main/packages/package-inspector):
packuments and readmes, bulk weekly download counts of a name's neighbours, and the repository's own
`package.json` name check — so the inspector can tell `dayjs` (genuine) from `loadsh` (a lookalike of
`lodash` with its description copied) or `momnet` (an npm security holding package).

## Installation

```sh
bun add @owlmeans/package-registry-npm@^0.2.0-alpha.0 @owlmeans/package-inspector@^0.2.0-alpha.0
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

## API

`createNpmRegistry(options?)`, `appendNpmRegistry(ctx, options?)`, `createRepositoryLocator(hosts?)`,
`repositoryLocator`, `RepositoryHost`, the `NPM_*`, `GITHUB_*` and `GITLAB_URL` constants; types
`NpmRegistry`, `NpmRegistryOptions`, `AppendNpmRegistryOptions`, `NpmFetch`, `NpmRepositoryHosts`,
`RepositoryLocation`, `RepositoryLocator`.

## Notes

- Neighbours come from name variants priced in bulk (`api.npmjs.org`, ≤ 128 names per call); npm
  search does not surface `lodash` for `loadsh`.
- A packument past `maxDocumentBytes` (4 MiB) is read through its latest version, the readme from the
  repository; such facts are `partial`.
- 404s are `null`; other failures throw `PackageRegistryError`; throttled calls are retried after
  `retry-after`.
- `fetch` is injectable; every request times out (`timeoutMs`, 10 s).
