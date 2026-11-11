---
name: bot-whatsapp
description: "How to use @owlmeans/bot-whatsapp (OwlMeans connect) — the WhatsApp Cloud API plugin of @owlmeans/server-bot: registering it (makeWhatsAppBotPlatform, whatsappBotPlatform, appendWhatsAppBotPlatform), its descriptor (access token, phone number id, app secret, the generated verify token; labels and hints in eight languages), the Cloud API calls each step makes, the GET handshake and the X-Hub-Signature-256 check, the manual setup steps, its normalization (one number per connection, the 24-hour window) and its mock. Auto-invoked when wiring WhatsApp into a bot service, debugging a WhatsApp connection, webhook or refusal, or testing against the WhatsApp mock."
user-invocable: false
---

# @owlmeans/bot-whatsapp

**Layer:** Server (a platform plugin)
**Repo:** OwlMeans connect (`@owlmeans/bot-whatsapp`) — the WhatsApp-specific half; the bot runtime it plugs
into (`@owlmeans/server-bot`) and the contract (`@owlmeans/bot`) are in common, which never depends on it
**Install:** `"@owlmeans/bot-whatsapp": "^0.2.0-alpha.0"` in the backend's `dependencies`

The WhatsApp plugin (Cloud API: manual webhook): a `BotPlatformPlugin` over server-bot's public helpers, its
descriptor (`WHATSAPP_DESCRIPTOR` — the data the panels draw through `platform.list`, its labels and hints
in the eight panel languages) and its API-faithful mock. The plugin interface, the rules every plugin
follows and the mock transport are the `server-bot` skill's `platforms` part.

## Registration — explicit, never a side-effect import

```ts
import { makeBotService } from '@owlmeans/server-bot'
import { whatsappBotPlatform } from '@owlmeans/bot-whatsapp'

makeBotService({ secret, platforms: [whatsappBotPlatform /* , the other platforms the product supports */] })
// or, on a context whose bot service exists (appendBot's defaults otherwise):
appendWhatsAppBotPlatform(context, options?)        // = appendBot(context).register(makeWhatsAppBotPlatform(options))
```

| Export | What it is |
|---|---|
| `whatsappBotPlatform` | the ready instance — its `mock` holds the mock state of every mock connection it serves |
| `makeWhatsAppBotPlatform({ base, version })` | a configured plugin (a test or a proxy) |
| `appendWhatsAppBotPlatform(ctx, options?, alias?)` | registers a configured plugin on the context's bot service |
| `WHATSAPP_PLATFORM` (`'whatsapp'`), `WHATSAPP_DESCRIPTOR`, `WHATSAPP_CREDENTIALS`, `WHATSAPP_HINT` | the stored id and the descriptor data |
| `WhatsAppApiError` | the API refusals — subclasses of `BotErrorPlatform` declaring NO type name of their own: they travel as `BotErrorPlatform` (`bot:platform:whatsapp:<detail>`), so a refusal is rebuilt and explained where this package is not loaded |
| `WHATSAPP_*`, `WHATSAPP_DESCRIPTOR`, `whatsappSignatureHelper` | protocol constants and helpers |

- The id `whatsapp` is stored on every connection, inbox row and activity, and is the hook URL segment —
  it never changes.
- The descriptor's texts are complete in `en`, `pl`, `ru`, `be`, `uk`, `es`, `de`, `fr`
  (`tests/descriptor.spec.ts` holds that); a new language is added here, never in `@owlmeans/web-bot`.

