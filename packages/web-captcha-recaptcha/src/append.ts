import { captchaClients } from '@owlmeans/web-captcha'
import type { CaptchaClients } from '@owlmeans/web-captcha'
import { makeRecaptchaClient } from './client.js'
import type { RecaptchaClient, RecaptchaClientOptions } from './types.js'

/**
 * Register the reCAPTCHA client in the page's captcha clients (or the registry given), so a form
 * that is advertised the `recaptcha` provider finds it. Call it once while the app is set up.
 */
export const appendRecaptchaClient = <W = unknown>(
  options: RecaptchaClientOptions<W> = {}, clients: CaptchaClients = captchaClients
): RecaptchaClient<W> => clients.register(makeRecaptchaClient(options))
