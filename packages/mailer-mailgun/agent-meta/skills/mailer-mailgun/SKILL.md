---
name: mailer-mailgun
description: "How to use @owlmeans/mailer-mailgun — the Mailgun HTTP transport for the @owlmeans/mailer host (makeMailgunMailerTransport, appendMailgunMailer, cfg.mailgun). Use when configuring production mail through Mailgun's API, registering the transport in makeContext, or debugging a Mailgun send failure. Applies to files matching **/context.ts, **/config.ts."
metadata:
  applyTo: "**/context.ts, **/config.ts"
---
<!-- AUTO-GENERATED — do not edit. Regenerate via sync-agent-meta. -->

# Using `@owlmeans/mailer-mailgun`

**Install:** `"@owlmeans/mailer-mailgun": "^0.2.0-alpha.0"` in `dependencies`

A `MailerTransport` for `@owlmeans/mailer`'s host that posts to Mailgun's HTTP API with `fetch` —
no SMTP socket and no SDK, so it bundles and runs anywhere `fetch` does. `@owlmeans/mailer-smtp`
(common) is the alternative when the relay is reached over SMTP. It replaces
`@owlmeans/server-mailer-mailgun`, which stays frozen at 0.1.21 for 0.1 trees.

## Public API surface

| Symbol | Kind | Purpose |
|--------|------|---------|
| `appendMailgunMailer(ctx, opts?)` | fn | Registers the transport with the mailer host (`opts.alias`, default `MAILER_SERVICE`) and returns it |
| `makeMailgunMailerTransport(ctx, opts?)` | fn | The transport, bound to the context whose `cfg.mailgun` it reads; `opts.id` defaults to `MAILGUN_MAILER` |
| `MailgunSettings` | interface | `{ apiKey, domain, from, baseUrl? }` — the `cfg.mailgun` block |
| `MailgunConfig` | interface | `ServerConfig` + required `mailgun: MailgunSettings` |
| `MailgunMailerTransportOptions` / `MailgunMailerAppendOptions` | interface | `{ id? }` / `{ id?, alias? }` |
| `MAILGUN_MAILER` | const | Default transport id `'mailgun-mailer'` |
| `MAILGUN_DEFAULT_BASE_URL` | const | `'https://api.mailgun.net/v3'` (US region) |

## Config shape

`ServerConfig.mailgun?: MailgunSettings` is declared by module augmentation of
`@owlmeans/server-context` (a declared dependency), so any server config types the block once
anything imports this package — no cast to `MailgunConfig` is needed.

```ts
cfg.mailgun = {
  apiKey: process.env.MAILGUN_API_KEY!,
  domain: process.env.MAILGUN_DOMAIN!,          // e.g. 'mg.example.com'
  from: process.env.MAILGUN_FROM!,              // e.g. 'OwlMeans <no-reply@mg.example.com>'
  baseUrl: 'https://api.eu.mailgun.net/v3',     // optional, default MAILGUN_DEFAULT_BASE_URL
}
```

## Registration

```ts
import { appendMailgunMailer } from '@owlmeans/mailer-mailgun'

// in makeContext — explicit; importing the package registers nothing
appendMailgunMailer(context)
```

Callers keep resolving `MAILER_SERVICE` (the host) and never name the transport. A second host for a
transport another service wraps takes `{ alias: '<transport-alias>' }`.

## Message fields on the wire

| `MailMessage` field | Sent as |
|---|---|
| `from` | the `from` parameter, overriding `cfg.mailgun.from` for that message alone |
| `to`, `subject`, `text`, `html` | the parameters of the same name; `text`/`html` are omitted when absent |
| `replyTo` | `h:Reply-To` |
| `headers` | one `h:<name>` parameter each |
| `attachments` | one `attachment` part each: a `Blob` of the decoded bytes, typed `contentType` (default `application/octet-stream`), named `filename` |

A message without attachments is posted `application/x-www-form-urlencoded`; one with attachments
as `multipart/form-data` (the only shape Mailgun takes files in), with the same fields beside the
`attachment` parts. Requests carry Basic auth `api:<apiKey>` to `${baseUrl}/${domain}/messages`.

Every `headers` entry becomes a custom MIME header on the outgoing message. The request carries
**no `o:` option parameters**, so Mailgun's own delivery options — test mode among them — cannot be
asked for through this transport: a message it accepts is a message it sends. An environment that
must not mail anyone registers the console transport (`createConsoleMailerTransport`) instead.

## Rules

- For the EU region, set `baseUrl: 'https://api.eu.mailgun.net/v3'`.
- `cfg.mailgun` is read at `init` and on every send, from the registered context's `cfg` — never
  passed to the factory. Mounted values resolved before the context initializes are the ones used.
- `init` (run by the host while the context starts) throws
  `SyntaxError('<id>: cfg.mailgun.<keys> is not configured')` when `apiKey`, `domain` or `from` is
  missing or blank — a missing account fails the start, never the first mail.
- A non-2xx response throws a plain `Error('Mailgun send failed [<status>]: <body>')`; there is no
  retry, so callers wrap it in a domain error if needed.
- No `verify()` and no connection to close: the transport holds no state between sends.
- Never use it in tests — use the console transport; the package's own specs point `baseUrl` at a
  local `Bun.serve` stand-in for the messages API.
- The transport reaches its context through the factory argument; never through
  `(service as any).ctx`.

## Mailgun over SMTP instead

Mailgun also exposes SMTP, which `@owlmeans/mailer-smtp` (common) drives with no Mailgun code at all —
the OwlMeans platform delivers that way:

- hosts `smtp.mailgun.org` / `smtp.eu.mailgun.org`; port 465 is implicit TLS (`secure: true`),
  25/587/2525 start plain and upgrade with STARTTLS (`secure: false`);
- the SMTP credential is **per sending domain** (`postmaster@<domain>` or a custom user under the
  domain's SMTP settings), not the account login;
- `X-Mailgun-Drop-Message: yes` (a `MailMessage.headers` entry) submits in test mode — accepted,
  never delivered; other `X-Mailgun-*` headers cover tagging, DKIM, tracking and required TLS;
- repeated failed logins lock the shared credential: Mailgun then answers `535 Authentication failed`
  to the correct password too until it is reset in the dashboard — provoke failures with an
  unreachable socket, never a wrong password.

## External references

- [Mailgun — Send via SMTP](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-smtp)
  — SMTP hosts and ports, per-domain credentials, `X-Mailgun-*` headers.

- [Mailgun — Sending messages (HTTP API)](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages)
  — `POST /v3/{domain}/messages`, Basic auth user `api`, `h:` prefix for custom headers, `o:` prefix
  for delivery options, `attachment` parts in `multipart/form-data`; regions
  `api.mailgun.net` (US) and `api.eu.mailgun.net` (EU).

## Related

- `mailer` (common) — the host, `MailerTransport`, `appendMailerTransport` and the console transport
- `mailer-smtp` (common) — the SMTP transport, for a relay reached over SMTP rather than HTTP
- `server-auth-otp` (common) — sends login codes through `MAILER_SERVICE`
