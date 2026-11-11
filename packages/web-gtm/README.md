# @owlmeans/web-gtm

The Google half of OwlMeans cookie consent. It registers **Google Consent Mode v2** with
`@owlmeans/consent`'s signal host, so every decision the consent store records reaches a Google tag
as `consent`/`update`; it emits the inline `<head>` script for any Google id — Tag Manager (`GTM-`),
GA4 (`G-`), Google tag (`GT-`), Google Ads (`AW-`), Floodlight (`DC-`) — with the Consent Mode
defaults declared **before** the loader runs; and it ships the tag-manager analytics sink for
`@owlmeans/log`, the head tag an Astro layout stamps, the id validator, the CSP host lists, the
cookie-policy disclosure for a tag, the `<noscript>` frame and a script-side loader for hosts that
cannot edit their HTML. It lives in OwlMeans connect because it names a provider; `@owlmeans/consent`
(common) names none and never depends on it. A web app or static site uses it whenever it runs a
Google tag. It does not render the consent dialog (`@owlmeans/web-consent`). The `web-gtm` skill
covers this package; the `consent` skill covers the model, the signal host and the ordering rule it
implements.

## Installation

```bash
bun add @owlmeans/web-gtm@^0.2.0-alpha.1
```

## Concepts

- **Order** — a Google tag decides what it may do from the consent state present when it loads. A
  React bundle always arrives too late, so the head script emits the Consent Mode bootstrap first and
  the loader after it, as one inline script stamped from HTML.
- **Two halves of Consent Mode** — the head bootstrap declares the defaults and replays a stored
  decision before any loader; the **provider** (`appendGoogleConsentMode()`), registered where the
  consent store runs, signals every later decision. A page with a Google tag needs both.
- **Category map** — `GOOGLE_CONSENT_SIGNALS`: `essential` → `security_storage`,
  `functionality_storage`; `analytics` → `analytics_storage`; `marketing` → `ad_storage`,
  `ad_user_data`, `ad_personalization`. `signals` (and per-category `events`) in the options override
  it by category key; pass the same options to the head and to the provider.
- **Mode** — `'basic'` (the default, `GOOGLE_TAG_DEFAULT_MODE`) withholds the loader until a
  tracking category (`ConsentCategory.tracking` — analytics or marketing by default) is granted, from
  storage or a later `CONSENT_EVENT`. `'advanced'` loads immediately with Consent Mode signals denied.
- **Kind** — `'gtm'` (container, `gtm.js`) for `GTM-`; `'gtag'` (`gtag/js` + `js` + `config`) for
  `G-`, `GT-`, `AW-`, `DC-`.
- **Disclosure** — `ConsentService` entries describing who receives data, derived from the id prefix
  for `CookiePolicy`'s `services`.

## Usage

### 1. Register Consent Mode where the consent store runs

