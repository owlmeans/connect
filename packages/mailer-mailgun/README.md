# @owlmeans/mailer-mailgun

A production transport for the OwlMeans mailer host (`@owlmeans/mailer`) that sends mail through
Mailgun's HTTP API with the global `fetch` — no SDK and no SMTP socket. A server registers it from
`makeContext`, and platform code (the OTP login, notifications) keeps resolving `MAILER_SERVICE`
without knowing the transport. Use `@owlmeans/mailer-smtp` instead when the relay is reached over
SMTP, and the console transport of `@owlmeans/mailer` in development and tests — this transport
always sends. It replaces `@owlmeans/server-mailer-mailgun`, frozen at 0.1.21.

## Installation

```bash
bun add @owlmeans/mailer-mailgun@^0.2.0-alpha.0
```

## Concepts

- **Transport** — a `MailerTransport` (from `@owlmeans/mailer`) bound to the context whose
  `cfg.mailgun` it reads. `send(message)` posts to `${baseUrl}/${domain}/messages` with Basic auth
  `api:<apiKey>`; `init()` validates the block while the context starts.
- **Registration** — `appendMailgunMailer(ctx, opts?)` registers it with the mailer host
  (`MAILER_SERVICE`, or `opts.alias`) and returns it. Explicit — importing the package registers
  nothing.
- **Config** — `ServerConfig.mailgun?: MailgunSettings` is declared by module augmentation, so any
  server config types the block once this package is imported. It is read at init and on every
  send, so it must be on the registered context's config, not passed to the factory.
- **Body shape** — `application/x-www-form-urlencoded` for a plain message; `multipart/form-data`
  with one `attachment` part per file when the message carries attachments.

## Usage

### Configure

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

### Register

```typescript
import { appendMailgunMailer } from '@owlmeans/mailer-mailgun'

// in makeContext
appendMailgunMailer(context)
```

### Send

```typescript
import { MAILER_SERVICE } from '@owlmeans/mailer'
import type { MailerService } from '@owlmeans/mailer'

await context.service<MailerService>(MAILER_SERVICE).send({
  to: 'person@example.com',
  subject: 'Invoice',
  html: '<p>Your invoice is attached.</p>',
  replyTo: 'billing@example.com',
  headers: { 'X-Invoice': 'inv-42' },
  attachments: [{ filename: 'invoice.pdf', content: pdfBytes, contentType: 'application/pdf' }],
})
```

## API

| Symbol | Kind | Purpose |
|---|---|---|
| `appendMailgunMailer(ctx, opts?)` | function | register the transport with the mailer host (`opts.alias`, default `MAILER_SERVICE`) and return it |
| `makeMailgunMailerTransport(ctx, opts?)` | function | the transport, bound to `ctx`; `opts.id` defaults to `MAILGUN_MAILER` |
| `MAILGUN_MAILER` | const | `'mailgun-mailer'` — default transport id |
| `MAILGUN_DEFAULT_BASE_URL` | const | `'https://api.mailgun.net/v3'` (US region) |
| `MailgunSettings` | interface | `{ apiKey, domain, from, baseUrl? }` — the `cfg.mailgun` block |
| `MailgunConfig` | interface | `ServerConfig` + `mailgun: MailgunSettings` (required) |
| `MailgunMailerTransportOptions` / `MailgunMailerAppendOptions` | interface | `{ id? }` / `{ id?, alias? }` |

### Message fields on the wire

| `MailMessage` field | Sent as |
|---|---|
| `from` | `from`, overriding `cfg.mailgun.from` for that message |
| `to`, `subject`, `text`, `html` | parameters of the same name; `text` / `html` omitted when empty |
| `replyTo` | `h:Reply-To` |
| `headers` | one `h:<name>` parameter each |
| `attachments` | one `attachment` part each — a `Blob` of `mailAttachmentHelper.bytesOf(…)`, typed `contentType` (default `application/octet-stream`), named `filename` |

## Common pitfalls

- A missing `cfg.mailgun.apiKey`, `domain` or `from` fails the context start
  (`SyntaxError('mailgun-mailer: cfg.mailgun.<keys> is not configured')`).
- A non-2xx response throws a plain `Error('Mailgun send failed [<status>]: <body>')`; there is no
  retry, so wrap it in a domain error where needed.
- No `o:` options are sent, so Mailgun's test mode is unreachable — an environment that must not mail
  anyone registers the console transport instead.
- Never use it in tests; use the console transport (`createConsoleMailerTransport`).
- There is no `verify()` or `close()`: the transport holds no connection, so nothing is torn down at
  shutdown.

## Related packages

- [`@owlmeans/mailer`](https://github.com/owlmeans/common/tree/main/packages/mailer) — the host, `MailerTransport`, `mailAttachmentHelper`, console transport
- [`@owlmeans/mailer-smtp`](https://github.com/owlmeans/common/tree/main/packages/mailer-smtp) — SMTP transport for a relay reached over SMTP
- [`@owlmeans/server-auth-otp`](https://github.com/owlmeans/common/tree/main/packages/server-auth-otp) — sends login codes through `MAILER_SERVICE`
- [`@owlmeans/server-context`](https://github.com/owlmeans/common/tree/main/packages/server-context) — `ServerConfig`, which the augmentation extends

The `mailer-mailgun` skill covers the same transport for agents.

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
