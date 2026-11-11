# Connect project structure

`connect` is the provider tier of OwlMeans: every public package here integrates ONE external provider
and plugs into a provider-agnostic contract package of `common`.

| Package | Plugs into (common) | Provider |
|---|---|---|
| `bot-telegram`, `bot-whatsapp`, `bot-discord`, `bot-slack` | `server-bot` (`BotServiceOptions.platforms`), descriptors served to `web-bot` | chat platforms |
| `captcha-recaptcha` | `captcha` host (`appendRecaptcha`) | Google reCAPTCHA siteverify |
| `web-captcha-recaptcha` | `web-captcha` client host; `./react` widget for the panels | Google reCAPTCHA v3 / v2 |
| `server-payment-stripe` | `server-payment` paygate registry (`appendStripeProvider`) | Stripe |
| `mailer-mailgun` | `mailer` transport host (`appendMailgunMailer`) | Mailgun HTTP API |
| `web-gtm` | `consent` signal-provider host (Consent Mode); `astro` head tag slot; `web-log` analytics gate (the tag-manager sink) | Google Tag Manager / Google tag / Consent Mode |

Rules:

- `connect` depends on `common` only; `common` never depends on `connect` (no dependency, test import
  or path read). Provider names, wire values, texts and third-party SDKs live here, never in `common`.
- A package registers explicitly through the contract's host (`appendXxx(ctx, opts?)` or the host's
  options) — never by a side-effect import. Its config records, declaration helpers and config type
  augmentation live here.
- `packages/` holds the public packages plus the private `_tpl` starter. `libraries/common` links
  common; root `workspaces` list every upstream common package of the closure explicitly (no globs).
- Versions follow `common`'s line (`/versions`); consumers are `viable`, `viable-agent`'s generated
  targets (bot platforms, `web-gtm`) and `static` (`web-gtm`).
- Canonical skills live in `.agents/skills/<package>/`; `sync-agent-meta` embeds them into each
  package's `agent-meta/` at release time.
