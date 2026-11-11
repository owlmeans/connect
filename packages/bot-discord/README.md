# @owlmeans/bot-discord

The Discord plugin of OwlMeans chat bots: a `BotPlatformPlugin` for `@owlmeans/server-bot` over
the Discord REST API v10 and the gateway: `GET /users/@me` verifies, a gateway connection (heartbeat, identify, resume; the MESSAGE CONTENT intent) receives messages, and the channel and guild routes reply, send, delete, time out, ban and react; the descriptor carries the invite link (with the permission bits the actions need) the connect form draws as soon as the application id is typed. It ships the platform's descriptor (`DISCORD_DESCRIPTOR` — credentials with their labels and
hints in eight languages, receive modes, actions, setup hint, the invite link) that the
`@owlmeans/web-bot` panels draw through `platform.list`, and an API-faithful mock the platform's tests,
the runtime smoke and end-to-end runs use. It lives in OwlMeans connect because it names a provider;
the bot runtime and contract it plugs into are in common, which never depends on it.

## Installation

```bash
bun add @owlmeans/bot-discord@^0.2.0-alpha.0
```

## Usage

Registration is explicit — importing the package registers nothing:

```typescript
import { makeBotService } from '@owlmeans/server-bot'
import { discordBotPlatform } from '@owlmeans/bot-discord'

export const makeService = () => makeBotService({
  secret: () => process.env.APP_SECRET ?? '',
  platforms: [discordBotPlatform],          // beside the other platforms the product supports
})

// or, on a context whose bot service may not exist yet:
import { appendDiscordBotPlatform } from '@owlmeans/bot-discord'
appendDiscordBotPlatform(context)
```

## The platform

| | |
|---|---|
| Id (stored, in the hook URL) | `discord` (`DISCORD_PLATFORM`) |
| Credentials | `token`, `applicationId` |
| Receive | gateway |
| Actions | reply, send, delete, mute (a timeout), ban, react — mute and ban need the server |
| Refusals | `DiscordApiError` (`bot:platform:discord:<status>:<json code>:<message>`), `DiscordGatewayError` (`bot:platform:discord:gateway:<close code>:<reason>`) — subclasses of `BotErrorPlatform`, travelling under its type name |
| Options | `makeDiscordBotPlatform({ … })`: `base`, `socket`, `reconnectMs`, `userAgent` |

## API

- `discordBotPlatform` — the ready instance; `makeDiscordBotPlatform(options?)` — a configured one;
  `appendDiscordBotPlatform(context, options?, alias?)` — register on the context's bot service
- `DISCORD_PLATFORM`, `DISCORD_DESCRIPTOR`, `DISCORD_CREDENTIALS`, `DISCORD_HINT`, `DISCORD_INVITE_LINK`, `discordSetupHelper` and the protocol constants
- the native payload types and the plugin's options

The `bot-discord` skill covers every API call the plugin makes, its normalization and its mock; the
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
