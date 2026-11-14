---
name: llm-reader-google-drive
description: "How to use @owlmeans/llm-reader-google-drive (OwlMeans connect) — the Google Drive ReaderSource of @owlmeans/llm-reader: createGoogleDriveSource (public folder links listed keyless from Drive's embedded folder view or through Drive API v3 with an API key, breadth-first sub-folders bounded by depth/maxEntries/maxFolders and the collect's maxFiles, file links turned into direct usercontent downloads probed for name, size and Drive's virus-scan form, Docs/Sheets/Slides/Drawings exported in configurable formats, open?id= and shortened links resolved), createGoogleDriveUrlHelper, GoogleDriveError reasons (not-public, quota, not-found, api-key, resolver) and the pinned-fetch caveat. Auto-invoked when collecting a Google Drive or Google Docs link with the reader, wiring reader sources, or debugging a Drive link that came back failed, empty or as HTML."
user-invocable: false
---

# @owlmeans/llm-reader-google-drive

**Layer:** Server (Node / Bun — wherever `@owlmeans/llm-reader` runs)
**Repo:** OwlMeans connect — the Drive half; the collector, sinks, guard and limits are common's
`@owlmeans/llm-reader` (its `collect` part)
**Install:** `"@owlmeans/llm-reader-google-drive": "^0.2.0-alpha.0"` beside `@owlmeans/llm-reader`

## Public API

| Symbol | Kind | Purpose |
|---|---|---|
| `createGoogleDriveSource(opts?)` | factory | A `ReaderSource` named `google-drive`: `matches` (URL alone), `recognizes` (a link that landed on Drive), `expand` |
| `createGoogleDriveUrlHelper(opts?)` | helper | `parse(url)` → `GoogleDriveLink` (`kind`, `id`, `resourceKey?`), `downloadUrl`, `exportOf`, `folderViewUrl`, `apiListUrl`, `apiFileUrl`, `isSignIn`, `owns` |
| `GoogleDriveSourceOptions` | interface | `apiKey?`, `depth?` (3), `maxEntries?` (200), `maxFolders?` (50), `exports?`, `origins?` |
| `GoogleExportFormats` | interface | `document` (`docx` · pdf, odt, rtf, txt, epub, md, html = zip), `spreadsheet` (`xlsx` · ods, pdf, csv, tsv), `presentation` (`pptx` · odp, pdf, txt), `drawing` (`png` · svg, pdf, jpg) |
| `GoogleDriveOrigins` | interface | `drive`, `usercontent`, `docs`, `accounts`, `api` — tests point them at a stand-in |
| `GoogleDriveError` | error | `ReaderFetchError` subclass, message `llm-reader:fetch:google-drive:<reason>`, `reason: GoogleDriveFailure` |
| `GoogleDriveFailure` | enum | `not-public`, `quota`, `not-found`, `api-key`, `not-a-link`, `unrecognized`, `resolver`, `status` |
| `GoogleDriveKind` | enum | `folder`, `file`, `document`, `spreadsheet`, `presentation`, `drawing`, `unresolved` (`open?id=`) |
| `GOOGLE_DRIVE_SOURCE`, `DEFAULT_GOOGLE_DRIVE_ORIGINS`, `DEFAULT_GOOGLE_EXPORTS`, `DEFAULT_GOOGLE_DRIVE_{DEPTH,MAX_ENTRIES,MAX_FOLDERS}` | const | `'google-drive'`, Google's hosts, the export defaults, 3 / 200 / 50 |

## Usage

```ts
import { createDirectoryCollectSink, createLlmReader } from '@owlmeans/llm-reader'
import { createGoogleDriveSource } from '@owlmeans/llm-reader-google-drive'

const reader = createLlmReader({ sources: [createGoogleDriveSource({ exports: { document: 'md' } })] })
const result = await reader.collect(link, { sink: createDirectoryCollectSink(dir), prefix: 'links/01-drive' })
```

There is no source host in a context: a consumer passes the source in `LlmReaderOptions.sources`
(also through `appendLlmReaderService(ctx, { sources })`). Sources are consulted in order, before the
reader's built-in S3 source.

## What expand does

- **Links** (`parse`): `drive.google.com/drive/[u/<n>/|mobile/]folders/<id>`, `[embedded]folderview?id=`,
  `file/[u/<n>/]d/<id>`, `uc?id=`, `open?id=` (unresolved), `drive.usercontent.google.com/download?id=`,
  `docs.google.com/{document,spreadsheets,presentation,drawings}/[u/<n>/]d/<id>`; http or https; ids
  `[A-Za-z0-9_-]{10,}`; `resourcekey` kept. Forms, published `/d/e/…` documents and other hosts are not links.
- **`open?id=`**: keyless, Drive's 307 is followed and the landing URL parsed (fallback: a file); with a
  key, `files.get` tells the type.
