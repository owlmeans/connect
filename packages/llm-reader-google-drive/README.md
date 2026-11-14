# @owlmeans/llm-reader-google-drive

The Google Drive source of [`@owlmeans/llm-reader`](https://github.com/owlmeans/common/tree/main/packages/llm-reader):
a public Drive folder, file or Google Docs link given to `reader.collect` becomes the files behind it
— sub-folders included, editor files exported — downloaded by the reader under its guard and limits.
No Google account or API key is needed; an API key switches folder listing to Drive API v3.

## Installation

```sh
bun add @owlmeans/llm-reader-google-drive@^0.2.0-alpha.0 @owlmeans/llm-reader@^0.2.0-alpha.0
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
(`appendLlmReaderService(ctx, { sources: [createGoogleDriveSource()] })` in a context).

## What a link becomes

| Link | Entries |
|---|---|
| `drive.google.com/drive/folders/<id>` (`/drive/u/<n>/…`, `?usp=`, `?resourcekey=`), `folderview?id=` | every file, breadth-first down to `depth` sub-folder levels, at `<sub-folder>/<name>` |
| `drive.google.com/file/d/<id>/…`, `uc?id=`, `drive.usercontent.google.com/download?id=` | the file, named by Drive's `Content-Disposition` |
| `drive.google.com/open?id=<id>` | whatever Drive redirects it to (or the API reports) |
| `docs.google.com/{document,spreadsheets,presentation,drawings}/d/<id>/…` | the export: `docx`, `xlsx`, `pptx`, `png` unless `exports` says otherwise |
| any link that redirects onto one of these (a shortener) | the same, recognised from where it landed |

## API

`createGoogleDriveSource(options?)` → `ReaderSource`, `createGoogleDriveUrlHelper(options?)`,
`GoogleDriveError` (`reason`: `GoogleDriveFailure`), `GoogleDriveKind`, `GOOGLE_DRIVE_SOURCE`,
`DEFAULT_GOOGLE_DRIVE_ORIGINS`, `DEFAULT_GOOGLE_EXPORTS`, `DEFAULT_GOOGLE_DRIVE_DEPTH` (3),
`DEFAULT_GOOGLE_DRIVE_MAX_ENTRIES` (200), `DEFAULT_GOOGLE_DRIVE_MAX_FOLDERS` (50); types
`GoogleDriveSourceOptions` (`apiKey?`, `depth?`, `maxEntries?`, `maxFolders?`, `exports?`, `origins?`),
`GoogleDriveUrlOptions`, `GoogleDriveOrigins`, `GoogleExportFormats`, `GoogleDriveLink`,
`GoogleEditorKind`, `GoogleExport`, `GoogleDriveUrlHelper`.

## Notes

- Keyless folders come from Drive's static embedded folder view; files are probed with one ranged GET
  for their name, size and — behind Drive's "can't scan for viruses" form — the URL that serves the
  bytes. With `apiKey` (sent as `X-Goog-Api-Key`, never in a URL) sizes come from the API and only a
  file past Drive's 100 MiB scan limit is probed.
- A private link fails with `llm-reader:fetch:google-drive:not-public`, an exhausted quota with
  `quota`, a missing item with `not-found` — the collect's one failed item. A private file inside a
  public folder is left out and logged.
- With file-streams' pinned fetch injected into the reader, build it with `resolvers: []`: its Drive
  resolver refuses folder pages (`google-drive:resolver`) and rewrites exports to its own formats.
