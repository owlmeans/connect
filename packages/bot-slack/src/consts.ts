import {
  BotActionKind, BotReceiveMode, type BotCredentialField, type BotPlatformDescriptor, type BotTexts,
} from '@owlmeans/bot'

/** The Web API (https://docs.slack.dev/apis/web-api/) — override `base` for a proxy or a fake server. */
export const SLACK_API_BASE = 'https://slack.com/api'

/** The headers Slack signs an Events API request with (lower-cased, as servers hand them over). */
export const SLACK_SIGNATURE_HEADER = 'x-slack-signature'
export const SLACK_TIMESTAMP_HEADER = 'x-slack-request-timestamp'
/** Set on a redelivery (1, 2, 3) — the inbox's dedupe key absorbs it. */
export const SLACK_RETRY_NUM_HEADER = 'x-slack-retry-num'

/** The signature scheme: `v0=` + hex HMAC-SHA256(signing secret, `v0:<timestamp>:<raw body>`). */
export const SLACK_SIGNATURE_VERSION = 'v0'

/** A request whose timestamp is further than this from now is a replay (seconds). */
export const SLACK_SIGNATURE_TOLERANCE_S = 300

/** How long one Web API call may take. */
export const SLACK_CALL_TIMEOUT_MS = 15_000

/** Retries of a call answered 429, waiting its `Retry-After` each time. */
export const SLACK_RATE_LIMIT_RETRIES = 2

/** A `Retry-After` longer than this (seconds) is not waited for: the call fails `ratelimited`. */
export const SLACK_RATE_LIMIT_MAX_WAIT_S = 30

/** The wait when a 429 names none (seconds). */
export const SLACK_RATE_LIMIT_DEFAULT_WAIT_S = 1

/** Slack truncates longer text; it is clipped here first, without splitting a surrogate pair. */
export const SLACK_TEXT_MAX = 40_000

/** The `message` subtypes that are a member's new message — every other subtype is ignored. */
export const SLACK_MESSAGE_SUBTYPES = Object.freeze(['thread_broadcast', 'file_share', 'me_message'])

/** The subtype of an edit; it carries the new message in `message`. */
export const SLACK_EDIT_SUBTYPE = 'message_changed'

/** `auth.test` refusals that mean the token itself is wrong — `BotCredentialsRejected`, not a fault. */
export const SLACK_CREDENTIAL_ERRORS = Object.freeze([
  'invalid_auth', 'not_authed', 'account_inactive', 'token_revoked', 'token_expired', 'not_allowed_token_type',
])

/** The bot events a connection subscribes to (Event Subscriptions → Subscribe to bot events). */
export const SLACK_BOT_EVENTS = Object.freeze(['message.channels', 'message.groups', 'message.im', 'app_mention'])

/** The bot token scopes the plugin's calls and events need. */
export const SLACK_BOT_SCOPES = Object.freeze([
  'chat:write', 'channels:history', 'groups:history', 'im:history', 'app_mentions:read', 'reactions:write',
])

/** The user token scope `chat.delete` needs with an admin's token. */
export const SLACK_USER_SCOPES = Object.freeze(['chat:write'])

/** What a person does first: the credentials, saved before Slack checks the Request URL. */
export const SLACK_SETUP_CREDENTIALS_STEP = 'In your Slack app (https://api.slack.com/apps) add the bot token scopes '
  + `${SLACK_BOT_SCOPES.join(', ')} under OAuth & Permissions and install the app to the workspace; save its Bot `
  + 'User OAuth Token (xoxb-…) as botToken and the Signing Secret (Basic Information → App Credentials) as '
  + 'signingSecret on this connection BEFORE the next step — Slack checks the Request URL at once.'

/** Followed by the connection's hook URL. */
export const SLACK_SETUP_HOOK_STEP = 'Under Event Subscriptions, turn events on and paste the Request URL: '

/** When the connection has no hook URL yet (saved without the application's public address). */
export const SLACK_SETUP_HOOK_PENDING_STEP = 'Under Event Subscriptions, turn events on and paste this connection\'s '
  + 'Request URL — open the connection from the application\'s public address to see it.'

/** The rest of the manual setup. */
export const SLACK_SETUP_TAIL_STEPS = Object.freeze([
  `Under "Subscribe to bot events" add ${SLACK_BOT_EVENTS.join(', ')}, save, and reinstall the app if Slack asks.`,
  'Invite the bot to every channel it should read (/invite @your-bot) — it only sees channels it is a member of.',
  'Optional, to delete members\' messages: a workspace admin or owner adds the user token scope '
  + `${SLACK_USER_SCOPES.join(', ')}, reinstalls the app and saves their User OAuth Token (xoxp-…) as userToken; `
  + 'without it the bot warns instead of deleting.',
])

