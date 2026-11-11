import ReCAPTCHA from 'react-google-recaptcha'
import type { CaptchaWidget } from '@owlmeans/web-captcha/react'

/**
 * Google's reCAPTCHA v2 checkbox as a `@owlmeans/web-captcha` widget: give it to the client
 * (`appendRecaptchaClient({ widget: RecaptchaCheckbox })`) and a panel's captcha sign-in renders it.
 * Needs a v2 (checkbox) site key; an expired token is reported as `null`.
 */
export const RecaptchaCheckbox: CaptchaWidget = ({ siteKey, onToken, onReady, onError, language }) =>
  <ReCAPTCHA
    sitekey={siteKey}
    onChange={onToken}
    onExpired={() => { onToken(null) }}
    onErrored={() => { onError?.(new Error('reCAPTCHA could not load')) }}
    asyncScriptOnLoad={() => { onReady?.() }}
    {...(language != null ? { hl: language } : {})}
  />
