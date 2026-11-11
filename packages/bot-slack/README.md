# @owlmeans/bot-slack

The Slack plugin of OwlMeans chat bots: a `BotPlatformPlugin` for `@owlmeans/server-bot` over
the Slack Events API and Web API: `auth.test` verifies the bot (and the optional admin user) token, every event's `v0` signature is checked over the raw body, `url_verification` is answered, and `chat.postMessage` (always in the thread), `reactions.add` and — with the admin user token — `chat.delete` act; the Request URL is set up by hand in the Slack app. It ships the platform's descriptor (`SLACK_DESCRIPTOR` — credentials with their labels and
hints in eight languages, receive modes, actions, setup hint) that the
`@owlmeans/web-bot` panels draw through `platform.list`, and an API-faithful mock the platform's tests,
the runtime smoke and end-to-end runs use. It lives in OwlMeans connect because it names a provider;
the bot runtime and contract it plugs into are in common, which never depends on it.

## Installation

```bash
bun add @owlmeans/bot-slack@^0.2.0-alpha.0
```

## Usage

Registration is explicit — importing the package registers nothing:

```typescript
import { makeBotService } from '@owlmeans/server-bot'
import { slackBotPlatform } from '@owlmeans/bot-slack'

export const makeService = () => makeBotService({
  secret: () => process.env.APP_SECRET ?? '',
  platforms: [slackBotPlatform],          // beside the other platforms the product supports
})

// or, on a context whose bot service may not exist yet:
import { appendSlackBotPlatform } from '@owlmeans/bot-slack'
appendSlackBotPlatform(context)
```

## The platform

| | |
|---|---|
| Id (stored, in the hook URL) | `slack` (`SLACK_PLATFORM`) |
| Credentials | `botToken`, `signingSecret`, optional admin `userToken` (enables `delete`) |
| Receive | webhook (manual) |
| Actions | reply, send, react; delete with `userToken` |
| Refusals | `SlackApiError` (`bot:platform:slack:<method>:<error>`, `method`, `code`, `retryAfter`) — subclasses of `BotErrorPlatform`, travelling under its type name |
| Options | `makeSlackBotPlatform({ … })`: `base`, `retries`, `maxRetryWaitS` |

## API

- `slackBotPlatform` — the ready instance; `makeSlackBotPlatform(options?)` — a configured one;
  `appendSlackBotPlatform(context, options?, alias?)` — register on the context's bot service
- `SLACK_PLATFORM`, `SLACK_DESCRIPTOR`, `SLACK_CREDENTIALS`, `SLACK_HINT`, `slackSignatureHelper`, `slackTextHelper` and the protocol constants
- the native payload types and the plugin's options

The `bot-slack` skill covers every API call the plugin makes, its normalization and its mock; the
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
