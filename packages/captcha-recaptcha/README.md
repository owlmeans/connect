# @owlmeans/captcha-recaptcha

The Google reCAPTCHA provider for `@owlmeans/captcha`: Google's siteverify, its answer mapped onto
the neutral `CaptchaVerdict`, the provider's config records and the helper that registers it in a
context's captcha host. With it registered, the captcha guest sign-in of `@owlmeans/server-auth`
(where the host record `MOD_CAPTCHA` names it) and a strict `makeCaptchaCheck` (e-mail sign-in, a
route that acts on a token) judge reCAPTCHA v2 and v3 tokens. The browser half is
`@owlmeans/web-captcha-recaptcha`.

## Installation

```bash
bun add @owlmeans/captcha-recaptcha@^0.2.0-alpha.0
```

## Concepts

- **Provider** — `makeRecaptchaProvider(options)` is a `CaptchaProvider` with id `'recaptcha'`
  (`RECAPTCHA_PROVIDER`). `verify` posts the siteverify form (`secret`, `response`, `remoteip`) and
  answers `{ success, score, action, hostname, at, errors }`; `clientSettings()` answers
  `{ provider: 'recaptcha', siteKey }`.
- **Keys** — the secret and the site key come from fixed options or from `keys` getters read per
  call. `appendRecaptcha(ctx)` defaults `keys` to the context's records: `MOD_RECAPTCHA`
  (`'_external:re-captcha'`, the secret in `value`, an optional `siteKey`) and `CMOD_RECAPTCHA`
  (`'_client-external:re-captcha'`, the advertised site key). An empty or unresolved value counts as
  none.
- **Fail closed** — without a secret `verify` asks nothing and throws
  `AuthUnavailable('captcha:config')`; an unreachable or unreadable Google is
  `AuthUnavailable('captcha')`; a refused token is a verdict (`success: false`).
- **Explicit** — registering is a call in the context set-up; importing the package registers
  nothing, and registering turns nothing on by itself.

## Usage

```typescript
import { MOD_CAPTCHA } from '@owlmeans/captcha'
import { appendRecaptcha, CMOD_RECAPTCHA, MOD_RECAPTCHA, RECAPTCHA_PROVIDER } from '@owlmeans/captcha-recaptcha'
import { clientPlugin, plugin } from '@owlmeans/config'

// config: the provider's records, and the host record of the guest sign-in
plugin(cfg, { value: '/etc/master-secret/recaptcha-secret' }, MOD_RECAPTCHA)
clientPlugin(cfg, '/etc/app-config/recaptcha-site-key', CMOD_RECAPTCHA)
plugin(cfg, { provider: RECAPTCHA_PROVIDER, hostnames: 'example.org', minScore: '0.5', actions: 'inquiry' }, MOD_CAPTCHA)

// context
appendRecaptcha(context)
```

A strict check with keys held in another config block:

```typescript
appendRecaptcha(context, { keys: { secret: () => cfg.captcha.secret, siteKey: () => cfg.captcha.siteKey } })
const check = makeCaptchaCheck(context, { provider: RECAPTCHA_PROVIDER, hostnames: 'example.org', minScore: 0.5 })
```

## API

| Export | Description |
|---|---|
| `appendRecaptcha(ctx, options?)` | Register the provider in `ensureCaptchaService(ctx)`; returns the context |
| `makeRecaptchaProvider(options?)` | The provider; `options.id`, `secret`, `siteKey`, `keys`, `url` (https only), `fetch`, `timeout` |
| `makeRecaptchaKeys(ctx)` | The keys of the context's `MOD_RECAPTCHA` / `CMOD_RECAPTCHA` records, read per call |
| `createRecaptchaVerifier(options?)` | The siteverify call alone: `verify({ secret, response, remoteip? })` → Google's answer |
| `RECAPTCHA_PROVIDER` | `'recaptcha'` |
| `MOD_RECAPTCHA`, `CMOD_RECAPTCHA` | `'_external:re-captcha'`, `'_client-external:re-captcha'` |
| `RECAPTCHA_SITEVERIFY_URL`, `RECAPTCHA_VERIFY_TIMEOUT` | `https://www.google.com/recaptcha/api/siteverify`, `10_000` |
| `RecaptchaProviderOptions`, `RecaptchaKeys`, `RecaptchaRecord`, `RecaptchaResponse`, `RecaptchaRequest`, `RecaptchaFetch`, `RecaptchaVerifier`, `RecaptchaVerifierOptions`, `RecaptchaProvider` | Types |

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
