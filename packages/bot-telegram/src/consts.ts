import {
  BotActionKind, BotReceiveMode, type BotCredentialField, type BotPlatformDescriptor, type BotTexts,
} from '@owlmeans/bot'

/** The Bot API server — override `base` for a self-hosted one (https://github.com/tdlib/telegram-bot-api). */
export const TELEGRAM_API_BASE = 'https://api.telegram.org'

/** The header Telegram sends a webhook's `secret_token` in (lower-cased, as servers hand it over). */
export const TELEGRAM_SECRET_HEADER = 'x-telegram-bot-api-secret-token'

/** The update kinds a connection subscribes to — `setWebhook` and `getUpdates` alike. */
export const TELEGRAM_ALLOWED_UPDATES = Object.freeze(['message', 'edited_message', 'channel_post'])

/** Long-polling timeout of `getUpdates`, in seconds. */
export const TELEGRAM_POLL_TIMEOUT_S = 25

/** How long one ordinary Bot API call may take. */
export const TELEGRAM_CALL_TIMEOUT_MS = 15_000

/**
 * The Bot API's answers that mean the token itself is refused — 401 Unauthorized (revoked) and
 * 404 Not Found (no such bot). Verification turns them into `BotCredentialsRejected`; a receiver
 * meeting one stops for good (the connection fails until it is verified or saved again).
 */
export const TELEGRAM_FATAL_CODES: readonly number[] = Object.freeze([401, 404])

/** `sendMessage` text limit (characters after entity parsing) — longer text is clipped. */
export const TELEGRAM_TEXT_MAX = 4096

/** The ports `setWebhook` accepts. */
export const TELEGRAM_HOOK_PORTS = Object.freeze([443, 80, 88, 8443])

/** Every send permission off — what `mute` restricts (`use_independent_chat_permissions: true`). */
export const TELEGRAM_MUTED_PERMISSIONS = Object.freeze({
  can_send_messages: false,
  can_send_audios: false,
  can_send_documents: false,
  can_send_photos: false,
  can_send_videos: false,
  can_send_video_notes: false,
  can_send_voice_notes: false,
  can_send_polls: false,
  can_send_other_messages: false,
  can_add_web_page_previews: false,
  can_react_to_messages: false,
})

/** What a person does in Telegram for the bot to see and moderate a group. */
export const TELEGRAM_SETUP_STEPS = Object.freeze([
  'Add the bot to your group or channel.',
  'Make it an administrator with the rights to delete messages and to ban (restrict) members — moderation needs them.',
  'Without administrator rights a bot sees only commands, mentions and replies to it: turn privacy mode off in @BotFather (/setprivacy → Disable) for it to read every message.',
])

/** The mock's simulated defaults: a supergroup, one member. */
export const TELEGRAM_MOCK_GROUP_ID = -1001000000001
export const TELEGRAM_MOCK_GROUP_TITLE = 'Simulated group'
export const TELEGRAM_MOCK_SENDER_ID = 424242001
export const TELEGRAM_MOCK_SENDER_NAME = 'Test member'
/** The largest `message_id` / `update_id` the Bot API hands out: a signed 32-bit integer. */
export const TELEGRAM_ID_MAX = 2_147_483_647
/**
 * The ids a mock sequence keeps free above its random start — what one process lifetime of a
 * connection may mint before the sequence starts afresh at another random point.
 */
export const TELEGRAM_MOCK_ID_HEADROOM = 16_777_216

/** The platform id — a stored column and a hook URL segment: it never changes. */
export const TELEGRAM_PLATFORM = 'telegram'

/** What a Telegram connection needs typed (or generated), with its labels and hints in every panel language. */
export const TELEGRAM_CREDENTIALS: readonly BotCredentialField[] = Object.freeze([
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
      en: 'From @BotFather in Telegram: /newbot creates a bot, /token shows its token.',
      pl: 'Od @BotFather w Telegramie: /newbot tworzy bota, /token pokazuje jego token.',
      ru: 'У @BotFather в Telegram: /newbot создаёт бота, /token показывает его токен.',
      be: 'У @BotFather у Telegram: /newbot стварае бота, /token паказвае яго токен.',
      uk: 'У @BotFather у Telegram: /newbot створює бота, /token показує його токен.',
      es: 'De @BotFather en Telegram: /newbot crea un bot y /token muestra su token.',
      de: 'Von @BotFather in Telegram: /newbot legt einen Bot an, /token zeigt sein Token.',
      fr: 'Auprès de @BotFather dans Telegram : /newbot crée un bot, /token affiche son jeton.',
    }),
  }),
]) as readonly BotCredentialField[]

/** What a person does in Telegram itself so the bot can act — in every panel language. */
export const TELEGRAM_HINT: BotTexts = Object.freeze({
  en: 'Add the bot to your group as an administrator with the right to delete messages and to ban users, so it can act on what it reads.',
  pl: 'Dodaj bota do grupy jako administratora z prawem usuwania wiadomości i blokowania użytkowników, aby mógł reagować na to, co czyta.',
  ru: 'Добавьте бота в группу администратором с правом удалять сообщения и блокировать пользователей, чтобы он мог реагировать на прочитанное.',
  be: 'Дадайце бота ў групу адміністратарам з правам выдаляць паведамленні і блакаваць карыстальнікаў, каб ён мог рэагаваць на прачытанае.',
  uk: 'Додайте бота до групи адміністратором із правом видаляти повідомлення та блокувати користувачів, щоб він міг реагувати на прочитане.',
  es: 'Añade el bot a tu grupo como administrador con permiso para eliminar mensajes y expulsar usuarios, para que pueda actuar sobre lo que lee.',
  de: 'Fügen Sie den Bot Ihrer Gruppe als Administrator mit dem Recht hinzu, Nachrichten zu löschen und Nutzer zu sperren, damit er auf das Gelesene reagieren kann.',
  fr: 'Ajoutez le bot à votre groupe comme administrateur, avec le droit de supprimer des messages et de bannir des utilisateurs, pour qu’il puisse agir sur ce qu’il lit.',
})

/**
 * The Telegram descriptor — what the server verifies and acts by and what the panels draw (`platform.list`).
 * `actions` are the calls the required credentials allow; `note` is never listed.
 */
export const TELEGRAM_DESCRIPTOR: BotPlatformDescriptor = Object.freeze({
  platform: TELEGRAM_PLATFORM,
  title: 'Telegram',
  glyph: 'send',
  credentials: TELEGRAM_CREDENTIALS,
  receive: Object.freeze([BotReceiveMode.Webhook, BotReceiveMode.Poll]),
  actions: Object.freeze([BotActionKind.Reply, BotActionKind.Send, BotActionKind.Delete, BotActionKind.Mute, BotActionKind.Ban, BotActionKind.React]),
  setup: 'auto',
  docs: 'https://core.telegram.org/bots/tutorial#obtain-your-bot-token',
  hint: TELEGRAM_HINT,
}) as BotPlatformDescriptor
