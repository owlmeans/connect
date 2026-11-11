---
name: bot-discord
description: "How to use @owlmeans/bot-discord (OwlMeans connect) — the Discord plugin of @owlmeans/server-bot: registering it (makeDiscordBotPlatform, discordBotPlatform, appendDiscordBotPlatform), its descriptor (bot token, application id, the pre-save invite link with the permission bits; labels and hints in eight languages), the REST v10 calls each step makes, the gateway receiver (heartbeat, identify, resume, intents, fatal close codes), mute and ban needing the server, its normalization and its mock (fake REST and fake gateway). Auto-invoked when wiring Discord into a bot service, debugging a Discord connection, gateway or refusal, or testing against the Discord mock."
user-invocable: false
---

# @owlmeans/bot-discord

**Layer:** Server (a platform plugin)
**Repo:** OwlMeans connect (`@owlmeans/bot-discord`) — the Discord-specific half; the bot runtime it plugs
into (`@owlmeans/server-bot`) and the contract (`@owlmeans/bot`) are in common, which never depends on it
**Install:** `"@owlmeans/bot-discord": "^0.2.0-alpha.0"` in the backend's `dependencies`

The Discord plugin (REST v10 + gateway): a `BotPlatformPlugin` over server-bot's public helpers, its
descriptor (`DISCORD_DESCRIPTOR` — the data the panels draw through `platform.list`, its labels and hints
in the eight panel languages) and its API-faithful mock. The plugin interface, the rules every plugin
follows and the mock transport are the `server-bot` skill's `platforms` part.

## Registration — explicit, never a side-effect import

```ts
import { makeBotService } from '@owlmeans/server-bot'
import { discordBotPlatform } from '@owlmeans/bot-discord'

makeBotService({ secret, platforms: [discordBotPlatform /* , the other platforms the product supports */] })
// or, on a context whose bot service exists (appendBot's defaults otherwise):
appendDiscordBotPlatform(context, options?)        // = appendBot(context).register(makeDiscordBotPlatform(options))
```

| Export | What it is |
|---|---|
| `discordBotPlatform` | the ready instance — its `mock` holds the mock state of every mock connection it serves |
| `makeDiscordBotPlatform({ base, socket, reconnectMs, userAgent })` | a configured plugin (a test or a proxy) |
| `appendDiscordBotPlatform(ctx, options?, alias?)` | registers a configured plugin on the context's bot service |
| `DISCORD_PLATFORM` (`'discord'`), `DISCORD_DESCRIPTOR`, `DISCORD_CREDENTIALS`, `DISCORD_HINT` | the stored id and the descriptor data |
| `DiscordApiError`, `DiscordGatewayError` | the API refusals — subclasses of `BotErrorPlatform` declaring NO type name of their own: they travel as `BotErrorPlatform` (`bot:platform:discord:<detail>`), so a refusal is rebuilt and explained where this package is not loaded |
| `DISCORD_*`, `DISCORD_DESCRIPTOR`, `DISCORD_INVITE_LINK`, `discordSetupHelper` | protocol constants and helpers |

- The id `discord` is stored on every connection, inbox row and activity, and is the hook URL segment —
  it never changes.
- The descriptor's texts are complete in `en`, `pl`, `ru`, `be`, `uk`, `es`, `de`, `fr`
  (`tests/descriptor.spec.ts` holds that); a new language is added here, never in `@owlmeans/web-bot`.

## The Discord API

Docs (discord.com/developers/docs redirects to docs.discord.com/developers): …/reference (base
`https://discord.com/api/v10`, `Authorization: Bot <token>`, a required `User-Agent: DiscordBot ($url,
$version)`, snowflakes: epoch 1420070400000, `id >> 22` = ms, ids are strings), …/topics/rate-limits
(429 body `{ message, retry_after (s, float), global, code? }` + `Retry-After`; 10 000 401/403/429 per
10 min ban the IP; 50 req/s global), …/events/gateway (connect, heartbeat, identify, resume, intents),
…/events/gateway-events (payload `{ op, d, s, t }`, READY, MESSAGE_CREATE/UPDATE extra fields
`guild_id`, `member`), …/topics/opcodes-and-status-codes (opcodes, close codes, JSON error codes),
…/resources/message (create/delete message, reactions, `message_reference`, `allowed_mentions`, types
DEFAULT 0 / REPLY 19), …/resources/guild (Modify Guild Member, Create Guild Ban), …/resources/user,
…/topics/permissions, …/topics/oauth2 (bot invite URL). Calls are `<method> <base><route>` with JSON;
a 204 is `undefined`; a refusal `{ code, message, errors? }` → `DiscordApiError`
`bot:platform:discord:<status>:<json code>:<message>` (`status`, `code`, `retryAfter`). `base` defaults to
`https://discord.com/api/v10` (`makeDiscordBotPlatform({ base, socket, reconnectMs = 1000, userAgent })`).
A 429 waits `retry_after` and retries ≤ 3 times while each wait ≤ 10 s, else fails 429 with `retryAfter`.