## The WhatsApp API

Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint
(handshake + signature), …/webhooks/reference/messages (`text`, `interactive`, `button` payloads),
…/messages/text-messages, …/messages/contextual-replies, …/messages/reaction-messages,
…/business-phone-numbers/phone-numbers, …/support/error-codes (all under
`https://developers.facebook.com/documentation/business-messaging/whatsapp/`). Calls go to
`<base>/<version>/…` with `Authorization: Bearer <accessToken>`; `base` defaults to
`https://graph.facebook.com`, `version` to `v26.0` (`makeWhatsAppBotPlatform({ base, version })`).
A refusal is `{ error: { message, type, code, error_subcode?, fbtrace_id } }` → `WhatsAppApiError`
`bot:platform:whatsapp:<code>:<message>` (`code` = Graph code, `status` = HTTP status; build on `code`, not
the HTTP status — Meta's advice).

| Plugin step | Cloud API | Notes |
|---|---|---|
| verify | `GET /<phoneNumberId>?fields=display_phone_number,verified_name` | identity: id = phone number id, `name` = verified name, `username` = display number; codes 0 3 10 100 190 or HTTP 401/403/404 → `BotCredentialsRejected` |
| registerHook | — (`setup: 'manual'`) | `setup` steps: callback URL = `hookUrl`, verify token, subscribe to `messages`, a permanent System User token, one app per number, the 24-hour window |
| authenticate GET | `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge` | token timing-safe against `verifyToken` (default: the hook secret) → `{ result: 'challenge', text: <hub.challenge> }`; else reject (`hub-mode`, `verify-token`, `hub-challenge`) |
| authenticate POST | `X-Hub-Signature-256: sha256=<hex HMAC-SHA256(appSecret, raw body)>` | over `rawBody` (Meta escapes non-ASCII as `\uXXXX`: a re-serialized body does not verify); no app secret → reject, except a MOCK connection, which signs with its hook secret |
| reply | `POST /<phoneNumberId>/messages { messaging_product: 'whatsapp', recipient_type: 'individual', to, context: { message_id }, type: 'text', text: { body } }` | body ≤ 4096 (clipped); the created message = `messages[0].id` |
| send | the same without `context` | `to` = the chat id = the customer's `wa_id` |
| react | `{ …, type: 'reaction', reaction: { message_id, emoji } }` | only to a customer's message ≤ 30 days old; a failure arrives later as a status webhook (131009) |
| delete / mute / ban | — | not in the descriptor; `act` throws `BotUnsupportedAction` defensively |

Normalization: `object: 'whatsapp_business_account'` → every `entry[].changes[]` with `field:
'messages'` → every `value.messages[]`: `text.body`; `interactive.button_reply.title` /
`list_reply.title`; a template quick reply `button.text`; an `image`/`video`/`document` caption.
Other kinds (reaction, sticker, location, `unsupported` …) and `statuses[]` (delivery receipts) give
no update. Chat = `{ id: from, kind: private, title: profile name }` (Cloud API messages are
one-to-one), sender from `contacts[]` by `wa_id`, `addressed: true`, `platformId` = the `wamid`, a
leading `/cmd` is a command. `context.id` → `replyTo` (its sender is the bot when `context.from` is
the business display number); a `forwarded` context is no reply and carries no quoted text. A change
whose `metadata.phone_number_id` differs from the verified identity is ignored: one Meta app posts
every number's messages to ONE callback URL, so a connection keeps only its own number's. Meta
batches and retries for up to 7 days — the inbox's dedupe on the `wamid` absorbs that.

Mock (`whatsappBotPlatform.mock`, a `WhatsAppMock`): the phone number id is `phoneNumberId` or 15
digits derived from the connection id (`phoneNumberIdOf`), the display number `1555…`
(`displayNumberOf`), the verified name the connection's label. Calls are recorded as `phone-number`
(params = the query) and `messages` (params = the JSON body); a text or reaction answers a fresh
random `wamid.…` (inbound ones too), a bad body or another number id the Graph `{ error }` (code 100, subcode 33). `inbound`
writes Meta's payload for `input.text` from `input.sender.id` (a phone number stays itself; default
`15551230001`), `replyTo` as `context` (from the business when the fake API sent that id), signed
with the app secret or else the hook secret. `challenge(connection, { challenge?, verifyToken? })`
builds the GET handshake. `feed` only keeps the payload — WhatsApp has no receiver.

Not used (the contract says `setup: 'manual'`): Meta's per-number callback override, `POST
/<phoneNumberId> { webhook_configuration: { override_callback_uri, verify_token } }` (…/webhooks/override;
precedence number → business account → app), would let `registerHook` set the hook itself and lift
the one-app-per-number limit.


## Testing

`bun test ./tests` (category A — the mock and a test `fetch`, no network): normalization over the
documented payloads, authentication, the API client and its refusals, the mock's answers and its ids'
uniqueness across lifetimes (`mock-ids.spec.ts`), the descriptor (`descriptor.spec.ts`: complete in eight
languages, a restart simulated over the same store), and the platform end to end on a mock connection
through the service (`tests/context.ts`'s `makeTestBot` registers `whatsappBotPlatform`; `botMockHelper` is
`makeBotMockHelper([whatsappBotPlatform])`).
