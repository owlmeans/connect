# @owlmeans/llm-reader-google-drive

The Google Drive source of [`@owlmeans/llm-reader`](https://github.com/owlmeans/common/tree/main/packages/llm-reader):
a public Drive folder, file or Google Docs link given to `reader.collect` becomes the files behind it
— sub-folders included, editor files exported — downloaded by the reader under its guard and limits.
No Google account or API key is needed; an API key switches folder listing to Drive API v3.

## Installation

```sh
bun add @owlmeans/llm-reader-google-drive@^0.2.3 @owlmeans/llm-reader@^0.2.3
```

## Usage

```ts
import { createDirectoryCollectSink, createLlmReader } from '@owlmeans/llm-reader'
import { createGoogleDriveSource } from '@owlmeans/llm-reader-google-drive'

const reader = createLlmReader({ sources: [createGoogleDriveSource({ depth: 2, exports: { document: 'md' } })] })
const result = await reader.collect('https://drive.google.com/drive/folders/<id>?usp=share_link', {
  sink: createDirectoryCollectSink(dir), prefix: 'links/01-drive',
})
// result.kind === 'source', result.source === 'google-drive'
// files at links/01-drive/<name>, links/01-drive/<sub-folder>/<name>, Docs as <title>.md
```

The reader has no source registry in a context: pass the source in `LlmReaderOptions.sources`
(`appendLlmReaderService(ctx, { sources: [createGoogleDriveSource()] })` in a context). Sources are
consulted in order, before the reader's built-in S3 source.

## What a link becomes

| Link | Entries |
|---|---|
| `drive.google.com/drive/folders/<id>` (`/drive/u/<n>/…`, `?usp=`, `?resourcekey=`), `folderview?id=` | every file, breadth-first down to `depth` sub-folder levels, at `<sub-folder>/<name>` |
| `drive.google.com/file/d/<id>/…`, `uc?id=`, `drive.usercontent.google.com/download?id=` | the file, named by Drive's `Content-Disposition` |
| `drive.google.com/open?id=<id>` | whatever Drive redirects it to (or the API reports) |
| `docs.google.com/{document,spreadsheets,presentation,drawings}/d/<id>/…` | the export: `docx`, `xlsx`, `pptx`, `png` unless `exports` says otherwise |
| any link that redirects onto one of these (a shortener) | the same, recognised from where it landed |

## Configuration

`createGoogleDriveSource(options?)`:

| Option | Default | Purpose |
|---|---|---|
| `apiKey` | — | A Google API key with the Drive API enabled: folders are listed through Drive API v3 (pages, sizes, media types, shortcuts). Sent as the `X-Goog-Api-Key` header, never in a URL. |
| `depth` | `DEFAULT_GOOGLE_DRIVE_DEPTH` (3) | Sub-folder levels listed below the linked folder; `0` lists its own files only. |
| `maxEntries` | `DEFAULT_GOOGLE_DRIVE_MAX_ENTRIES` (200) | Entries one link expands to; the collect's `maxFiles + 1` caps it too. |
| `maxFolders` | `DEFAULT_GOOGLE_DRIVE_MAX_FOLDERS` (50) | Folders one link lists — each is one request. |
| `exports` | `DEFAULT_GOOGLE_EXPORTS` | `document` (`docx`, `pdf`, `odt`, `rtf`, `txt`, `epub`, `md`, `html` = a zip), `spreadsheet` (`xlsx`, `ods`, `pdf`, `csv`, `tsv`), `presentation` (`pptx`, `odp`, `pdf`, `txt`), `drawing` (`png`, `svg`, `pdf`, `jpg`). |
| `origins` | `DEFAULT_GOOGLE_DRIVE_ORIGINS` | `drive`, `usercontent`, `docs`, `accounts`, `api` — tests point them at a stand-in. |

## Security and limits

- Every request is the reader's guarded fetch — its address guard, plugins, transport and timeout,
  and the collect's abort signal; the source opens no connection of its own.
- Only public items are read. A private link fails with `llm-reader:fetch:google-drive:not-public`,
  an exhausted quota with `quota`, a missing item with `not-found`, a refused key with `api-key` —
  the collect's one failed item. A private file inside a public folder is left out and logged.
- Entry paths are relative to the linked folder; names lose `/`, `\` and control characters, and
  the collector confines every path.
- The walk is bounded by `depth`, `maxEntries`, `maxFolders` and the collect's `maxFiles`; a cut is
  logged, never thrown. A probe reads at most 256 KiB of an interstitial page.
- Logs carry ids, counts and reasons only — never an API key or a URL query.

## API

| Export | Purpose |
|---|---|
| `createGoogleDriveSource(options?)` | A `ReaderSource` named `google-drive`: `matches` (the URL alone), `recognizes` (a link that landed on Drive), `expand`. |
| `createGoogleDriveUrlHelper(options?)` | `parse(url)` → `GoogleDriveLink`, `downloadUrl`, `exportOf`, `folderViewUrl`, `apiListUrl`, `apiFileUrl`, `isSignIn`, `owns`. |
| `GoogleDriveError` | A `ReaderFetchError`: `llm-reader:fetch:google-drive:<reason>[:<detail>]`, `reason: GoogleDriveFailure`. |
| `GoogleDriveFailure` | `not-public`, `quota`, `not-found`, `api-key`, `not-a-link`, `unrecognized`, `resolver`, `status`. |
| `GoogleDriveKind` | `folder`, `file`, `document`, `spreadsheet`, `presentation`, `drawing`, `unresolved` (`open?id=`). |
| `GOOGLE_DRIVE_SOURCE`, `DEFAULT_GOOGLE_DRIVE_ORIGINS`, `DEFAULT_GOOGLE_EXPORTS`, `DEFAULT_GOOGLE_DRIVE_DEPTH`, `DEFAULT_GOOGLE_DRIVE_MAX_ENTRIES`, `DEFAULT_GOOGLE_DRIVE_MAX_FOLDERS` | `'google-drive'`, Google's hosts, the export defaults, 3, 200, 50. |
| `GoogleDriveSourceOptions`, `GoogleDriveUrlOptions`, `GoogleDriveOrigins`, `GoogleExportFormats`, `GoogleDriveLink`, `GoogleEditorKind`, `GoogleExport`, `GoogleDriveUrlHelper` | Types. |

The package has one entry point; there are no subpath exports.

## Common pitfalls

- Keyless folders come from Drive's static embedded folder view; files are probed with one ranged GET
  for their name, size and — behind Drive's "can't scan for viruses" form — the URL that serves the
  bytes. With `apiKey` sizes come from the API and only a file past Drive's 100 MiB scan limit is
  probed.
- With file-streams' pinned fetch injected into the reader, build it with `resolvers: []`: its Drive
  resolver refuses folder pages (`google-drive:resolver`) and rewrites exports to its own formats.
- An API key sees public items only; a private item answers 404 (`not-found`) through the API.

## Related packages

- [`@owlmeans/llm-reader`](https://github.com/owlmeans/common/tree/main/packages/llm-reader) — the reader, `ReaderSource`, the collector, sinks, guard and limits
- [`@owlmeans/file-streams`](https://github.com/owlmeans/common/tree/main/packages/file-streams) — `@owlmeans/file-streams/fetch`: the pinned `fetch` a reader can take
- [`@owlmeans/llm-reader-playwright`](https://github.com/owlmeans/common/tree/main/packages/llm-reader-playwright) — the reader's browser renderer

The `llm-reader-google-drive` skill covers the same source for agents.

<!-- owlmeans:agent-guidance:start -->
## Agent guidance

This package ships embedded agent skills under `agent-meta/`. After installing your
`@owlmeans/*` packages, run the OwlMeans agent-skills installer to place them into
your project's skill store (`.agents/skills/`):

```sh
npx @owlmeans/agent-skills@^0.2.3
```

The embedded files are version-matched to this package release. Do not edit them
directly — they are regenerated on each publish. To contribute guidance edits,
open a PR against the source monorepo.
<!-- owlmeans:agent-guidance:end -->
