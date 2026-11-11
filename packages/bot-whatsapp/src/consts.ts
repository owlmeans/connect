import {
  BotActionKind, BotReceiveMode, type BotCredentialField, type BotPlatformDescriptor, type BotTexts,
} from '@owlmeans/bot'

/** The Graph API host — override `base` (and `version`) through `makeWhatsAppBotPlatform`. */
export const WHATSAPP_API_BASE = 'https://graph.facebook.com'

/** The Graph API version calls go to: `<base>/<version>/…`. */
export const WHATSAPP_API_VERSION = 'v26.0'

/** The header Meta signs every webhook POST in (lower-cased, as servers hand it over). */
export const WHATSAPP_SIGNATURE_HEADER = 'x-hub-signature-256'

/** What precedes the hex HMAC-SHA256 digest in the signature header. */
export const WHATSAPP_SIGNATURE_PREFIX = 'sha256='

/** `object` of every WhatsApp Business Account webhook payload. */
export const WHATSAPP_WEBHOOK_OBJECT = 'whatsapp_business_account'

/** The webhook field a connection subscribes to — incoming messages and the statuses of sent ones. */
export const WHATSAPP_MESSAGES_FIELD = 'messages'

/** The subscription handshake's `hub.mode`. */
export const WHATSAPP_HUB_MODE = 'subscribe'

/** What `verify` reads of the business phone number. */
export const WHATSAPP_PHONE_FIELDS = 'display_phone_number,verified_name'

/** `messaging_product` of every Cloud API message. */
export const WHATSAPP_MESSAGING_PRODUCT = 'whatsapp'

/** How long one Graph API call may take. */
export const WHATSAPP_CALL_TIMEOUT_MS = 15_000

/** `text.body` limit — longer text is clipped. */
export const WHATSAPP_TEXT_MAX = 4096

/** The credentials a live `verify` calls with (the app secret only signs inbound requests). */
export const WHATSAPP_VERIFY_CREDENTIALS = Object.freeze(['accessToken', 'phoneNumberId'])

/** Graph error codes that refuse the access token or the phone number id (verification fails on them). */
export const WHATSAPP_CREDENTIAL_ERROR_CODES = Object.freeze([0, 3, 10, 100, 190])

/** HTTP statuses that refuse the credentials whatever the error code. */
export const WHATSAPP_CREDENTIAL_STATUSES = Object.freeze([401, 403, 404])

/** The incoming message types whose text the bot reads (media by their caption). */
export const WHATSAPP_CAPTIONED_TYPES = Object.freeze(['image', 'video', 'document'])

/** Where the callback URL and the verify token are pasted (the plugin's first two steps name them). */
export const WHATSAPP_SETUP_CONSOLE = 'In the Meta App Dashboard, open WhatsApp → Configuration → Webhook and press Edit.'

/** The steps after the callback URL and the verify token. */
export const WHATSAPP_SETUP_STEPS = Object.freeze([
  'Under Webhook fields, subscribe to "messages".',
  'Use a permanent System User access token with the whatsapp_business_messaging permission — the temporary token of the API Setup page expires within a day.',
  'A Meta app posts the messages of all its numbers to one callback URL: give every connected number its own app.',
  'Customers write first: WhatsApp lets the bot answer a customer within 24 hours of their last message.',
])

/** The mock's simulated defaults: one customer writing to a test business number. */
export const WHATSAPP_MOCK_SENDER_ID = '15551230001'
export const WHATSAPP_MOCK_SENDER_NAME = 'Test customer'
export const WHATSAPP_MOCK_BUSINESS_NAME = 'Mock business'
/** A mock business number is `1555` and seven digits derived from the connection id. */
export const WHATSAPP_MOCK_NUMBER_PREFIX = '1555'
/** A mock phone number id is fifteen digits derived from the connection id, starting here. */
export const WHATSAPP_MOCK_PHONE_ID_BASE = 100_000_000_000_000
/** Random bytes in a mock `wamid.` (as hex, the way Meta's ids carry a 20-character hex message key). */
export const WHATSAPP_MOCK_ID_BYTES = 10

