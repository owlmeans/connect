# OwlMeans Connect

Public OwlMeans provider plugins. Every package here integrates one external provider and plugs into a
provider-agnostic contract package of [OwlMeans Common](https://github.com/owlmeans/common): the
contract package declares the provider interface and a host in the context, the package here
implements it and registers explicitly (`appendXxx(ctx)` or the host's options). Common never depends
on Connect.

Run `./setup.sh` and `bun install`; `bun run build`, `bun run test`.

## Package catalogue

Each package has its own README and a canonical skill under [`.agents/skills`](.agents/skills).

| Group | Package | Purpose |
|---|---|---|
| Server bot platforms | [`bot-telegram`](packages/bot-telegram) | The Telegram plugin of `@owlmeans/server-bot`: descriptor, Bot API calls, webhook and long polling, mock |
|  | [`bot-whatsapp`](packages/bot-whatsapp) | The WhatsApp Cloud API plugin of `@owlmeans/server-bot`: descriptor, signed webhook, messaging calls, mock |
|  | [`bot-discord`](packages/bot-discord) | The Discord plugin of `@owlmeans/server-bot`: descriptor, gateway receiver, REST actions, invite link, mock |
|  | [`bot-slack`](packages/bot-slack) | The Slack plugin of `@owlmeans/server-bot`: descriptor, signed Events API hook, Web API actions, mock |
| Server captcha | [`captcha-recaptcha`](packages/captcha-recaptcha) | The Google reCAPTCHA provider of `@owlmeans/captcha`: the siteverify verifier and its config record |
| Server payment | [`server-payment-stripe`](packages/server-payment-stripe) | The Stripe provider of `@owlmeans/server-payment`: checkout, subscriptions, refunds and credit notes, webhooks, catalogue sync, customer portal, Stripe Tax and FX quotes |
| Server mail | [`mailer-mailgun`](packages/mailer-mailgun) | The Mailgun HTTP transport of the `@owlmeans/mailer` host |
| Package registries | [`package-registry-npm`](packages/package-registry-npm) | The npm adapter of `@owlmeans/package-inspector`: packuments and readmes, bulk weekly downloads of a name's neighbours, the repository's own manifest name (`appendNpmRegistry`) |
| Reader sources | [`llm-reader-google-drive`](packages/llm-reader-google-drive) | The Google Drive source of `@owlmeans/llm-reader`: public folder, file and Docs links collected as files — keyless folder listing or Drive API v3, the virus-scan form followed, editor files exported (`createGoogleDriveSource`) |
| Web captcha | [`web-captcha-recaptcha`](packages/web-captcha-recaptcha) | The Google reCAPTCHA client of `@owlmeans/web-captcha`: the v3 loader, Google's notice and the v2 checkbox widget (`./react`) |
| Web tags | [`web-gtm`](packages/web-gtm) | Google behind OwlMeans consent: Consent Mode as consent's signal provider (`appendGoogleConsentMode`), the head snippet with its defaults, `headTag`/`consentHeadTag`, the tag-manager analytics sink, the id validator and CSP host lists |
