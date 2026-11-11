# @owlmeans/bot-telegram

The Telegram plugin of OwlMeans chat bots: a `BotPlatformPlugin` for `@owlmeans/server-bot` over
the Telegram Bot API: `getMe` verifies the token, `setWebhook` with a per-connection `secret_token` registers the hook on a public HTTPS origin (long polling with `getUpdates` otherwise), and `sendMessage`, `deleteMessage`, `restrictChatMember`, `banChatMember` and `setMessageReaction` act. It ships the platform's descriptor (`TELEGRAM_DESCRIPTOR` — credentials with their labels and
hints in eight languages, receive modes, actions, setup hint) that the
`@owlmeans/web-bot` panels draw through `platform.list`, and an API-faithful mock the platform's tests,
the runtime smoke and end-to-end runs use. It lives in OwlMeans connect because it names a provider;
the bot runtime and contract it plugs into are in common, which never depends on it.

## Installation

```bash
bun add @owlmeans/bot-telegram@^0.2.0-alpha.0
```

## Usage

Registration is explicit — importing the package registers nothing:

```typescript
import { makeBotService } from '@owlmeans/server-bot'
import { telegramBotPlatform } from '@owlmeans/bot-telegram'

export const makeService = () => makeBotService({
  secret: () => process.env.APP_SECRET ?? '',
  platforms: [telegramBotPlatform],          // beside the other platforms the product supports
})

// or, on a context whose bot service may not exist yet:
import { appendTelegramBotPlatform } from '@owlmeans/bot-telegram'
appendTelegramBotPlatform(context)
```

## The platform

| | |
|---|---|
| Id (stored, in the hook URL) | `telegram` (`TELEGRAM_PLATFORM`) |
| Credentials | `token` (from @BotFather) |
| Receive | webhook (auto) or long polling |
| Actions | reply, send, delete, mute, ban, react |
| Refusals | `TelegramApiError` (`bot:platform:telegram:<error_code>:<description>`, `code`, `retryAfter`) — subclasses of `BotErrorPlatform`, travelling under its type name |
| Options | `makeTelegramBotPlatform({ … })`: `base` — a self-hosted Bot API server |

## API

- `telegramBotPlatform` — the ready instance; `makeTelegramBotPlatform(options?)` — a configured one;
  `appendTelegramBotPlatform(context, options?, alias?)` — register on the context's bot service
- `TELEGRAM_PLATFORM`, `TELEGRAM_DESCRIPTOR`, `TELEGRAM_CREDENTIALS`, `TELEGRAM_HINT` and the protocol constants
- the native payload types and the plugin's options

The `bot-telegram` skill covers every API call the plugin makes, its normalization and its mock; the
`server-bot` skill (common) covers the plugin interface, the mock transport and the runtime.

## Related packages

- `@owlmeans/server-bot` — the bot runtime this plugs into (common)
- `@owlmeans/bot` — the contract: the descriptor, connections, updates, the errors (common)
- `@owlmeans/web-bot` — the panels that draw the descriptor (common)

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
