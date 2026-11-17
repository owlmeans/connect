# OwlMeans Connect

The provider tier of OwlMeans: public provider plugins for the
[OwlMeans Common](https://github.com/owlmeans/common) framework. Every package here integrates ONE
external provider — a chat platform, reCAPTCHA, Stripe, Mailgun, the Google tag, Google Drive or the
npm registry — and plugs into a provider-agnostic contract package of common. The packages are
published to npm as `@owlmeans/*`, MIT-licensed, ESM and strict TypeScript, like common's.

## The split rule

- **Common names no provider.** It holds the provider-agnostic contracts, hosts, UI and test
  helpers, with no provider name in code, wire values, i18n or dependencies.
- **Connect names one provider per package.** The provider's API calls, SDK, config records,
  declaration helpers and config type augmentation live here.
- **One direction.** Connect depends on common only; common never depends on connect.
- **Explicit registration.** The contract package declares the provider interface and a host in the
  context; a package here implements it and registers through `appendXxx(ctx)` or the host's options.
  Importing a package registers nothing.
- **Protocols and infrastructure stay in common.** The SMTP transport (`mailer-smtp`) and the
  database, queue, storage and LLM drivers are not providers.

## Packages

Each package has its own README and a canonical skill under [`.agents/skills`](.agents/skills).

| Package | Provider | Plugs into (common) | Purpose |
|---|---|---|---|
| [`bot-telegram`](packages/bot-telegram) | Telegram Bot API | `server-bot` (`platforms`, `appendTelegramBotPlatform`) | The Telegram chat-bot platform: descriptor, Bot API calls, webhook and long polling, mock |
| [`bot-whatsapp`](packages/bot-whatsapp) | WhatsApp Cloud API | `server-bot` (`platforms`, `appendWhatsAppBotPlatform`) | The WhatsApp chat-bot platform: descriptor, signed webhook, messaging calls, mock |
| [`bot-discord`](packages/bot-discord) | Discord REST API and gateway | `server-bot` (`platforms`, `appendDiscordBotPlatform`) | The Discord chat-bot platform: descriptor, gateway receiver, REST actions, invite link, mock |
| [`bot-slack`](packages/bot-slack) | Slack Events API and Web API | `server-bot` (`platforms`, `appendSlackBotPlatform`) | The Slack chat-bot platform: descriptor, signed Events API hook, Web API actions, mock |
| [`captcha-recaptcha`](packages/captcha-recaptcha) | Google reCAPTCHA | `captcha` host (`appendRecaptcha`) | The server captcha provider: siteverify mapped onto the neutral verdict, its config records |
| [`web-captcha-recaptcha`](packages/web-captcha-recaptcha) | Google reCAPTCHA | `web-captcha` client registry (`appendRecaptchaClient`) | The browser captcha client: the v3 loader, Google's notice in eight languages, the v2 checkbox widget (`./react`) |
| [`server-payment-stripe`](packages/server-payment-stripe) | Stripe | `server-payment` payment providers (`appendStripeProvider`) | Checkout, subscriptions, refunds and credit notes, webhooks, catalogue sync, customer portal, Stripe Tax and FX quotes |
| [`mailer-mailgun`](packages/mailer-mailgun) | Mailgun HTTP API | `mailer` host (`appendMailgunMailer`) | A mail transport over Mailgun's HTTP API, attachments included |
| [`web-gtm`](packages/web-gtm) | Google tag (Tag Manager, GA4, Google Ads) | `consent` signal host (`appendGoogleConsentMode`); `log` sink over `web-log` (`gtmAnalyticsPlugin`) | Consent Mode, the head snippet with its defaults before the loader, the tag-manager analytics sink, CSP hosts and cookie-policy disclosure |
| [`llm-reader-google-drive`](packages/llm-reader-google-drive) | Google Drive | `llm-reader` sources (`createGoogleDriveSource` in `LlmReaderOptions.sources`) | Public folder, file and Docs links collected as files: keyless folder listing or Drive API v3, editor files exported |
| [`package-registry-npm`](packages/package-registry-npm) | npm registry | `package-inspector` registry port (`createNpmRegistry`, `appendNpmRegistry`) | Packuments and readmes, bulk weekly downloads of a name's neighbours, the repository's own manifest name |

## Installation

Install a provider package together with the common contract package it plugs into:

```sh
bun add @owlmeans/mailer-mailgun@^0.2.0 @owlmeans/mailer@^0.2.0
# or
npm install @owlmeans/mailer-mailgun@^0.2.0 @owlmeans/mailer@^0.2.0
```

Connect and common ship on one synchronized stable line, `0.2.0`, under npm's `latest` dist-tag;
prereleases publish under `next`. Pin a caret range, never a tag.

## Registration

A provider is wired with one explicit call in the context factory. The Mailgun transport, from
[`mailer-mailgun`](packages/mailer-mailgun):

```typescript
import type { MailgunSettings } from '@owlmeans/mailer-mailgun'

export const mailgun: MailgunSettings = {
  apiKey: process.env.MAILGUN_API_KEY!,
  domain: process.env.MAILGUN_DOMAIN!,            // e.g. 'mg.example.com'
  from: process.env.MAILGUN_FROM!,                // e.g. 'OwlMeans <no-reply@mg.example.com>'
  baseUrl: 'https://api.eu.mailgun.net/v3',       // optional; EU region
}
// cfg.mailgun = mailgun
```

```typescript
import { appendMailgunMailer } from '@owlmeans/mailer-mailgun'

// in makeContext
appendMailgunMailer(context)
```

Platform code keeps resolving the provider-agnostic host and never names the transport:

```typescript
import { MAILER_SERVICE } from '@owlmeans/mailer'
import type { MailerService } from '@owlmeans/mailer'

await context.service<MailerService>(MAILER_SERVICE).send({
  to: 'person@example.com',
  subject: 'Invoice',
  html: '<p>Your invoice is attached.</p>',
})
```

The other packages follow the same shape: a bot platform goes into `makeBotService({ platforms })`
or `appendTelegramBotPlatform(context)`, Stripe into `appendStripeProvider(context)`, reCAPTCHA into
`appendRecaptcha(context)` and `appendRecaptchaClient()`.

## Agent guidance

Every package ships version-matched agent skills in `agent-meta/`. After installing your
`@owlmeans/*` packages, place them into your project's skill store (`.agents/skills/`):

```sh
npx @owlmeans/agent-skills@^0.2.1
```

The embedded copies are regenerated from the canonical skills in [`.agents/skills`](.agents/skills)
on each release; edit only the canonical files.

## Development

Bun only, with [OwlMeans Common](https://github.com/owlmeans/common) cloned beside this repository
(`setup.sh` links it as `libraries/common`):

```bash
./setup.sh         # libraries/common -> ../../common
bun install
bun run build
bun run test
```

Root workspaces list every upstream common package explicitly. `packages/_tpl` is a private starter,
excluded from the root commands and from releases.

## Issues and license

Report issues at https://github.com/owlmeans/connect/issues. Every package is MIT-licensed — see
[LICENSE](LICENSE).
