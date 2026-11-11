import {
  BotActionKind, BotReceiveMode, type BotCredentialField, type BotPlatformDescriptor, type BotTexts, type BotPlatformLink,
} from '@owlmeans/bot'

/** The REST API, version 10 — override `base` for a proxy (https://discord.com/developers/docs/reference). */
export const DISCORD_API_BASE = 'https://discord.com/api/v10'

/** The gateway protocol version and encoding the socket URL asks for (`?v=10&encoding=json`). */
export const DISCORD_GATEWAY_VERSION = '10'
export const DISCORD_GATEWAY_ENCODING = 'json'

/** Discord requires `DiscordBot ($url, $versionNumber)`; a request without one may be blocked by Cloudflare. */
export const DISCORD_USER_AGENT = 'DiscordBot (https://owlmeans.org, 1.0) @owlmeans/bot-discord'

/** The invite page a server owner opens to add the bot (`scope=bot`). */
export const DISCORD_INVITE_BASE = 'https://discord.com/oauth2/authorize'

/** How long one ordinary REST call may take. */
export const DISCORD_CALL_TIMEOUT_MS = 15_000

/** A 429 is retried at most this many times, and only while `retry_after` is no longer than the wait below. */
export const DISCORD_RATE_LIMIT_RETRIES = 3
export const DISCORD_RATE_LIMIT_WAIT_MAX_MS = 10_000

/** Create Message `content` limit — longer text is clipped. */
export const DISCORD_TEXT_MAX = 2000

/**
 * A timeout (`communication_disabled_until`) may end at most 28 days from now; a minute is kept back
 * for the clock difference between this server and Discord's.
 */
export const DISCORD_TIMEOUT_MAX_MS = 28 * 24 * 60 * 60 * 1000 - 60_000

/** The Discord epoch of snowflake ids (the first millisecond of 2015). */
export const DISCORD_EPOCH = 1_420_070_400_000

/** The bits below a snowflake's timestamp (worker 5, process 5, increment 12). */
export const DISCORD_SNOWFLAKE_LOW_BITS = 22

/** Gateway opcodes (https://discord.com/developers/docs/topics/opcodes-and-status-codes#gateway-gateway-opcodes). */
export enum DiscordGatewayOp {
  Dispatch = 0,
  Heartbeat = 1,
  Identify = 2,
  Resume = 6,
  Reconnect = 7,
  InvalidSession = 9,
  Hello = 10,
  HeartbeatAck = 11,
}

/** Gateway intents (https://discord.com/developers/docs/events/gateway#gateway-intents). */
export const DISCORD_INTENTS = Object.freeze({
  Guilds: 1 << 0,
  GuildMessages: 1 << 9,
  DirectMessages: 1 << 12,
  /** Privileged: switched on in the Developer Portal, else the gateway closes with 4014. */
  MessageContent: 1 << 15,
})

/** What the receiver identifies with: GUILDS | GUILD_MESSAGES | DIRECT_MESSAGES | MESSAGE_CONTENT = 37377. */
export const DISCORD_GATEWAY_INTENTS = DISCORD_INTENTS.Guilds | DISCORD_INTENTS.GuildMessages
  | DISCORD_INTENTS.DirectMessages | DISCORD_INTENTS.MessageContent

/** The dispatches the receiver hands to the inbox; every other event only moves the sequence. */
export const DISCORD_DISPATCH_EVENTS = Object.freeze(['MESSAGE_CREATE', 'MESSAGE_UPDATE'])

/** Permission bits (https://discord.com/developers/docs/topics/permissions) — 64-bit, hence `bigint`. */
export const DISCORD_PERMISSIONS = Object.freeze({
  BanMembers: 1n << 2n,
  AddReactions: 1n << 6n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  ManageMessages: 1n << 13n,
  ReadMessageHistory: 1n << 16n,
  SendMessagesInThreads: 1n << 38n,
  ModerateMembers: 1n << 40n,
})

/**
 * What the invite asks for — every action the plugin makes: view, send (also in threads — a reply to a
 * thread message is sent in the thread), read history (replies), manage messages (delete), add
 * reactions, moderate members (timeout) and ban members = 1374389611588.
 */
export const DISCORD_INVITE_PERMISSIONS = Object.values(DISCORD_PERMISSIONS)
  .reduce((bits, bit) => bits | bit, 0n).toString()

/** Message types the bot reads: DEFAULT and REPLY; system messages (joins, pins, boosts…) are ignored. */
export const DISCORD_MESSAGE_DEFAULT = 0
export const DISCORD_MESSAGE_REPLY = 19

