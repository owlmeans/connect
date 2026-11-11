/**
 * The provider id of Google reCAPTCHA — what `MOD_CAPTCHA.provider`, captcha settings and the
 * browser client (`@owlmeans/web-captcha-recaptcha`) name it by.
 */
export const RECAPTCHA_PROVIDER = 'recaptcha'

/**
 * The provider's record of a server config (`RecaptchaRecord`): the siteverify secret in `value`
 * and, optionally, the site key. A Backend record — never advertised.
 */
export const MOD_RECAPTCHA = '_external:re-captcha'

/**
 * The client record a browser reads its site key from (`value`), advertised to the browser as a
 * Frontend record; the provider reads it too when `MOD_RECAPTCHA` carries no site key.
 */
export const CMOD_RECAPTCHA = '_client-external:re-captcha'

/** Google's siteverify endpoint — always https. */
export const RECAPTCHA_SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

/** How long the verifier waits for Google, in ms. */
export const RECAPTCHA_VERIFY_TIMEOUT = 10_000
