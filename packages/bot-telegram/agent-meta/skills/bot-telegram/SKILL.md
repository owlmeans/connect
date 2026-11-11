---
name: bot-telegram
description: "How to use @owlmeans/bot-telegram (OwlMeans connect) — the Telegram plugin of @owlmeans/server-bot: registering it (makeTelegramBotPlatform, telegramBotPlatform, appendTelegramBotPlatform), its descriptor (the bot token, labels and hints in eight languages), the Bot API calls each step makes (getMe, setWebhook with the secret token, getUpdates long polling, sendMessage, deleteMessage, restrictChatMember, banChatMember, setMessageReaction), its fatal codes, its normalization and addressing rules, privacy mode in groups, and its mock. Auto-invoked when wiring Telegram into a bot service, debugging a Telegram connection, hook, receiver or refusal, or testing against the Telegram mock."
user-invocable: false
---
<!-- AUTO-GENERATED — do not edit. Regenerate via sync-agent-meta. -->

# @owlmeans/bot-telegram

**Layer:** Server (a platform plugin)
**Repo:** OwlMeans connect (`@owlmeans/bot-telegram`) — the Telegram-specific half; the bot runtime it plugs
into (`@owlmeans/server-bot`) and the contract (`@owlmeans/bot`) are in common, which never depends on it
**Install:** `"@owlmeans/bot-telegram": "^0.2.0-alpha.0"` in the backend's `dependencies`

The Telegram plugin (Bot API: webhook or long polling): a `BotPlatformPlugin` over server-bot's public helpers, its
descriptor (`TELEGRAM_DESCRIPTOR` — the data the panels draw through `platform.list`, its labels and hints
in the eight panel languages) and its API-faithful mock. The plugin interface, the rules every plugin
follows and the mock transport are the `server-bot` skill's `platforms` part.

## Registration — explicit, never a side-effect import

```ts
import { makeBotService } from '@owlmeans/server-bot'
import { telegramBotPlatform } from '@owlmeans/bot-telegram'

makeBotService({ secret, platforms: [telegramBotPlatform /* , the other platforms the product supports */] })
// or, on a context whose bot service exists (appendBot's defaults otherwise):
appendTelegramBotPlatform(context, options?)        // = appendBot(context).register(makeTelegramBotPlatform(options))
```

| Export | What it is |
|---|---|
| `telegramBotPlatform` | the ready instance — its `mock` holds the mock state of every mock connection it serves |
| `makeTelegramBotPlatform({ base })` | a configured plugin (a test or a proxy) |
| `appendTelegramBotPlatform(ctx, options?, alias?)` | registers a configured plugin on the context's bot service |
| `TELEGRAM_PLATFORM` (`'telegram'`), `TELEGRAM_DESCRIPTOR`, `TELEGRAM_CREDENTIALS`, `TELEGRAM_HINT` | the stored id and the descriptor data |
| `TelegramApiError` | the API refusals — subclasses of `BotErrorPlatform` declaring NO type name of their own: they travel as `BotErrorPlatform` (`bot:platform:telegram:<detail>`), so a refusal is rebuilt and explained where this package is not loaded |
| `TELEGRAM_*`, `TELEGRAM_DESCRIPTOR` | protocol constants and helpers |

- The id `telegram` is stored on every connection, inbox row and activity, and is the hook URL segment —
  it never changes.
- The descriptor's texts are complete in `en`, `pl`, `ru`, `be`, `uk`, `es`, `de`, `fr`
  (`tests/descriptor.spec.ts` holds that); a new language is added here, never in `@owlmeans/web-bot`.

## The Telegram API

Docs: https://core.telegram.org/bots/api (methods, `Update` and `Message` types, `ReplyParameters`, `ChatPermissions`, `ReactionTypeEmoji`). Calls are
`POST <base>/bot<token>/<method>` with JSON; every answer is `{ ok, result }` or
`{ ok: false, error_code, description, parameters?: { retry_after } }` (`TelegramApiError`,
`bot:platform:telegram:<code>:<description>`). `base` defaults to `https://api.telegram.org`
(`makeTelegramBotPlatform({ base })` for a self-hosted Bot API server).

| Plugin step | Bot API | Notes |
|---|---|---|
| verify | `getMe` → `User` | 401/404 (`TELEGRAM_FATAL_CODES`) → `BotCredentialsRejected` |
| registerHook | `setWebhook { url, secret_token, allowed_updates: [message, edited_message, channel_post] }` | ports 443/80/88/8443; `secret_token` 1–256 of `A-Za-z0-9_-` — the hook secret is base64url |
| authenticate | header `X-Telegram-Bot-Api-Secret-Token` | timing-safe against `hookSecret`; anything but POST is rejected |
| receiver | `deleteWebhook`, then `getUpdates { offset, timeout: 25, allowed_updates }` | `getUpdates` refuses while a webhook is set; `offset` = last `update_id` + 1 confirms; `fatal`: a `TelegramApiError` 401/404 (revoked token, deleted bot) — 409 (another poller) and transport faults are retried |
| reply / send | `sendMessage { chat_id, text, message_thread_id?, reply_parameters: { message_id, allow_sending_without_reply } }` | text 1–4096 (clipped) |
| delete | `deleteMessage { chat_id, message_id }` | only messages < 48 h old; the bot needs admin rights in groups |
| mute | `restrictChatMember { chat_id, user_id, permissions (every send false), use_independent_chat_permissions: true, until_date }` | supergroups only; > 366 days or < 30 s means forever |
| ban | `banChatMember { chat_id, user_id }` | |
| react | `setMessageReaction { chat_id, message_id, reaction: [{ type: 'emoji', emoji }] }` | one reaction for a non-premium bot |

Normalization: `message` / `edited_message` / `channel_post` (`edited_channel_post` too) → chat kind
(`private`; `group` and `supergroup` → `group`; `channel`), sender (`sender_chat` when the message was
sent on behalf of a chat, else `from`), text or caption, `reply_to_message`, the command via
`botCommandHelper.parse(text, botUsername)`, a forum topic's `message_thread_id` as `thread` (only
when `is_topic_message`). `addressed`: a private chat, a `mention` entity of `@<bot>` (offsets are
UTF-16, as JS indices), a `text_mention` of the bot, `/cmd@<bot>`, or a reply to the bot. Ids are
text in the contract and numbers on the wire (chat ids fit 52 bits).

The mock's `update_id` and `message_id` (inbound and `sendMessage`) start at a random point of the
signed 32-bit range per connection state (`TELEGRAM_ID_MAX`, `TELEGRAM_MOCK_ID_HEADROOM`) and count
up — sequential within a lifetime (`getUpdates` offsets work), never re-minted by a restart.

A group bot sees every message only as an administrator or with privacy mode off (@BotFather
`/setprivacy`); the connection's `setup` steps say so.


## Testing

`bun test ./tests` (category A — the mock and a test `fetch`, no network): normalization over the
documented payloads, authentication, the API client and its refusals, the mock's answers and its ids'
uniqueness across lifetimes (`mock-ids.spec.ts`), the descriptor (`descriptor.spec.ts`: complete in eight
languages, a restart simulated over the same store), and the platform end to end on a mock connection
through the service (`tests/context.ts`'s `makeTestBot` registers `telegramBotPlatform`; `botMockHelper` is
`makeBotMockHelper([telegramBotPlatform])`).