/**
 * Close codes the gateway must not be reconnected after — a person has to change something first
 * (https://discord.com/developers/docs/topics/opcodes-and-status-codes#gateway-gateway-close-event-codes).
 */
export const DISCORD_FATAL_CLOSE_CODES: Readonly<Record<number, string>> = Object.freeze({
  4004: 'authentication-failed',
  4010: 'invalid-shard',
  4011: 'sharding-required',
  4012: 'invalid-api-version',
  4013: 'invalid-intents',
  4014: 'disallowed-intents',
})

/** Close codes after which the session cannot be resumed: reconnect and identify anew. */
export const DISCORD_NEW_SESSION_CLOSE_CODES = Object.freeze([4007, 4009])

/** What the receiver closes with when it wants to resume — any code but 1000/1001 keeps the session. */
export const DISCORD_RESUME_CLOSE_CODE = 4200

/** What the receiver closes with when it stops — 1000 ends the session (the bot goes offline). */
export const DISCORD_STOP_CLOSE_CODE = 1000

/** `WebSocket` ready states. */
export const DISCORD_SOCKET_CONNECTING = 0
export const DISCORD_SOCKET_OPEN = 1
export const DISCORD_SOCKET_CLOSING = 2
export const DISCORD_SOCKET_CLOSED = 3

/** The first reconnect waits this long, doubling per consecutive failure up to the maximum. */
export const DISCORD_RECONNECT_MS = 1_000
export const DISCORD_RECONNECT_MAX_MS = 30_000

/** Consecutive failed connections (none reached READY / RESUMED cleanly) before the receiver gives up. */
export const DISCORD_RECONNECT_FAILURES_MAX = 5

/** A socket that sends no Hello (op 10) within this long is closed and reconnected. */
export const DISCORD_HELLO_TIMEOUT_MS = 30_000

/** What the receiver tells the gateway it is (`properties` of Identify). */
export const DISCORD_IDENTIFY_BROWSER = 'owlmeans'

/** The mock's simulated defaults: one guild, one text channel, one member. */
export const DISCORD_MOCK_GUILD_ID = '1100000000000000001'
export const DISCORD_MOCK_CHANNEL_ID = '1100000000000000002'
export const DISCORD_MOCK_SENDER_ID = '1100000000000000003'
export const DISCORD_MOCK_OTHER_ID = '1100000000000000004'
export const DISCORD_MOCK_SENDER_USERNAME = 'test_member'
export const DISCORD_MOCK_SENDER_NAME = 'Test member'
/** What the fake gateway answers: Discord's usual interval and URLs. */
export const DISCORD_MOCK_HEARTBEAT_MS = 41_250
export const DISCORD_MOCK_GATEWAY_URL = 'wss://gateway.discord.gg'
export const DISCORD_MOCK_RESUME_URL = 'wss://gateway-us-east1-b.discord.gg'

/** The platform id — a stored column and a hook URL segment: it never changes. */
export const DISCORD_PLATFORM = 'discord'

/** What a Discord connection needs typed (or generated), with its labels and hints in every panel language. */
export const DISCORD_CREDENTIALS: readonly BotCredentialField[] = Object.freeze([
  Object.freeze({
    key: 'token',
    secret: true,
    required: true,
    label: Object.freeze({
      en: 'Bot token',
      pl: 'Token bota',
      ru: 'Токен бота',
      be: 'Токен бота',
      uk: 'Токен бота',
      es: 'Token del bot',
      de: 'Bot-Token',
      fr: 'Jeton du bot',
    }),
    hint: Object.freeze({
      en: 'Developer Portal → your application → Bot → Reset Token. Turn on the Message Content intent there too.',
      pl: 'Developer Portal → Twoja aplikacja → Bot → Reset Token. Włącz tam też intencję Message Content.',
      ru: 'Developer Portal → ваше приложение → Bot → Reset Token. Там же включите интент Message Content.',
      be: 'Developer Portal → ваша праграма → Bot → Reset Token. Там жа ўключыце інтэнт Message Content.',
      uk: 'Developer Portal → ваш застосунок → Bot → Reset Token. Там само увімкніть інтент Message Content.',
      es: 'Developer Portal → tu aplicación → Bot → Reset Token. Activa allí también el intent Message Content.',
      de: 'Developer Portal → Ihre Anwendung → Bot → Reset Token. Aktivieren Sie dort auch den Message-Content-Intent.',
      fr: 'Developer Portal → votre application → Bot → Reset Token. Activez-y aussi l’intent Message Content.',
    }),
  }),
  Object.freeze({
    key: 'applicationId',
    secret: false,
    required: true,
    label: Object.freeze({
      en: 'Application ID',
      pl: 'ID aplikacji',
      ru: 'ID приложения',
      be: 'ID праграмы',
      uk: 'ID застосунку',
      es: 'ID de la aplicación',
      de: 'Anwendungs-ID',
      fr: 'ID de l’application',
    }),
    hint: Object.freeze({
      en: 'Developer Portal → your application → General Information.',
      pl: 'Developer Portal → Twoja aplikacja → General Information.',
      ru: 'Developer Portal → ваше приложение → General Information.',
      be: 'Developer Portal → ваша праграма → General Information.',
      uk: 'Developer Portal → ваш застосунок → General Information.',
      es: 'Developer Portal → tu aplicación → General Information.',
      de: 'Developer Portal → Ihre Anwendung → General Information.',
      fr: 'Developer Portal → votre application → General Information.',
    }),
  }),
]) as readonly BotCredentialField[]

