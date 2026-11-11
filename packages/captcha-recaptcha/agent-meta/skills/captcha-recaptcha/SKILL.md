---
name: captcha-recaptcha
description: How to use @owlmeans/captcha-recaptcha (OwlMeans connect) — the Google reCAPTCHA provider for the @owlmeans/captcha host. makeRecaptchaProvider (siteverify mapped onto the neutral CaptchaVerdict), appendRecaptcha (explicit registration in the context's captcha host), the MOD_RECAPTCHA / CMOD_RECAPTCHA config records and per-call keys, createRecaptchaVerifier (one https form POST, injectable fetch, 10 s). Auto-invoked when a server must verify Google reCAPTCHA tokens — the captcha guest sign-in, a strict per-route check, e-mail sign-in — when declaring the reCAPTCHA secret or site key, or when debugging a refused or unavailable reCAPTCHA check.
user-invocable: false
---
<!-- AUTO-GENERATED — do not edit. Regenerate via sync-agent-meta. -->

# @owlmeans/captcha-recaptcha

**Layer:** Server
**Repo:** OwlMeans connect (`@owlmeans/captcha-recaptcha`) — the Google-specific half; the host, the
policies and the guest sign-in are common's `@owlmeans/captcha` and `@owlmeans/server-auth`
**Install:** `"@owlmeans/captcha-recaptcha": "^0.2.0-alpha.0"` in `dependencies`
**Browser half:** `@owlmeans/web-captcha-recaptcha` (the v3 loader client, Google's notice, the v2 checkbox)

## Public API surface

| Symbol | Kind | Purpose |
|---|---|---|
| `appendRecaptcha(ctx, opts?)` | fn | Registers the provider in `ensureCaptchaService(ctx)`; keys default to the context's records, read per call |
| `makeRecaptchaProvider(opts?)` | fn | The `CaptchaProvider`: `verify(token, { action?, remoteIp? })` → `CaptchaVerdict`, `clientSettings()` → `{ provider: 'recaptcha', siteKey }` |
| `makeRecaptchaKeys(ctx)` | fn | `RecaptchaKeys` over the context's records: `secret()` = `MOD_RECAPTCHA.value`, `siteKey()` = `MOD_RECAPTCHA.siteKey` else `CMOD_RECAPTCHA.value` |
| `createRecaptchaVerifier(opts?)` | fn | siteverify: one form POST (`url` https only, `fetch` injectable, `timeout` default 10 s) |
| `RECAPTCHA_PROVIDER` | const | `'recaptcha'` — the provider id (settings, `MOD_CAPTCHA.provider`, the browser client) |
| `MOD_RECAPTCHA`, `CMOD_RECAPTCHA` | const | `'_external:re-captcha'` (Backend: secret in `value`, optional `siteKey`), `'_client-external:re-captcha'` (Frontend: site key in `value`) — stored ids, unchanged since 0.1 |
| `RECAPTCHA_SITEVERIFY_URL`, `RECAPTCHA_VERIFY_TIMEOUT` | const | `https://www.google.com/recaptcha/api/siteverify`, `10_000` |
| `RecaptchaProviderOptions` | interface | `{ id?, secret?, siteKey?, keys?, url?, fetch?, timeout? }` — fixed values win over `keys` |
| `RecaptchaKeys`, `RecaptchaRecord`, `RecaptchaResponse`, `RecaptchaRequest`, `RecaptchaFetch`, `RecaptchaVerifier`, `RecaptchaVerifierOptions`, `RecaptchaProvider` | types | |

## Wiring

```typescript
// config.ts — the provider's records; the host record MOD_CAPTCHA only where the guest sign-in is wanted
plugin(cfg, { value: backendConfigHelper.mounted('/etc/master-secret/recaptcha-secret') ?? '' }, MOD_RECAPTCHA)
clientPlugin(cfg, '/etc/app-config/recaptcha-site-key', CMOD_RECAPTCHA)   // advertised to the browser
plugin(cfg, { provider: RECAPTCHA_PROVIDER, hostnames: '…', minScore: '…', actions: 'inquiry' }, MOD_CAPTCHA)

// context.ts — explicit registration, never a side-effect import
appendRecaptcha(context)
```

Keys held elsewhere (a config block resolved in place) go in as getters, read per call:

```typescript
appendRecaptcha(context, { keys: { secret: () => cfg.emailAuth.captcha.secret, siteKey: () => cfg.emailAuth.captcha.siteKey } })
```

## Behaviour

- **Verdict mapping** — `success`; `score`, `action`, `hostname` as Google reports them (a v2 checkbox
  answer has no score or action); `challenge_ts` → `at`; `error-codes` → `errors`. The policies of
  `@owlmeans/captcha` then judge it (`captcha:<errors>`, `captcha:score`, …).
- **No secret, no question** — `verify` without a secret throws `AuthUnavailable('captcha:config')`,
  logged once (`auth.captcha.config`); Google is never asked with an empty secret.
- **Unreachable or unreadable Google** — `AuthUnavailable('captcha')` (503), logged at warn
  (`auth.captcha.unavailable`); a refused token is a verdict, never an error.
- **Keys per call** — a record value that is empty or still an unresolved `/…` path counts as none,
  so a deployment without the mounted secret boots and answers 503 instead of crash-looping.
- **Registering turns nothing on by itself** — the guest sign-in needs the host's `MOD_CAPTCHA`
  record, a strict check its own `CaptchaSettings`. A process that must not offer the guest sign-in
  (e.g. one serving ungated `/authentication/*` routes) registers the provider and declares no
  `MOD_CAPTCHA`.
- `RECAPTCHA_PROVIDER` is the wire id the browser picks its client by: keep it equal to
  `@owlmeans/web-captcha-recaptcha`'s.

## Tests

`bun test ./tests` — category A: siteverify over an injected `fetch` (no network), the verdict
mapping, the keys, and `appendRecaptcha` against the real captcha host and `makeCaptchaCheck`.

## External docs

- https://developers.google.com/recaptcha/docs/verify — siteverify: form-encoded `secret` + `response` (+ `remoteip`); answers `success`, `challenge_ts`, `hostname`, `score`, `action`, `error-codes`; a token is verifiable once, within two minutes
- https://developers.google.com/recaptcha/docs/v3 — scores 0.0–1.0 and the action come back from siteverify; the site picks the threshold

## Related

`captcha` (the host and policies, common) · `server-auth` (the guest `captcha` plugin and guard) ·
`server-auth-email` (the strict check) · `web-captcha-recaptcha` (the browser half)
