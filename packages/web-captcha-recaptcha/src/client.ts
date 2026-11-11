import { CMOD_RECAPTCHA, RECAPTCHA_NOTICE, RECAPTCHA_PROVIDER, RECAPTCHA_TEXTS } from './consts.js'
import { recaptchaLoader } from './loader.js'
import type { RecaptchaClient, RecaptchaClientOptions } from './types.js'

/**
 * The reCAPTCHA client of `@owlmeans/web-captcha`: tokens from the invisible, score-based v3 loader,
 * Google's notice (the loader hides the badge) in eight languages, and — when given — an interactive
 * widget (`RecaptchaCheckbox` of `./react`, the v2 checkbox) for a page that renders one.
 */
export const makeRecaptchaClient = <W = unknown>(options: RecaptchaClientOptions<W> = {}): RecaptchaClient<W> => {
  const loader = options.loader ?? recaptchaLoader

  return {
    id: RECAPTCHA_PROVIDER,
    load: async siteKey => { await loader.prepare(siteKey) },
    execute: async (siteKey, action) => await loader.token(siteKey, action),
    notice: RECAPTCHA_NOTICE,
    texts: RECAPTCHA_TEXTS,
    siteKeyRecord: options.siteKeyRecord ?? CMOD_RECAPTCHA,
    ...(options.widget != null ? { widget: options.widget } : {}),
  }
}
