# @owlmeans/web-captcha-recaptcha

The Google reCAPTCHA client for `@owlmeans/web-captcha`: the lazy, invisible v3 loader, Google's
notice in eight languages, the advertised site-key record, the helper that registers the client in
the page's `captchaClients`, and — from `./react` — Google's v2 checkbox as a captcha widget. A form
that is advertised the `recaptcha` provider (the server half is `@owlmeans/captcha-recaptcha`) asks
this client for its token. The package root carries no React, so an embedded bundle can import it
alone.

## Installation

```bash
bun add @owlmeans/web-captcha-recaptcha@^0.2.0-alpha.0
```

## Concepts

- **Client** — `makeRecaptchaClient(options)` is a `CaptchaClient` with id `'recaptcha'`: `load`
  injects `api.js?render=<site key>` once per key, `execute(siteKey, action)` asks
  `grecaptcha.execute` for a fresh token. Nothing touches the page until then.
- **Badge and notice** — the loader hides Google's badge; the client ships the notice a page then
  shows (`RECAPTCHA_TEXTS`, `RECAPTCHA_NOTICE`), which `captchaNoticeHelper.noticeOf(client, lng)`
  resolves in the reader's language.
- **Widget** — `RecaptchaCheckbox` (`./react`) renders the v2 checkbox; give it to the client and a
  panel's captcha sign-in renders it (with a v2 site key).
- **Explicit** — `appendRecaptchaClient()` registers the client; importing registers nothing.

## Usage

```typescript
import { appendRecaptchaClient } from '@owlmeans/web-captcha-recaptcha'

appendRecaptchaClient()                       // in the app's context factory
```

```typescript
import { RecaptchaCheckbox } from '@owlmeans/web-captcha-recaptcha/react'

appendRecaptchaClient({ widget: RecaptchaCheckbox })   // a panel app showing the checkbox
```

```typescript
import { makeRecaptchaClient } from '@owlmeans/web-captcha-recaptcha'

const client = makeRecaptchaClient()          // an embedded bundle, without the registry
await client.load(siteKey)
const token = await client.execute(siteKey, 'inquiry')
```

## API

| Export | Description |
|---|---|
| `appendRecaptchaClient(options?, clients?)` | Register the client in `captchaClients` (or the registry given); returns it |
| `makeRecaptchaClient(options?)` | The client; `options.loader`, `widget`, `siteKeyRecord` (default `CMOD_RECAPTCHA`) |
| `createRecaptchaLoader(options?)`, `recaptchaLoader` | The v3 loader: `prepare(siteKey)`, `token(siteKey, action)`; options `hideBadge`, `loadTimeout`, `executeTimeout`, `scriptUrl`, `document`, `window` |
| `RecaptchaCheckbox` (`./react`) | The v2 checkbox widget |
| `RECAPTCHA_PROVIDER`, `CMOD_RECAPTCHA` | `'recaptcha'`, `'_client-external:re-captcha'` |
| `RECAPTCHA_TEXTS`, `RECAPTCHA_NOTICE`, `RECAPTCHA_PRIVACY_URL`, `RECAPTCHA_TERMS_URL` | Google's notice and its links |
| `RECAPTCHA_SCRIPT_URL`, `RECAPTCHA_LOAD_TIMEOUT`, `RECAPTCHA_EXECUTE_TIMEOUT`, `RECAPTCHA_SCRIPT_ATTRIBUTE`, `RECAPTCHA_STYLE_ATTRIBUTE`, `RECAPTCHA_BADGE_CSS` | The loader's script, timeouts and marks |
| `RecaptchaClient`, `RecaptchaClientOptions`, `RecaptchaLoader`, `RecaptchaLoaderOptions`, `Grecaptcha`, `RecaptchaWindow`, `RecaptchaDocument` | Types |

## License

MIT

<!-- owlmeans:agent-guidance:start -->
## Agent guidance

This package ships embedded agent skills under `agent-meta/`. After installing your
`@owlmeans/*` packages, run the OwlMeans agent-skills installer to place them into
your project's skill store (`.agents/skills/`):

```sh
npx @owlmeans/agent-skills@^0.2.0-alpha.0
```

The embedded files are version-matched to this package release. Do not edit them
directly — they are regenerated on each publish. To contribute guidance edits,
open a PR against the source monorepo.
<!-- owlmeans:agent-guidance:end -->