Once, at module scope of the bundle that mounts the consent dialog (a web app's context, a site's
consent island, a generated target's `owlmeans.ts`), before the store starts:

```typescript
import { appendGoogleConsentMode } from '@owlmeans/web-gtm'

appendGoogleConsentMode()   // or appendGoogleConsentMode({ signals, events }) — same options as the head
```

Registration is explicit — importing this package registers nothing. Registering again replaces the
provider (the last options win). With it, `consentStore.init` pushes `consent`/`default` (once per
document, through the `cookieConsentSetup` window flag the head bootstrap shares) and every decision
pushes `consent`/`update` after the category globals and before `CONSENT_EVENT`.

### 2. Stamp the head script from HTML

Stamp it first in `<head>`, from the HTML build — never from the application bundle. A Vite app does
it with a `transformIndexHtml` plugin:

```typescript
import type { Plugin } from 'vite'
import { googleTagHelper } from '@owlmeans/web-gtm'

export const googleTagPlugin = (id: string): Plugin => ({
  name: 'google-tag',
  transformIndexHtml: html => html.replace(
    '<!-- google-tag -->',
    `<script>${googleTagHelper.googleTagHeadScript({ id })}</script>`
  ),
})
```

An invalid or empty id yields the Consent Mode bootstrap alone, so the call is safe to make
unconditionally. The output escapes `</` and `<!--`, so it can be placed inline as-is. A page with no
tag but that wants Consent Mode's state in place uses `googleTagHelper.consentHeadTag(opts).head` —
the same bytes.

### 3. Hand an Astro layout its head tag

`headTag` returns `{ head, noscript }` — the `HeadTag` that `@owlmeans/astro`'s `owlHeadScripts`
takes — and throws on an id it cannot load, so a mistyped id fails the site build:

```typescript
import { astroHelper } from '@owlmeans/astro'
import { googleTagHelper } from '@owlmeans/web-gtm'

const consent = { linker: { domains: ['owlmeans.com', 'owlmeans.pl'] } }
const tags = astroHelper.owlHeadScripts({
  consent,
  tag: googleTagHelper.headTag({ ...consent, id: 'GTM-ABC1234', mode: 'basic' }),
})
```

`noscript` is the container frame only for a `GTM-` id in `'advanced'` mode; otherwise `''`. The
site's consent island calls `appendGoogleConsentMode()` (step 1).

### 4. Keep the consent options in parity

`GoogleTagOptions` extends `ConsentOptions` and `GoogleConsentModeOptions`. Pass the same
`categories`, `storageKey`, `linker` and `signals` here as to `CookieConsent` and
`appendGoogleConsentMode`, or the snippet, the dialog and the provider disagree about what was asked.

```typescript
import { googleTagHelper } from '@owlmeans/web-gtm'

const head = googleTagHelper.googleTagHeadScript({
  id: 'GTM-ABC1234',
  categories: appCategories,                    // a custom category sets `tracking: true` to release the gate
  signals: { chat: ['functionality_storage'] }, // and is mapped onto Consent Mode here
  linker: { domains: ['owlmeans.com', 'owlmeans.pl'] },
})

// a site that has decided to load before consent, with signals denied
const eager = googleTagHelper.googleTagHeadScript({ id: 'G-ABCD1234', mode: 'advanced' })
```

### 5. Send analytics events to the tag manager

```typescript
import { addLogPlugin, logger } from '@owlmeans/log'
import { gtmAnalyticsPlugin } from '@owlmeans/web-gtm'

addLogPlugin(gtmAnalyticsPlugin({ allow: ['project.created', 'sign_in'] }))   // once, at startup

logger('projects').info('Created', { kind: 'web' }, { analytics: 'project.created' })
// with analytics consent: window.dataLayer.push({ event: 'project.created', kind: 'web' })
// without it: dropped, never queued
```

Built on `@owlmeans/web-log`'s `consentedAnalyticsPlugin` (same options: `name`, `category`,
`allow`, `map`); named `'gtm'` unless `name` says otherwise.

### 6. Validate the id where it is stored

```typescript
import { googleTagHelper } from '@owlmeans/web-gtm'

if (!googleTagHelper.isGoogleTagId(form.googleTag)) {
  throw new Error('invalid-google-tag')
}
googleTagHelper.googleTagKind('GTM-ABC1234')   // 'gtm'
googleTagHelper.googleTagKind('AW-123456789')  // 'gtag'
googleTagHelper.googleTagKind('UA-1234-1')     // null — Universal Analytics is retired
```

### 7. Allow the tag in the CSP

```typescript
import { GOOGLE_TAG_CSP_SOURCES, GOOGLE_TAG_FRAME_SOURCES } from '@owlmeans/web-gtm'

const csp = [
  `script-src 'self' ${scriptHash} ${GOOGLE_TAG_CSP_SOURCES.join(' ')}`,
  `connect-src 'self' ${GOOGLE_TAG_CSP_SOURCES.join(' ')}`,
  `img-src 'self' data: ${GOOGLE_TAG_CSP_SOURCES.join(' ')}`,
  `frame-src ${GOOGLE_TAG_FRAME_SOURCES.join(' ')}`,
].join('; ')
```

### 8. Disclose the tag on the cookie policy

```tsx
import { CookiePolicy } from '@owlmeans/web-consent'
import { googleTagHelper } from '@owlmeans/web-gtm'

<CookiePolicy services={googleTagHelper.googleTagServices(googleTag)} privacyHref="/legal/privacy" />
```

### 9. Load from script when the HTML is not yours

