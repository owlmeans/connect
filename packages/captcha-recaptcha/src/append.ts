import { ensureCaptchaService } from '@owlmeans/captcha'
import type { BasicConfig, BasicContext } from '@owlmeans/context'
import { makeRecaptchaKeys } from './keys.js'
import { makeRecaptchaProvider } from './provider.js'
import type { RecaptchaProviderOptions } from './types.js'

/**
 * Register the reCAPTCHA provider in the context's captcha host. Its keys default to the context's
 * `MOD_RECAPTCHA` record (secret in `value`, optional `siteKey`) and `CMOD_RECAPTCHA` client record
 * (site key), read per call; `options.secret` / `options.siteKey` / `options.keys` replace them.
 *
 * Registering the provider turns nothing on by itself: the captcha guest sign-in needs the host's
 * `MOD_CAPTCHA` record, a strict check its own settings.
 */
export const appendRecaptcha = <C extends BasicConfig, T extends BasicContext<C>>(
  context: T, options: RecaptchaProviderOptions = {}
): T => {
  ensureCaptchaService(context).register(makeRecaptchaProvider({ keys: makeRecaptchaKeys(context), ...options }))

  return context
}
