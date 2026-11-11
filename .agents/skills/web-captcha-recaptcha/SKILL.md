---
name: web-captcha-recaptcha
description: How to use @owlmeans/web-captcha-recaptcha (OwlMeans connect) — the Google reCAPTCHA client for @owlmeans/web-captcha. makeRecaptchaClient / appendRecaptchaClient (explicit registration in captchaClients), the lazy v3 loader (createRecaptchaLoader, recaptchaLoader — one script per site key, the badge hidden, a failed load forgotten), Google's notice in eight languages (RECAPTCHA_TEXTS, RECAPTCHA_NOTICE), CMOD_RECAPTCHA, and the v2 checkbox widget RecaptchaCheckbox (./react). Auto-invoked when a web app, an e-mail sign-in card or an embedded widget needs a reCAPTCHA token, when registering the reCAPTCHA client, rendering Google's notice or the checkbox, or debugging a reCAPTCHA load failure.
user-invocable: false
---

# @owlmeans/web-captcha-recaptcha

**Layer:** Web (no `@owlmeans/*` dependency but `@owlmeans/web-captcha`; React and
`react-google-recaptcha` reach only `./react`)
**Repo:** OwlMeans connect (`@owlmeans/web-captcha-recaptcha`) — the Google-specific half; the
contract, the registry and `useCaptcha` are common's `@owlmeans/web-captcha`
**Install:** `"@owlmeans/web-captcha-recaptcha": "^0.2.0-alpha.0"` in `dependencies`
**Server half:** `@owlmeans/captcha-recaptcha` (provider id `recaptcha`)

## Public API surface

| Symbol | Kind | Purpose |
|---|---|---|
| `appendRecaptchaClient(opts?, clients = captchaClients)` | fn | Registers the client (same id replaces) and returns it |
| `makeRecaptchaClient(opts?)` | fn | The `CaptchaClient`: `id: 'recaptcha'`, `load` / `execute` over the v3 loader, `notice`, `texts`, `siteKeyRecord: CMOD_RECAPTCHA`, `widget` when given |
| `createRecaptchaLoader(opts?)`, `recaptchaLoader` | fn / instance | Google's v3 loader: `prepare(siteKey)`, `token(siteKey, action)` |
| `RecaptchaCheckbox` (`./react`) | component | The v2 checkbox as a `CaptchaWidget` (`react-google-recaptcha`): `siteKey`, `onToken` (expiry → `null`), `onReady`, `onError`, `language` → `hl` |
| `RECAPTCHA_PROVIDER` | const | `'recaptcha'` — equal to the server provider's id |
| `CMOD_RECAPTCHA` | const | `'_client-external:re-captcha'` — the advertised client record whose `value` is the site key |
| `RECAPTCHA_TEXTS`, `RECAPTCHA_NOTICE` | const | Google's notice (`notice`, `privacy`, `terms`) in en, pl, ru, be, uk, es, de, fr; its two links |
| `RECAPTCHA_SCRIPT_URL`, `RECAPTCHA_LOAD_TIMEOUT`, `RECAPTCHA_EXECUTE_TIMEOUT` | const | `https://www.google.com/recaptcha/api.js`, `15_000`, `20_000` |
| `RECAPTCHA_SCRIPT_ATTRIBUTE`, `RECAPTCHA_STYLE_ATTRIBUTE`, `RECAPTCHA_BADGE_CSS`, `RECAPTCHA_PRIVACY_URL`, `RECAPTCHA_TERMS_URL` | const | What the loader marks and injects; Google's documents |
| `RecaptchaClientOptions` | interface | `{ loader?, widget?, siteKeyRecord? }` |
| `RecaptchaLoaderOptions` | interface | `hideBadge` (default `true`), `loadTimeout`, `executeTimeout`, `scriptUrl`, `document` / `window` |
| `RecaptchaClient`, `RecaptchaLoader`, `Grecaptcha`, `RecaptchaWindow`, `RecaptchaDocument` | types | |

## Wiring

```typescript
// a web app's context factory — explicit, once
appendRecaptchaClient()                                   // invisible v3: the e-mail card, forms

// a panel app whose captcha sign-in shows Google's checkbox (needs a v2 site key)
import { RecaptchaCheckbox } from '@owlmeans/web-captcha-recaptcha/react'
appendRecaptchaClient({ widget: RecaptchaCheckbox })
```

An embedded IIFE bundle (an inquiry widget) imports the package ROOT only and uses the client
directly, without the registry: `makeInquiryApi({ captcha: makeRecaptchaClient() })`. The root never
imports React or `react-google-recaptcha`.

## Behaviour

- **Lazy** — `api.js?render=<site key>` is injected on the first `load` / `execute`; safe at import,
  under server rendering and in tests; without a page a call fails with
  `CaptchaLoadError('unavailable')`.
- **One script per site key per loader**; concurrent calls share the load; a failed load is
  forgotten, so the next call injects again.
- **Badge** — the loader hides Google's badge with one document rule; the page must then show
  Google's notice (the client's `notice` + `texts`, read with `captchaNoticeHelper.noticeOf`). Pass
  `hideBadge: false` to keep the badge.
- **Failures** — `load`, `timeout` (15 s), `unavailable` (no page, or the script without its API),
  `execute` (no token within 20 s).
- A new language goes into `RECAPTCHA_TEXTS` with all three keys and both placeholders
  (`tests/client.spec.ts` checks it).

## Tests

`bun test ./tests` — category A: the loader over a stand-in `document`/`window` (no browser), the
client and its registration, the texts in eight languages, and the checkbox element's props.

## External docs

- https://developers.google.com/recaptcha/docs/v3 — `api.js?render=<site key>`, `grecaptcha.ready` then `execute(siteKey, { action })` per protected action
- https://developers.google.com/recaptcha/docs/faq — hiding the badge requires the notice text with links to Google's Privacy Policy and Terms of Service in the user flow
- https://github.com/dozoisch/react-google-recaptcha — the v2 checkbox component: `sitekey`, `onChange`, `onExpired`, `onErrored`, `asyncScriptOnLoad`, `hl`

## Related

`web-captcha` (the contract and registry, common) · `captcha-recaptcha` (the server half) ·
`web-auth-email` (the e-mail card asks this client) · `web-panel` / `mui-panel` (render its widget)
