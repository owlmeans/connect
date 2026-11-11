import type { CaptchaProvider } from '@owlmeans/captcha'
import type { PluginConfig } from '@owlmeans/config'

/** Google's siteverify answer, for a checkbox (v2) or a score-based (v3) token. */
export interface RecaptchaResponse {
  success: boolean
  /** When the challenge was solved, as an ISO date-time string. */
  challenge_ts: string
  /** The host of the page the token was solved on. */
  hostname: string
  /** Score-based keys only: 0.0 (a bot) … 1.0 (a person). */
  score?: number
  /** Score-based keys only: the action the page named when it asked for the token. */
  action?: string
  'error-codes'?: string[]
}

/** The siteverify form: the key's secret, the token the browser got, optionally the browser's IP. */
export interface RecaptchaRequest {
  secret: string
  response: string
  remoteip?: string
}

/** The one call the verifier makes — `fetch`, or a stand-in a test injects. */
export interface RecaptchaFetch {
  (url: string, init: RequestInit): Promise<Response>
}

export interface RecaptchaVerifierOptions {
  /** The siteverify address; must be https. Default `RECAPTCHA_SITEVERIFY_URL`. */
  url?: string
  /** Default: the global `fetch`. */
  fetch?: RecaptchaFetch
  /** Milliseconds before the call is abandoned. Default `RECAPTCHA_VERIFY_TIMEOUT`. */
  timeout?: number
}

/** One form POST to Google's siteverify. It holds no state and touches no context. */
export interface RecaptchaVerifier {
  /**
   * Google's answer for one token. A refusal is an answer (`success: false`), not an error.
   *
   * @throws {AuthUnavailable} `captcha` when Google cannot be asked or answers something unreadable.
   */
  verify: (request: RecaptchaRequest) => Promise<RecaptchaResponse>
}

/**
 * The `MOD_RECAPTCHA` record of a server config: the siteverify secret in `value` (a mounted secret
 * file) and, optionally, the browser's site key. The policy is the host's `MOD_CAPTCHA` record.
 */
export interface RecaptchaRecord extends PluginConfig {
  /** The public site key; absent = the `CMOD_RECAPTCHA` client record's `value`. */
  siteKey?: string
}

/** Where the provider reads its keys — per call, so a config value resolved in place is seen. */
export interface RecaptchaKeys {
  /** The siteverify secret; `null` when this environment holds none. */
  secret: () => string | null
  /** The public site key; `null` when none is configured. */
  siteKey: () => string | null
}

export interface RecaptchaProviderOptions extends RecaptchaVerifierOptions {
  /** The provider id. Default `RECAPTCHA_PROVIDER`. */
  id?: string
  /** A fixed secret; wins over `keys`. */
  secret?: string
  /** A fixed site key; wins over `keys`. */
  siteKey?: string
  /**
   * Where the keys are read per call. `appendRecaptcha` defaults it to the context's
   * `MOD_RECAPTCHA` / `CMOD_RECAPTCHA` records; without it only `secret` / `siteKey` count.
   */
  keys?: RecaptchaKeys
}

/** The reCAPTCHA provider of `@owlmeans/captcha`. */
export interface RecaptchaProvider extends CaptchaProvider {}