/** The platform id — a stored column and a hook URL segment: it never changes. */
export const WHATSAPP_PLATFORM = 'whatsapp'

/** What a WhatsApp connection needs typed (or generated), with its labels and hints in every panel language. */
export const WHATSAPP_CREDENTIALS: readonly BotCredentialField[] = Object.freeze([
  Object.freeze({
    key: 'accessToken',
    secret: true,
    required: true,
    label: Object.freeze({
      en: 'Access token',
      pl: 'Token dostępu',
      ru: 'Токен доступа',
      be: 'Токен доступу',
      uk: 'Токен доступу',
      es: 'Token de acceso',
      de: 'Zugriffstoken',
      fr: 'Jeton d’accès',
    }),
    hint: Object.freeze({
      en: 'A permanent system-user token of your Meta app with the WhatsApp messaging permission.',
      pl: 'Stały token użytkownika systemowego Twojej aplikacji Meta z uprawnieniem do wiadomości WhatsApp.',
      ru: 'Постоянный токен системного пользователя вашего приложения Meta с правом отправки сообщений WhatsApp.',
      be: 'Пастаянны токен сістэмнага карыстальніка вашай праграмы Meta з правам адпраўкі паведамленняў WhatsApp.',
      uk: 'Постійний токен системного користувача вашого застосунку Meta з правом надсилати повідомлення WhatsApp.',
      es: 'Un token permanente de usuario del sistema de tu app de Meta con permiso de mensajería de WhatsApp.',
      de: 'Ein dauerhaftes System-User-Token Ihrer Meta-App mit der Berechtigung für WhatsApp-Nachrichten.',
      fr: 'Un jeton permanent d’utilisateur système de votre app Meta, avec l’autorisation de messagerie WhatsApp.',
    }),
  }),
  Object.freeze({
    key: 'phoneNumberId',
    secret: false,
    required: true,
    label: Object.freeze({
      en: 'Phone number ID',
      pl: 'ID numeru telefonu',
      ru: 'ID номера телефона',
      be: 'ID нумара тэлефона',
      uk: 'ID номера телефону',
      es: 'ID del número de teléfono',
      de: 'Telefonnummern-ID',
      fr: 'ID du numéro de téléphone',
    }),
    hint: Object.freeze({
      en: 'WhatsApp → API Setup in your Meta app dashboard.',
      pl: 'WhatsApp → API Setup w panelu Twojej aplikacji Meta.',
      ru: 'WhatsApp → API Setup в панели вашего приложения Meta.',
      be: 'WhatsApp → API Setup у панэлі вашай праграмы Meta.',
      uk: 'WhatsApp → API Setup у панелі вашого застосунку Meta.',
      es: 'WhatsApp → API Setup en el panel de tu app de Meta.',
      de: 'WhatsApp → API Setup im Dashboard Ihrer Meta-App.',
      fr: 'WhatsApp → API Setup dans le tableau de bord de votre app Meta.',
    }),
  }),
  Object.freeze({
    key: 'appSecret',
    secret: true,
    required: true,
    label: Object.freeze({
      en: 'App secret',
      pl: 'Sekret aplikacji',
      ru: 'Секрет приложения',
      be: 'Сакрэт праграмы',
      uk: 'Секрет застосунку',
      es: 'Secreto de la app',
      de: 'App-Geheimnis',
      fr: 'Clé secrète de l’app',
    }),
    hint: Object.freeze({
      en: 'App settings → Basic in your Meta app; it proves every incoming message came from Meta.',
      pl: 'App settings → Basic w Twojej aplikacji Meta; potwierdza, że każda przychodząca wiadomość pochodzi od Meta.',
      ru: 'App settings → Basic в вашем приложении Meta; он подтверждает, что каждое входящее сообщение пришло от Meta.',
      be: 'App settings → Basic у вашай праграме Meta; ён пацвярджае, што кожнае ўваходнае паведамленне прыйшло ад Meta.',
      uk: 'App settings → Basic у вашому застосунку Meta; він підтверджує, що кожне вхідне повідомлення надійшло від Meta.',
      es: 'App settings → Basic en tu app de Meta; demuestra que cada mensaje entrante viene de Meta.',
      de: 'App settings → Basic in Ihrer Meta-App; es belegt, dass jede eingehende Nachricht von Meta stammt.',
      fr: 'App settings → Basic dans votre app Meta ; elle prouve que chaque message entrant vient de Meta.',
    }),
  }),
  Object.freeze({
    key: 'verifyToken',
    secret: true,
    required: true,
    generated: true,
    label: Object.freeze({
      en: 'Verify token',
      pl: 'Token weryfikacyjny',
      ru: 'Токен подтверждения',
      be: 'Токен пацверджання',
      uk: 'Токен підтвердження',
      es: 'Token de verificación',
      de: 'Verifizierungstoken',
      fr: 'Jeton de vérification',
    }),
    hint: Object.freeze({
      en: 'Created for you; paste it into the webhook settings of your Meta app.',
      pl: 'Tworzony dla Ciebie; wklej go w ustawieniach webhooka Twojej aplikacji Meta.',
      ru: 'Создаётся автоматически; вставьте его в настройки вебхука вашего приложения Meta.',
      be: 'Ствараецца аўтаматычна; устаўце яго ў налады вэбхука вашай праграмы Meta.',
      uk: 'Створюється автоматично; вставте його в налаштування вебхука вашого застосунку Meta.',
      es: 'Se crea por ti; pégalo en la configuración del webhook de tu app de Meta.',
      de: 'Wird für Sie erzeugt; fügen Sie es in die Webhook-Einstellungen Ihrer Meta-App ein.',
      fr: 'Créé pour vous ; collez-le dans les paramètres du webhook de votre app Meta.',
    }),
  }),
]) as readonly BotCredentialField[]