| Plugin step | Discord | Notes |
|---|---|---|
| verify | `GET /users/@me` → `{ id, username, name: global_name }` | 401/403 → `BotCredentialsRejected` (`discord:<status>`) |
| registerHook | — (`setup: 'auto'`, receive `gateway` only) | Discord posts no message webhooks; verify leaves `receive: gateway` |
| setup | invite `https://discord.com/oauth2/authorize?client_id=<applicationId>&scope=bot&permissions=1374389611588` | `discordSetupHelper` (`inviteUrl`, `permissions`, `steps`); the bits (`DISCORD_PERMISSIONS`): VIEW_CHANNEL 1<<10, SEND_MESSAGES 1<<11, SEND_MESSAGES_IN_THREADS 1<<38 (a reply to a thread message), MANAGE_MESSAGES 1<<13 (delete others'), READ_MESSAGE_HISTORY 1<<16 (replies, reactions), ADD_REACTIONS 1<<6, MODERATE_MEMBERS 1<<40 (timeout), BAN_MEMBERS 1<<2; the descriptor's pre-save link (`DISCORD_INVITE_LINK`) is the same URL, filled from the typed application id; the MESSAGE CONTENT privileged intent must be on (Developer Portal → Bot), and the bot's role above the members it moderates |
| authenticate | — | rejects EVERY hook request, live or mock (`gateway-only`): Discord posts no message webhooks, and `simulate` does not use the hook. Interaction (Ed25519) requests are not handled: no public-key credential |
| receiver | `GET /gateway/bot` → `url` (refused when `session_start_limit.remaining` is 0), then the socket `?v=10&encoding=json` | see the gateway below; `fatal`: a `DiscordGatewayError` whose code is in `DISCORD_FATAL_CLOSE_CODES` (4004 4010–4014) or a `DiscordApiError` 401 — `0:unreachable`, a spent session-start limit and other REST faults are retried |
| reply | `POST /channels/{chat}/messages { content, message_reference: { type: 0, message_id, channel_id, guild_id?, fail_if_not_exists: false }, allowed_mentions: { parse: ['users'], replied_user: true } }` | content ≤ 2000 (clipped); never pings `@everyone` or a role; the created ref keeps `space` |
| send | `POST /channels/{chat}/messages { content, allowed_mentions: { parse: ['users'] } }` | |
| delete | `DELETE /channels/{chat}/messages/{id}` → 204 | others' messages need MANAGE_MESSAGES; a DM's only the bot's own |
| mute | `PATCH /guilds/{space}/members/{user} { communication_disabled_until: ISO }` | a timeout, capped at now + 28 days (minus a minute); 403 on an administrator or the owner |
| ban | `PUT /guilds/{space}/bans/{user} {}` → 204 | |
| react | `PUT /channels/{chat}/messages/{id}/reactions/{urlencoded emoji}/@me` → 204 | `<:name:id>` / `<a:name:id>` is sent as `name:id`; Unicode as itself |

Mute and ban need the guild: `space` of the update's chat (or of the member target); none (a DM, a
bare chat id) → `act` throws `bot:invalid-action:no-space:<kind>` → `{ ok: false }`. Ids go into paths
URL-encoded.