For a single-page app that cannot edit its own head. It registers Consent Mode unless the app already
did, calls `consentStore.init(opts)` first, refuses to load twice, gates the same way in `'basic'`
mode, and does nothing without a `document`.

```typescript
import { googleTagHelper } from '@owlmeans/web-gtm'

googleTagHelper.loadGtm({ id: 'GTM-ABC1234', categories: appCategories })
```

## API

### Consent Mode

| Symbol | Kind | Purpose |
|---|---|---|
| `appendGoogleConsentMode(options?)` | function → `GoogleConsentMode` | `makeGoogleConsentMode(options)` registered with `consentSignalHelper` (replace by id) |
| `makeGoogleConsentMode(options?)` | function → `GoogleConsentMode` | The provider: `id`, `defaults(opts)`, `apply(record, opts)`, `bootstrapScript(opts?)`, plus `gtagConsent`, `signalsOf(category)`, `consentDefaults(categories?)`, `consentUpdate(record, categories?)` |
| `GOOGLE_CONSENT_MODE_ID` | const | `'google-consent-mode'` |
| `GOOGLE_CONSENT_SIGNALS` | const | the default category → signals map (frozen) |
| `GOOGLE_CONSENT_SIGNAL_DEFAULTS` | const | every Consent Mode v2 signal `denied`, except `security_storage` `granted` |
| `GOOGLE_CONSENT_SETUP_FLAG` | const | `'cookieConsentSetup'` — the window flag making `default` once per document |
| `gtmAnalyticsPlugin(options?)` | function → `LogPlugin` | Consent-gated sink pushing `{ event, ...data }` onto `window.dataLayer`; name `'gtm'`; no-op outside a browser |

### `googleTagHelper` (`GoogleTagHelper`, built by `createGoogleTagHelper()`)

| Member | Returns | Purpose |
|---|---|---|
| `googleTagHeadScript(opts: GoogleTagOptions)` | `string` | Consent Mode bootstrap, then `ads_data_redaction` on and `url_passthrough` off, then the loader for the id's kind (gated in `'basic'`); HTML-inline-safe. **The default for new code** |
| `gtmHeadScript(opts: GtmOptions)` | `string` | Older container-only form: bootstrap then `gtm.js`; gated the same way; does not escape `</` |
| `gtmNoscriptFrame(opts: GtmOptions)` | `string` | Hidden `<noscript>` iframe for `<body>`; `''` in `'basic'` mode |
| `loadGtm(opts: GtmOptions)` | `void` | Script-side container load (fallback) |
| `isGoogleTagId(id)` | `boolean` | Strict id check: `GTM-` + 4–12, or `G-`/`GT-`/`AW-`/`DC-` + 4–16 upper-case letters and digits |
| `googleTagKind(id)` | `'gtm' \| 'gtag' \| null` | Which loader an id takes |
| `googleTagServices(id)` | `ConsentService[]` | Cookie-policy disclosure read off the prefix |
| `headTag(opts: GoogleTagOptions)` | `GoogleHeadTag` | `{ head: googleTagHeadScript(opts), noscript }` — `noscript` only for a `GTM-` container in `'advanced'` mode; **throws** on an id `isGoogleTagId` rejects |
| `consentHeadTag(opts?: GoogleConsentHeadOptions)` | `GoogleHeadTag` | The Consent Mode bootstrap alone, inline-safe, `noscript: ''` — for a page with no loader in its head |

`googleTagServices` returns: `G-` → Google Analytics (analytics; `_ga`, `_ga_<id>`); `AW-` → Google
Ads (marketing; `_gcl_au`, `_gcl_aw`); `DC-` → Floodlight (marketing; `_gcl_au`, `_gcl_dc`); `GTM-`
and `GT-` → one analytics and one advertising entry; an invalid id → `[]`.

### Constants

| Symbol | Value |
|---|---|
| `GOOGLE_TAG_DEFAULT_MODE` | `'basic'` |
| `GOOGLE_TAG_CSP_SOURCES` | frozen list for `script-src`, `connect-src`, `img-src`: `*.googletagmanager.com`, `*.google-analytics.com`, `*.g.doubleclick.net`, `ad.doubleclick.net`, `www.googleadservices.com`, `pagead2.googlesyndication.com`, `*.google.com` (all `https://`) |
| `GOOGLE_TAG_FRAME_SOURCES` | frozen list for `frame-src`: `https://www.googletagmanager.com`, `https://td.doubleclick.net` |

