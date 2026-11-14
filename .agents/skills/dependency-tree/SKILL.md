---
name: dependency-tree
description: "Connect dependency graph and build order. Use when adding packages or dependency edges."
---

# Dependency-Tree — connect

Connect depends on common only, and common never on connect. No connect package depends on another,
so each one builds right after its common closure (`libraries/common`, built first). Every common
package a connect package names must be listed explicitly in the root `workspaces`. The private
`_tpl` uses `@owlmeans/dep-config` only.

| Package | Direct `@owlmeans/*` dependencies (all common) |
|---|---|
| `bot-discord` | `bot`, `context`, `log`, `server-bot` |
| `bot-slack`, `bot-telegram`, `bot-whatsapp` | `bot`, `context`, `server-bot` |
| `captcha-recaptcha` | `auth`, `captcha`, `config`, `context`, `log` |
| `llm-reader-google-drive` | `error`, `llm-reader`, `log` |
| `mailer-mailgun` | `context`, `error`, `mailer`, `server-context` |
| `package-registry-npm` | `context`, `log`, `package-inspector` |
| `server-payment-stripe` | `config`, `log`, `payment`, `server-api`, `server-payment` |
| `web-captcha-recaptcha` | `web-captcha` |
| `web-gtm` | `consent`, `log`, `web-log` |

Update this table and `.agents/project-structure.md` whenever a package or an edge changes.
