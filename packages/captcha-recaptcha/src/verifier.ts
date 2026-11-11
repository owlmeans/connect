import { AuthUnavailable } from '@owlmeans/auth'
import { logger } from '@owlmeans/log'
import { RECAPTCHA_SITEVERIFY_URL, RECAPTCHA_VERIFY_TIMEOUT } from './consts.js'
import type { RecaptchaResponse, RecaptchaVerifier, RecaptchaVerifierOptions } from './types.js'

const log = logger('captcha-recaptcha')

/**
 * Google's siteverify: one https form POST per token.
 *
 * @throws {SyntaxError} for a siteverify address that is not https.
 */
export const createRecaptchaVerifier = (options: RecaptchaVerifierOptions = {}): RecaptchaVerifier => {
  const url = options.url ?? RECAPTCHA_SITEVERIFY_URL
  if (!url.startsWith('https://')) {
    throw new SyntaxError(`reCAPTCHA siteverify must be https: ${url}`)
  }
  const timeout = options.timeout ?? RECAPTCHA_VERIFY_TIMEOUT

  /** The answer, when it has the shape of one. */
  const readAnswer = async (response: Response): Promise<RecaptchaResponse | null> => {
    try {
      const answer = await response.json() as RecaptchaResponse | null
      return answer != null && typeof answer === 'object' && typeof answer.success === 'boolean' ? answer : null
    } catch {
      return null
    }
  }

  const verify: RecaptchaVerifier['verify'] = async request => {
    const body = new URLSearchParams({ secret: request.secret, response: request.response })
    if (request.remoteip != null && request.remoteip !== '') {
      body.set('remoteip', request.remoteip)
    }

    const send = options.fetch ?? fetch
    let response: Response
    try {
      response = await send(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(timeout),
      })
    } catch (error) {
      log.warn('reCAPTCHA siteverify unreachable', { error }, { event: 'auth.captcha.unavailable' })
      throw new AuthUnavailable('captcha')
    }

    const answer = response.ok ? await readAnswer(response) : null
    if (answer == null) {
      log.warn('reCAPTCHA siteverify answered unusably', { status: response.status }, { event: 'auth.captcha.unavailable' })
      throw new AuthUnavailable('captcha')
    }

    return answer
  }

  return { verify }
}
