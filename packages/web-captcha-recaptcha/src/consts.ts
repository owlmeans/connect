import type { CaptchaNotice, CaptchaTexts } from '@owlmeans/web-captcha'

/**
 * The provider id of Google reCAPTCHA — the id the server's provider (`@owlmeans/captcha-recaptcha`)
 * advertises and a page looks this client up by.
 */
export const RECAPTCHA_PROVIDER = 'recaptcha'

/** The client config record whose `value` is the site key (a Frontend record a server advertises). */
export const CMOD_RECAPTCHA = '_client-external:re-captcha'

/** Google's reCAPTCHA script; `?render=<site key>` selects the invisible, score-based (v3) widget. */
export const RECAPTCHA_SCRIPT_URL = 'https://www.google.com/recaptcha/api.js'

/** Marks the script the loader injected; its value is the site key. */
export const RECAPTCHA_SCRIPT_ATTRIBUTE = 'data-owlmeans-captcha'

/** Marks the document style that hides Google's badge. */
export const RECAPTCHA_STYLE_ATTRIBUTE = 'data-owlmeans-captcha-style'

/**
 * The one document-level rule the loader adds unless told not to: Google's badge hidden. A page
 * that hides it must show Google's notice (`RECAPTCHA_TEXTS[lng].notice`) itself.
 */
export const RECAPTCHA_BADGE_CSS = '.grecaptcha-badge{visibility:hidden}'

/** How long the script may take to become ready, in milliseconds. */
export const RECAPTCHA_LOAD_TIMEOUT = 15_000

/** How long one `execute` may take, in milliseconds. */
export const RECAPTCHA_EXECUTE_TIMEOUT = 20_000

/** Google's documents the notice links to. */
export const RECAPTCHA_PRIVACY_URL = 'https://policies.google.com/privacy'
export const RECAPTCHA_TERMS_URL = 'https://policies.google.com/terms'

/** The notice's links, by the placeholder the sentence names them with. */
export const RECAPTCHA_NOTICE: CaptchaNotice = Object.freeze({
  links: Object.freeze({ privacy: RECAPTCHA_PRIVACY_URL, terms: RECAPTCHA_TERMS_URL }),
})

/**
 * Google's notice in the eight OwlMeans sign-in languages: the sentence (`{{privacy}}`, `{{terms}}`
 * mark the links) and each link's label.
 */
export const RECAPTCHA_TEXTS: Readonly<Record<string, CaptchaTexts>> = Object.freeze({
  en: Object.freeze({
    notice: 'This site is protected by reCAPTCHA and the Google {{privacy}} and {{terms}} apply.',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
  }),
  pl: Object.freeze({
    notice: 'Ta strona jest chroniona przez reCAPTCHA i obowiązują w niej {{privacy}} oraz {{terms}} Google.',
    privacy: 'Polityka prywatności',
    terms: 'Warunki korzystania z usług',
  }),
  ru: Object.freeze({
    notice: 'Этот сайт защищён reCAPTCHA, и к нему применяются {{privacy}} и {{terms}} Google.',
    privacy: 'Политика конфиденциальности',
    terms: 'Условия использования',
  }),
  be: Object.freeze({
    notice: 'Гэты сайт абаронены reCAPTCHA, і да яго прымяняюцца {{privacy}} і {{terms}} Google.',
    privacy: 'Палітыка прыватнасці',
    terms: 'Умовы выкарыстання',
  }),
  uk: Object.freeze({
    notice: 'Цей сайт захищено reCAPTCHA, і до нього застосовуються {{privacy}} та {{terms}} Google.',
    privacy: 'Політика конфіденційності',
    terms: 'Умови використання',
  }),
  es: Object.freeze({
    notice: 'Este sitio está protegido por reCAPTCHA y se aplican la {{privacy}} y los {{terms}} de Google.',
    privacy: 'Política de privacidad',
    terms: 'Términos del servicio',
  }),
  de: Object.freeze({
    notice: 'Diese Website ist durch reCAPTCHA geschützt, und es gelten die {{privacy}} und die {{terms}} von Google.',
    privacy: 'Datenschutzerklärung',
    terms: 'Nutzungsbedingungen',
  }),
  fr: Object.freeze({
    notice: 'Ce site est protégé par reCAPTCHA, et les {{privacy}} et les {{terms}} de Google s’appliquent.',
    privacy: 'Règles de confidentialité',
    terms: 'Conditions d’utilisation',
  }),
})
