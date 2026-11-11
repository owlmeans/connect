import { AuthUnavailable } from '@owlmeans/auth'
import type { CaptchaVerdict } from '@owlmeans/captcha'
import { logger } from '@owlmeans/log'
import { RECAPTCHA_PROVIDER } from './consts.js'
import type { RecaptchaProvider, RecaptchaProviderOptions, RecaptchaResponse } from './types.js'
import { createRecaptchaVerifier } from './verifier.js'

const log = logger('captcha-recaptcha')

/**
 * The Google reCAPTCHA provider of `@owlmeans/captcha`: siteverify for a checkbox (v2) or a
 * score-based (v3) token, its answer mapped onto the neutral verdict (`score`, `action`,
 * `hostname`, `challenge_ts` → `at`, `error-codes` → `errors`). The keys come from the options —
 * fixed values first, then `keys` read per call.
 *
 * Without a secret nothing is asked: `AuthUnavailable('captcha:config')`, logged once.
 *
 * @throws {SyntaxError} for a siteverify address that is not https.
 */
export const makeRecaptchaProvider = (options: RecaptchaProviderOptions = {}): RecaptchaProvider => {
  const id = options.id ?? RECAPTCHA_PROVIDER
  const verifier = createRecaptchaVerifier(options)
  let reported = false

  const textOf = (value: string | null | undefined): string => typeof value === 'string' ? value.trim() : ''

  const secretOf = (): string => textOf(options.secret) || textOf(options.keys?.secret())

  const siteKeyOf = (): string => textOf(options.siteKey) || textOf(options.keys?.siteKey())

  const verdictOf = (answer: RecaptchaResponse): CaptchaVerdict => ({
    success: answer.success === true,
    ...(typeof answer.score === 'number' ? { score: answer.score } : {}),
    ...(typeof answer.action === 'string' ? { action: answer.action } : {}),
    ...(typeof answer.hostname === 'string' ? { hostname: answer.hostname } : {}),
    ...(typeof answer.challenge_ts === 'string' && answer.challenge_ts !== '' ? { at: answer.challenge_ts } : {}),
    ...(Array.isArray(answer['error-codes']) ? { errors: answer['error-codes'] } : {}),
  })

  const verify: RecaptchaProvider['verify'] = async (token, verifyOptions) => {
    const secret = secretOf()
    if (secret === '') {
      if (!reported) {
        reported = true
        log.error('reCAPTCHA has no secret: no token can be verified', { provider: id }, { event: 'auth.captcha.config' })
      }
      throw new AuthUnavailable('captcha:config')
    }
    const remoteip = textOf(verifyOptions?.remoteIp)

    return verdictOf(await verifier.verify({ secret, response: token, ...(remoteip !== '' ? { remoteip } : {}) }))
  }

  const clientSettings: RecaptchaProvider['clientSettings'] = () => ({ provider: id, siteKey: siteKeyOf() })

  return { id, verify, clientSettings }
}