/**
 * Slack reacts by emoji NAME. A Unicode emoji a handler written for any platform passes is mapped
 * here (variation selectors stripped first); an unknown one goes as given and Slack answers `invalid_name`.
 */
export const SLACK_EMOJI_NAMES: Readonly<Record<string, string>> = Object.freeze({
  '👍': '+1',
  '👎': '-1',
  '✅': 'white_check_mark',
  '✔': 'heavy_check_mark',
  '❌': 'x',
  '⚠': 'warning',
  '🚫': 'no_entry_sign',
  '⛔': 'no_entry',
  '🛑': 'octagonal_sign',
  '👀': 'eyes',
  '🙏': 'pray',
  '❤': 'heart',
  '🔥': 'fire',
  '🎉': 'tada',
  '👋': 'wave',
  '😂': 'joy',
  '😀': 'grinning',
  '🙂': 'slightly_smiling_face',
  '😢': 'cry',
  '😡': 'rage',
  '🤔': 'thinking_face',
  '💯': '100',
  '⭐': 'star',
  '🦉': 'owl',
})

/** The mock's simulated defaults: one public channel and one member of the fake workspace. */
export const SLACK_MOCK_CHANNEL_ID = 'C0MOCK00001'
export const SLACK_MOCK_MEMBER_ID = 'U0MOCK00001'
/** Who wrote a simulated thread's parent when it was not the fake bot. */
export const SLACK_MOCK_OTHER_ID = 'U0MOCK00002'
export const SLACK_MOCK_TEAM_NAME = 'Mock workspace'
/** The deprecated verification token every Events API payload still carries — ignored by the plugin. */
export const SLACK_MOCK_VERIFICATION_TOKEN = 'mock-verification-token'
/** A mock `event_id` is `Ev` and this many random characters of {@link SLACK_MOCK_EVENT_ID_ALPHABET}. */
export const SLACK_MOCK_EVENT_ID_LENGTH = 10
export const SLACK_MOCK_EVENT_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** The platform id — a stored column and a hook URL segment: it never changes. */
export const SLACK_PLATFORM = 'slack'

/** What a Slack connection needs typed (or generated), with its labels and hints in every panel language. */
export const SLACK_CREDENTIALS: readonly BotCredentialField[] = Object.freeze([
  Object.freeze({
    key: 'botToken',
    secret: true,
    required: true,
    label: Object.freeze({
      en: 'Bot token (xoxb-…)',
      pl: 'Token bota (xoxb-…)',
      ru: 'Токен бота (xoxb-…)',
      be: 'Токен бота (xoxb-…)',
      uk: 'Токен бота (xoxb-…)',
      es: 'Token del bot (xoxb-…)',
      de: 'Bot-Token (xoxb-…)',
      fr: 'Jeton du bot (xoxb-…)',
    }),
    hint: Object.freeze({
      en: 'Your Slack app → OAuth & Permissions → Bot User OAuth Token.',
      pl: 'Twoja aplikacja Slack → OAuth & Permissions → Bot User OAuth Token.',
      ru: 'Ваше приложение Slack → OAuth & Permissions → Bot User OAuth Token.',
      be: 'Ваша праграма Slack → OAuth & Permissions → Bot User OAuth Token.',
      uk: 'Ваш застосунок Slack → OAuth & Permissions → Bot User OAuth Token.',
      es: 'Tu app de Slack → OAuth & Permissions → Bot User OAuth Token.',
      de: 'Ihre Slack-App → OAuth & Permissions → Bot User OAuth Token.',
      fr: 'Votre app Slack → OAuth & Permissions → Bot User OAuth Token.',
    }),
  }),
  Object.freeze({
    key: 'signingSecret',
    secret: true,
    required: true,
    label: Object.freeze({
      en: 'Signing secret',
      pl: 'Sekret podpisu',
      ru: 'Секрет подписи',
      be: 'Сакрэт подпісу',
      uk: 'Секрет підпису',
      es: 'Secreto de firma',
      de: 'Signaturgeheimnis',
      fr: 'Secret de signature',
    }),
    hint: Object.freeze({
      en: 'Your Slack app → Basic Information → App Credentials.',
      pl: 'Twoja aplikacja Slack → Basic Information → App Credentials.',
      ru: 'Ваше приложение Slack → Basic Information → App Credentials.',
      be: 'Ваша праграма Slack → Basic Information → App Credentials.',
      uk: 'Ваш застосунок Slack → Basic Information → App Credentials.',
      es: 'Tu app de Slack → Basic Information → App Credentials.',
      de: 'Ihre Slack-App → Basic Information → App Credentials.',
      fr: 'Votre app Slack → Basic Information → App Credentials.',
    }),
  }),
  Object.freeze({
    key: 'userToken',
    secret: true,
    required: false,
    enables: Object.freeze([BotActionKind.Delete]),
    label: Object.freeze({
      en: 'Admin user token (xoxp-…)',
      pl: 'Token administratora (xoxp-…)',
      ru: 'Токен администратора (xoxp-…)',
      be: 'Токен адміністратара (xoxp-…)',
      uk: 'Токен адміністратора (xoxp-…)',
      es: 'Token de usuario administrador (xoxp-…)',
      de: 'Admin-Benutzertoken (xoxp-…)',
      fr: 'Jeton utilisateur administrateur (xoxp-…)',
    }),
    hint: Object.freeze({
      en: 'Lets the bot delete messages. Installed by a workspace admin; without it the bot warns instead.',
      pl: 'Pozwala botowi usuwać wiadomości. Instaluje go administrator przestrzeni roboczej; bez niego bot zamiast tego ostrzega.',
      ru: 'Позволяет боту удалять сообщения. Устанавливается администратором рабочего пространства; без него бот вместо этого предупреждает.',
      be: 'Дазваляе боту выдаляць паведамленні. Усталёўваецца адміністратарам працоўнай прасторы; без яго бот замест гэтага папярэджвае.',
      uk: 'Дозволяє боту видаляти повідомлення. Встановлює адміністратор робочого простору; без нього бот натомість попереджає.',
      es: 'Permite al bot eliminar mensajes. Lo instala un administrador del espacio de trabajo; sin él, el bot advierte en su lugar.',
      de: 'Erlaubt dem Bot, Nachrichten zu löschen. Ein Workspace-Admin installiert es; ohne es verwarnt der Bot stattdessen.',
      fr: 'Permet au bot de supprimer des messages. Installé par un administrateur de l’espace de travail ; sans lui, le bot avertit à la place.',
    }),
  }),
]) as readonly BotCredentialField[]