/** What a person does in Discord itself so the bot can act — in every panel language. */
export const DISCORD_HINT: BotTexts = Object.freeze({
  en: 'Invite the bot to your server with the permissions its actions need, and turn on the Message Content intent in the Developer Portal.',
  pl: 'Zaproś bota na swój serwer z uprawnieniami potrzebnymi do jego działań i włącz intencję Message Content w Developer Portal.',
  ru: 'Пригласите бота на свой сервер с правами, нужными для его действий, и включите интент Message Content в Developer Portal.',
  be: 'Запрасіце бота на свой сервер з правамі, патрэбнымі для яго дзеянняў, і ўключыце інтэнт Message Content у Developer Portal.',
  uk: 'Запросіть бота на свій сервер із правами, потрібними для його дій, і увімкніть інтент Message Content у Developer Portal.',
  es: 'Invita al bot a tu servidor con los permisos que necesitan sus acciones y activa el intent Message Content en el Developer Portal.',
  de: 'Laden Sie den Bot mit den Berechtigungen, die seine Aktionen brauchen, auf Ihren Server ein und aktivieren Sie den Message-Content-Intent im Developer Portal.',
  fr: 'Invitez le bot sur votre serveur avec les autorisations dont ses actions ont besoin, et activez l’intent Message Content dans le Developer Portal.',
})

/** The invite drawn in the connect form as soon as the application id is typed (or verified). */
export const DISCORD_INVITE_LINK: BotPlatformLink = Object.freeze({
  kind: 'invite',
  template: `${DISCORD_INVITE_BASE}?client_id={applicationId}&scope=bot&permissions=${DISCORD_INVITE_PERMISSIONS}`,
  params: [Object.freeze({ key: 'applicationId', pattern: '^\\d{5,32}$', identity: true })],
  label: Object.freeze({
    en: 'Invite the bot to a server',
    pl: 'Zaproś bota na serwer',
    ru: 'Пригласить бота на сервер',
    be: 'Запрасіць бота на сервер',
    uk: 'Запросити бота на сервер',
    es: 'Invitar al bot a un servidor',
    de: 'Bot auf einen Server einladen',
    fr: 'Inviter le bot sur un serveur',
  }),
  pending: Object.freeze({
    en: 'The invite link appears once the application ID is known.',
    pl: 'Link z zaproszeniem pojawi się, gdy ID aplikacji będzie znane.',
    ru: 'Ссылка-приглашение появится, когда станет известен ID приложения.',
    be: 'Спасылка-запрашэнне з’явіцца, калі стане вядомы ID праграмы.',
    uk: 'Посилання-запрошення з’явиться, коли стане відомий ID застосунку.',
    es: 'El enlace de invitación aparece cuando se conoce el ID de la aplicación.',
    de: 'Der Einladungslink erscheint, sobald die Anwendungs-ID bekannt ist.',
    fr: 'Le lien d’invitation apparaît dès que l’ID de l’application est connu.',
  }),
}) as BotPlatformLink

/**
 * The Discord descriptor — what the server verifies and acts by and what the panels draw (`platform.list`).
 * `actions` are the calls the required credentials allow; `note` is never listed.
 */
export const DISCORD_DESCRIPTOR: BotPlatformDescriptor = Object.freeze({
  platform: DISCORD_PLATFORM,
  title: 'Discord',
  glyph: 'messages',
  credentials: DISCORD_CREDENTIALS,
  receive: Object.freeze([BotReceiveMode.Gateway]),
  actions: Object.freeze([BotActionKind.Reply, BotActionKind.Send, BotActionKind.Delete, BotActionKind.Mute, BotActionKind.Ban, BotActionKind.React]),
  setup: 'auto',
  docs: 'https://discord.com/developers/docs/quick-start/getting-started',
  hint: DISCORD_HINT,
  link: DISCORD_INVITE_LINK,
}) as BotPlatformDescriptor