/** What a person does in WhatsApp itself so the bot can act — in every panel language. */
export const WHATSAPP_HINT: BotTexts = Object.freeze({
  en: 'Paste the webhook URL and the verify token below into the webhook settings of your Meta app, then subscribe to the messages field.',
  pl: 'Wklej poniższy adres webhooka i token weryfikacyjny w ustawieniach webhooka Twojej aplikacji Meta, a następnie zasubskrybuj pole messages.',
  ru: 'Вставьте URL вебхука и токен подтверждения ниже в настройки вебхука вашего приложения Meta, затем подпишитесь на поле messages.',
  be: 'Устаўце URL вэбхука і токен пацверджання ніжэй у налады вэбхука вашай праграмы Meta, потым падпішыцеся на поле messages.',
  uk: 'Вставте URL вебхука й токен підтвердження нижче в налаштування вебхука вашого застосунку Meta, потім підпишіться на поле messages.',
  es: 'Pega la URL del webhook y el token de verificación de abajo en la configuración del webhook de tu app de Meta y suscríbete al campo messages.',
  de: 'Fügen Sie die Webhook-URL und das Verifizierungstoken unten in die Webhook-Einstellungen Ihrer Meta-App ein und abonnieren Sie dann das Feld messages.',
  fr: 'Collez l’URL du webhook et le jeton de vérification ci-dessous dans les paramètres du webhook de votre app Meta, puis abonnez-vous au champ messages.',
})

/**
 * The WhatsApp descriptor — what the server verifies and acts by and what the panels draw (`platform.list`).
 * `actions` are the calls the required credentials allow; `note` is never listed.
 */
export const WHATSAPP_DESCRIPTOR: BotPlatformDescriptor = Object.freeze({
  platform: WHATSAPP_PLATFORM,
  title: 'WhatsApp',
  glyph: 'phone',
  credentials: WHATSAPP_CREDENTIALS,
  receive: Object.freeze([BotReceiveMode.Webhook]),
  actions: Object.freeze([BotActionKind.Reply, BotActionKind.Send, BotActionKind.React]),
  setup: 'manual',
  docs: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
  hint: WHATSAPP_HINT,
}) as BotPlatformDescriptor