/** What a person does in Slack itself so the bot can act — in every panel language. */
export const SLACK_HINT: BotTexts = Object.freeze({
  en: 'Paste the URL below as the Request URL under Event Subscriptions of your Slack app, subscribe to message events and add the bot to its channels.',
  pl: 'Wklej poniższy adres jako Request URL w Event Subscriptions swojej aplikacji Slack, zasubskrybuj zdarzenia wiadomości i dodaj bota do jego kanałów.',
  ru: 'Вставьте URL ниже как Request URL в разделе Event Subscriptions вашего приложения Slack, подпишитесь на события сообщений и добавьте бота в нужные каналы.',
  be: 'Устаўце URL ніжэй як Request URL у раздзеле Event Subscriptions вашай праграмы Slack, падпішыцеся на падзеі паведамленняў і дадайце бота ў патрэбныя каналы.',
  uk: 'Вставте URL нижче як Request URL у розділі Event Subscriptions вашого застосунку Slack, підпишіться на події повідомлень і додайте бота до потрібних каналів.',
  es: 'Pega la URL de abajo como Request URL en Event Subscriptions de tu app de Slack, suscríbete a los eventos de mensajes y añade el bot a sus canales.',
  de: 'Fügen Sie die URL unten als Request URL unter Event Subscriptions Ihrer Slack-App ein, abonnieren Sie Nachrichtenereignisse und fügen Sie den Bot seinen Kanälen hinzu.',
  fr: 'Collez l’URL ci-dessous comme Request URL dans Event Subscriptions de votre app Slack, abonnez-vous aux événements de message et ajoutez le bot à ses canaux.',
})

/**
 * The Slack descriptor — what the server verifies and acts by and what the panels draw (`platform.list`).
 * `actions` are the calls the required credentials allow; `note` is never listed.
 */
export const SLACK_DESCRIPTOR: BotPlatformDescriptor = Object.freeze({
  platform: SLACK_PLATFORM,
  title: 'Slack',
  glyph: 'hash',
  credentials: SLACK_CREDENTIALS,
  receive: Object.freeze([BotReceiveMode.Webhook]),
  actions: Object.freeze([BotActionKind.Reply, BotActionKind.Send, BotActionKind.React]),
  setup: 'manual',
  docs: 'https://api.slack.com/apis/events-api',
  hint: SLACK_HINT,
}) as BotPlatformDescriptor