### Types

| Symbol | Shape |
|---|---|
| `GoogleConsentModeOptions` | `{ signals?: Record<categoryKey, GoogleConsentSignal[]>, events?: Record<categoryKey, string> }` |
| `GoogleConsentHeadOptions` | `ConsentOptions` + `GoogleConsentModeOptions` |
| `GoogleConsentMode` | the provider (`ConsentSignalProvider` + the members above) |
| `GoogleConsentSignal`, `GoogleConsentState` | the seven signal names; `'granted' \| 'denied'` |
| `GoogleTagOptions` | `GoogleConsentHeadOptions` + `{ id, dataLayerName?, mode? }` |
| `GtmOptions` | `GoogleConsentHeadOptions` + `{ id, dataLayerName?, mode? }` (container id) |
| `GoogleTagMode` | `'basic' \| 'advanced'` |
| `GoogleTagKind` | `'gtm' \| 'gtag'` |
| `GoogleHeadTag` | `{ head, noscript }` — structurally `@owlmeans/astro`'s `HeadTag` |
| `DataLayerWindow` | `{ dataLayer?: unknown[] }` |
| `GoogleTagHelper` | the helper interface above |

### Deprecated wrappers

`gtmHeadScript`, `gtmNoscriptFrame`, `isGoogleTagId`, `googleTagHeadScript`, `googleTagServices` —
top-level functions delegating to `googleTagHelper`. Use the helper members.

## Common pitfalls

- A head bootstrap without the provider: the container loads on a grant (the gate hears
  `CONSENT_EVENT`) but is still told everything is denied. Call `appendGoogleConsentMode()` where the
  consent store runs.
- Loading the tag from the bundle (or with `loadGtm` where the head is editable) lets it run before
  the consent defaults exist; stamp the head script from HTML.
- `dataLayerName`: Consent Mode always speaks on `window.dataLayer`, so a tag on another queue never
  hears a consent command. Leave it unset on a consent-gated page.
- A custom category needs `tracking: true` to release the `'basic'` gate, and a `signals` entry to
  drive any Consent Mode signal.
- Code written before `'basic'` became the default and expects the tag to load unconditionally must
  pass `mode: 'advanced'` explicitly.
- In `'basic'` mode a page counts as "tagged" in Tag Manager only after a consenting visitor loaded
  it; a URL that redirects before the loader runs stays "not tagged".
- `isGoogleTagId` rejects lower case and `UA-` ids — normalise in the form, and validate where the
  id is stored, not only where it is emitted.
- Under a hash-based CSP, Tag Manager Custom HTML tags and Custom JavaScript variables cannot run;
  build containers from Google's built-in tag templates.
- Never build the snippet or the noscript frame by hand — the helpers JSON- or URL-encode the id and
  queue name. The emitted head strings are byte-stable for the same inputs (`tests/golden.spec.ts`).

## Related packages

- [`@owlmeans/consent`](https://github.com/owlmeans/common/tree/main/packages/consent) — the signal host, `consentStore`, the neutral gate (`consentTrackingHelper`) and the storage contract
- [`@owlmeans/web-consent`](https://github.com/owlmeans/common/tree/main/packages/web-consent) — the dialog and `CookiePolicy` that consume `googleTagServices`
- [`@owlmeans/web-log`](https://github.com/owlmeans/common/tree/main/packages/web-log) — the consent gate `gtmAnalyticsPlugin` is built on
- [`@owlmeans/astro`](https://github.com/owlmeans/common/tree/main/packages/astro) — stamps `headTag`'s strings in an Astro layout

<!-- owlmeans:agent-guidance:start -->
## Agent guidance

This package ships embedded agent skills under `agent-meta/`. After installing your
`@owlmeans/*` packages, run the OwlMeans agent-skills installer to place them into
your project's skill store (`.agents/skills/`):

```sh
npx @owlmeans/agent-skills@^0.2.0-alpha.1
```

The embedded files are version-matched to this package release. Do not edit them
directly — they are regenerated on each publish. To contribute guidance edits,
open a PR against the source monorepo.
<!-- owlmeans:agent-guidance:end -->