- **Folders**, breadth-first from level 0 (the linked folder) while `level < depth` for sub-folders;
  entries stop at `min(maxEntries, limits.maxFiles + 1)` (one over, so the collector reports the
  `max-files` cut) and listings at `maxFolders`; a cut is a `warn` line, never an error. A folder seen
  twice is listed once. A sub-folder that fails is skipped (`warn`); the linked folder's failure throws.
  - Keyless: `GET <drive>/embeddedfolderview?id=<id>[&resourcekey=]` — static HTML parsed with
    linkedom: `div.flip-entry` (`id="entry-<id>"`), its `a[href]` (`/file/d/` file, `/drive/folders/`
    sub-folder, `docs.google.com/…` editor file), `.flip-entry-title` (the name), the icon's
    `…/type/<media type>` (the entry `mime`). No sizes. Other Google types (forms, sites) are left out.
  - With `apiKey`: `GET <api>/drive/v3/files?q='<id>' in parents and trashed=false` (all drives, 1000
    per page, ≤ 20 pages, paging stops once enough files are listed), header `X-Goog-Api-Key` (never
    the URL) and `X-Goog-Drive-Resource-Keys` for keyed links; sizes and media types from the API; a
    shortcut is listed as its target.
- **Entry paths** are `<sub-folder>/<name>` relative to the linked folder (the collector adds its
  prefix and dedupes `-2`); a name loses `/`, `\` and control characters, `.`/`..` become `_`, the
  extension stays.
- **Stored files** become `<usercontent>/download?id=<id>&export=download&confirm=t[&resourcekey=]`.
  A file whose size is unknown (keyless) or at least 100 MiB (Drive's scan limit) and not over the
  collect's `maxFileBytes` is **probed**: `GET` with `Range: bytes=0-0` (body ≤ 256 KiB) — an
  attachment gives the name (`Content-Disposition`, `filename*` first) and size (`Content-Range`);
  an HTML answer is Drive's warning page, whose `form#download-form` action and hidden inputs (or the
  legacy `uc?export=download&confirm=` link, on Drive's own hosts only) become the entry URL, ≤ 3
  steps. A probe Drive refuses leaves the file out (`warn`); a probe that fails on the wire keeps the
  plain URL for the collector to report.
- **Editor files** become `docs.google.com/document/d/<id>/export?format=<f>`,
  `/spreadsheets/d/<id>/export?format=<f>`, `/presentation/d/<id>/export/<f>`,
  `/drawings/d/<id>/export/<f>`; the name takes the format's extension (`html` → `.zip`).
- **A single file or editor link** is one entry, probed for its name (the export's
  `Content-Disposition` for an editor file).

## Rules

- Every request is `ReaderSourceContext.fetch` — the reader's guard, plugins, transport and timeout,
  the collect's signal. Entry URLs are direct: a plain GET returns the bytes.
- Refusals throw `GoogleDriveError`: Google's sign-in host (any hop), 401/403 or a "you need access"
  page → `not-public`; 429, a quota page or API rate-limit reasons → `quota`; 404 → `not-found` (an
  API key also gets 404 for a private item); an invalid key or a disabled Drive API → `api-key`. The
  collect turns it into the link's one `failed` item with the message as `reason`.
- **file-streams' pinned fetch**: inject it with `resolvers: []`. Its Drive resolver refuses the
  folder page (`google-drive:resolver`) and rewrites exports to its own formats; single files work
  through it either way.
- Logging scope `llm-reader-google-drive`: ids, counts and reasons only — never an API key or a URL query.
- Tests: `tests/source.spec.ts` runs a real reader over real local stand-ins (`tests/context.ts`
  `startDriveStandIn`: Drive's embedded-view markup, `open?id=` redirects, ranged usercontent
  downloads, the warning form, a quota page, Docs exports behind a redirect, the sign-in host, Drive
  API v3 in pages of two with a refused key, a shortener) plus direct `expand` over plain `fetch`.
  `tests/live.spec.ts` is gated by `LLM_READER_GDRIVE_LIVE=1`: a shared folder of three files checked
  by sha256, and one file link.

## External docs

- https://developers.google.com/drive/api/reference/rest/v3/files/list — `q`, `fields`, `pageToken`,
  `supportsAllDrives`/`includeItemsFromAllDrives`; API keys reach public files only.
- https://developers.google.com/drive/api/guides/resource-keys — `X-Goog-Drive-Resource-Keys: <id>/<key>`
  for links shared before the 2021 security update.
- https://cloud.google.com/docs/authentication/api-keys-use — `X-Goog-Api-Key` header instead of `key=`.
- Observed 2026-11: `embeddedfolderview` answers static HTML without cookies; usercontent honours
  `Range` (206 with `Content-Range`) and serves `application/octet-stream` with an attachment
  disposition; `open?id=` is a 307 to the item's page; `uc?id=` a 303 to usercontent; a missing item is 404.
