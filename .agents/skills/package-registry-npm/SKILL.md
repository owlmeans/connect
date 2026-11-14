---
name: package-registry-npm
description: "How to use @owlmeans/package-registry-npm (OwlMeans connect) — the npm adapter of @owlmeans/package-inspector's PackageRegistry port: createNpmRegistry (packuments with a size cap and the latest-version fallback, bulk weekly download counts with a cache and 429 retries, name neighbours priced from the inspector's variants, the repository's own package.json on GitHub/GitLab), appendNpmRegistry (explicit registration in the context's package inspector host), the repository locator, npm's security-holding marker and timeouts over an injectable fetch. Auto-invoked when verifying an npm package a person named (typosquat, lookalike, security holding package), reading npm packuments or download counts, or debugging an npm verdict that came back unknown."
user-invocable: false
---

# @owlmeans/package-registry-npm

**Layer:** Server (Node/Bun; any runtime with `fetch`)
**Repo:** OwlMeans connect — the npm half; the verdict engine, rules and host are common's
`@owlmeans/package-inspector`
**Install:** `"@owlmeans/package-registry-npm": "^0.2.0-alpha.0"` in `dependencies`

## Public API

| Symbol | Kind | Purpose |
|---|---|---|
| `createNpmRegistry(opts?)` | factory | `NpmRegistry` (a `PackageRegistry`, `id` `'npm'`): `manifest`, `downloads`, `neighbours`, `repositoryManifest` |
| `appendNpmRegistry(ctx, opts?)` | fn | `appendPackageInspector(ctx, { registry: createNpmRegistry(opts), thresholds, concurrency, now })` — reach it with `ensurePackageInspectorService(ctx).get(NPM_REGISTRY)` |
| `createRepositoryLocator(hosts?)` / `repositoryLocator` | helper | `locate(url, directory?)` → `{ host, path, directory? } \| null`, `webOf(location)`, `rawUrlOf(location, file)` |
| `NpmRegistryOptions` | interface | `fetch?`, `registryUrl?`, `downloadsUrl?`, `repositoryHosts?` (`{ githubRaw?, gitlab? }`), `timeoutMs?` (10 s), `userAgent?`, `retries?` (3), `maxNeighbours?` (5), `maxVariants?` (1024), `maxScopedLookups?` (8), `maxDocumentBytes?` (4 MiB), `maxReadmeChars?` (64 000), `cacheTtlMs?` (10 min, `0` off) |
| `AppendNpmRegistryOptions` | interface | `NpmRegistryOptions` + the inspector's `thresholds?`, `concurrency?`, `now?` |
| `NPM_REGISTRY`, `NPM_REGISTRY_URL`, `NPM_DOWNLOADS_URL`, `NPM_PACKAGE_PAGE_URL`, `NPM_HOLDING_VERSION`, `NPM_HOLDING_DESCRIPTION`, `NPM_INSTALL_SCRIPTS`, `NPM_BULK_LIMIT`, `NPM_*` | const | `'npm'`, `https://registry.npmjs.org`, `https://api.npmjs.org`, `https://www.npmjs.com/package`, `'0.0.1-security'`, `'security holding package'`, `preinstall`/`install`/`postinstall`, `128` … |
| `RepositoryHost` | enum | `github`, `gitlab` |
| `NpmFetch`, `NpmRepositoryHosts`, `NpmRegistry`, `RepositoryLocation`, `RepositoryLocator` | types | |

## Usage

```typescript
import { createPackageInspector, PackageVerdictKind } from '@owlmeans/package-inspector'
import { createNpmRegistry } from '@owlmeans/package-registry-npm'

const inspector = createPackageInspector({ registry: createNpmRegistry({ timeoutMs: 8_000 }) })
const [dayjs, loadsh] = await inspector.inspectAll(['dayjs', 'loadsh'])
// dayjs: genuine (provenance, popular); loadsh: suspicious, lookalikeOf 'lodash', copied-description
```

## What each member reads

- **`manifest`** — the full packument `GET <registry>/<name>` (scoped: `@scope%2fname`), read up to
  `maxDocumentBytes` (a declared length past the cap skips the read). Larger documents — `react`,
  `vite`, `next`, `typescript`, `@types/node` run to 7–40 MB — are read through
  `<registry>/<name>/latest` instead, the readme from the repository (`README.md`, `readme.md`), and
  the facts are `partial` (no dates, no version count). Holding = latest `0.0.1-security` or the
  description "security holding package". `unpublished` = `time.unpublished` with no versions.
  `installScripts` = the latest version's `preinstall`/`install`/`postinstall`, plus `install` for a
  `gypfile`. `provenance` = `dist.attestations.provenance`. `entry` = the latest version's `type`,
  `main`, `module`, `types` (else `typings`) and `exports` (JSON values only), absent when it declares none.
- **`downloads`** — `GET <downloads>/downloads/point/last-week/<a,b,…>`: unscoped names in bulk calls of
  ≤ 128 (npm answers 400 past that), two in flight; scoped names one call each (npm refuses them in
  bulk). A missing name is `null` in the bulk map, a 404 alone. A single name gets npm's single-package
  shape. Counts are cached per registry instance.
- **`neighbours`** — `packageNameHelper.variants(name)` (≤ `maxVariants`, ≤ `maxScopedLookups` scoped
  ones) priced through `downloads`; the existing ones, most downloaded first, ≤ `maxNeighbours`. npm
  search is never used: `/-/v1/search?text=loadsh` does not return `lodash`.
- **`repositoryManifest`** — `package.json` at `HEAD` of the repository on GitHub
  (`raw.githubusercontent.com/<o>/<r>/HEAD/<dir>/package.json`) or GitLab (`/-/raw/HEAD/`), at the
  declared `directory`; `root` when it is `private` or declares workspaces. Other hosts → `null`.

Every request carries `user-agent`, a timeout, and is retried on 429/502/503/504 after `retry-after`
(else 1 s, 2 s, 4 s; ≤ 10 s each, `retries` times) — npm's download counts API throttles bursts.

## Rules

- A 404 is `null`; anything else throws `PackageRegistryError` (`npm:<packument|latest|downloads|repository|readme>:<subject>:<status|timeout|unreachable|malformed>`).
  The inspector turns that into an `unknown` verdict, so a throttled npm never yields `genuine`.
- Pass `fetch` for a pinned or proxied client; keep the defaults' public hosts in production.
- Register only through `appendNpmRegistry(ctx, opts)` (or pass the registry to
  `createPackageInspector`) — nothing registers on import.
- Tests: offline specs run against a real local HTTP stand-in (`tests/context.ts` `startStandIn`:
  packuments, bulk downloads with `null`s, the 128 limit, raw repository files, 404s, a streamed
  oversized packument, a throttled call). The live spec is gated by `PACKAGE_REGISTRY_NPM_LIVE=1`:
  `dayjs` genuine, `loadsh` suspicious lookalike of `lodash` with a copied description, `momnet`
  holding, a random name `not-found`.