**Gateway** (`makeDiscordGateway`, one per receiver run; logger `bot-discord`, debug only):
Hello (op 10) → heartbeat op 1 `d` = last sequence received, first beat after `interval × random`,
then every interval; a beat whose predecessor got no op 11 = zombie → close 4200 and resume. Then op 2
Identify `{ token, intents: 37377 (GUILDS 1 | GUILD_MESSAGES 1<<9 | DIRECT_MESSAGES 1<<12 |
MESSAGE_CONTENT 1<<15), properties: { os, browser: 'owlmeans', device: 'owlmeans' } }`, or with a
session from READY op 6 Resume `{ token, session_id, seq }` on READY's `resume_gateway_url` (no
`/gateway/bot` call). Dispatches are handled in order; `MESSAGE_CREATE` / `MESSAGE_UPDATE` are
`emit`ted (awaited) and only a handled dispatch moves the `seq` a resume replays after — a refused
emit closes 4200 and resumes from it. Op 1 from the server → beat at once; op 7 → close 4200, resume
at once; op 9 → wait 1–5 × `reconnectMs`, resume (`d: true`) or identify anew; a drop or another
close → resume after a backoff (`reconnectMs` doubling to 30 s), 4007/4009 → identify anew;
4004 4010 4011 4012 4013 4014 → `DiscordGatewayError` `bot:platform:discord:gateway:<code>:<reason>`
(`authentication-failed`, `disallowed-intents` = MESSAGE CONTENT off, …), no retry; 5 consecutive
connections that never reached READY/RESUMED cleanly → the last fault or `0:unreachable`. No Hello in
30 s → reconnect. Abort → close 1000 (ends the session) and return. No sharding (> 2500 guilds → 4011).

Normalization (a gateway frame `{ op: 0, t, d }`): `MESSAGE_CREATE` → `message` / `command`;
`MESSAGE_UPDATE` with `edited_timestamp` → `edited` (`platformId` `<id>:<edited_timestamp>`), without
one (an embed unfurl) → none; message types other than 0 / 19 (joins, pins, boosts) → none; the bot's
own messages (`author.id` = `identity.id`) → none; other events → none. Chat = `channel_id`, `group`
with `space` = `guild_id`, or `private` without a guild (no title: the payload has no channel name;
a thread is its own channel). Sender = `author` (`name` = `global_name`, `bot`). `replyTo` only for
type 19 with a DEFAULT reference (a forward is none): reference ids + `referenced_message` text and
author. `addressed`: a DM, the bot in `mentions` or `<@id>` / `<@!id>` in the content, or a reply to
the bot's message. Command via `botCommandHelper.parse(content, identity.username)`.

Mock (`discordBotPlatform.mock`, a `DiscordMock`): REST routes recorded under the docs' endpoint
names with path params + body (`getCurrentUser`, `getGatewayBot`, `createMessage`, `deleteMessage`,
`createReaction` with the decoded `emoji`, `modifyGuildMember`, `createGuildBan`); the bot user id is
the `applicationId` when it is a snowflake (`userIdOf`), its username `mock_<id>_bot`; messages get
real, increasing snowflakes (now + random low 22 bits, inbound ones too); refusals as the API words them (50006 empty, 50035 too long / a timeout
past 28 days, 10014 empty emoji, 404/405). The gateway is an in-process fake socket
(`mock.socket(connection)`, chosen by the receiver for a mock session): Hello, READY on Identify
(recorded `gateway:identify` without the token), RESUMED on Resume, op 11 per beat, unknown op →
close 4001; `gateway:connect` records the URL. `feed(connection, frame | message)` delivers to the
identified socket or queues until one identifies. `inbound` builds a real `MESSAGE_CREATE` frame
(guild `space` for group/channel kinds, none for private; non-numeric ids map to stable snowflakes;
`@<bot username>` → `<@id>` + `mentions`; `replyTo` → type 19 + `referenced_message`, from the bot
when the fake API sent that id), unsigned — `simulate` hands it to `normalize` and the inbox, and the
fake gateway delivers what `feed` queues. `reset` closes the fake sockets (4000).


## Testing

`bun test ./tests` (category A — the mock and a test `fetch`, no network): normalization over the
documented payloads, authentication, the API client and its refusals, the mock's answers and its ids'
uniqueness across lifetimes (`mock-ids.spec.ts`), the descriptor (`descriptor.spec.ts`: complete in eight
languages, a restart simulated over the same store), and the platform end to end on a mock connection
through the service (`tests/context.ts`'s `makeTestBot` registers `discordBotPlatform`; `botMockHelper` is
`makeBotMockHelper([discordBotPlatform])`).
