import type { CaptchaClient } from '@owlmeans/web-captcha'

/** The part of Google's `grecaptcha` (v3, `render=<site key>`) the loader uses. */
export interface Grecaptcha {
  ready: (callback: () => void) => void
  execute: (siteKey: string, options: { action: string }) => PromiseLike<string>
}

/** The window as the loader reads it: only Google's global. */
export interface RecaptchaWindow {
  grecaptcha?: Grecaptcha
}

/** The document as the loader uses it: one script and one style appended to its head. */
export interface RecaptchaDocument extends Pick<Document, 'createElement' | 'querySelector' | 'head'> {}

export interface RecaptchaLoaderOptions {
  /** Add the document style that hides Google's badge. Default `true`. */
  hideBadge?: boolean
  /** Milliseconds the script may take to become ready. Default `RECAPTCHA_LOAD_TIMEOUT`. */
  loadTimeout?: number
  /** Milliseconds one `execute` may take. Default `RECAPTCHA_EXECUTE_TIMEOUT`. */
  executeTimeout?: number
  /** The script address `?render=<site key>` is added to. Default `RECAPTCHA_SCRIPT_URL`. */
  scriptUrl?: string
  /** The page to load into. Default: the global `document`, read at call time. */
  document?: RecaptchaDocument
  /** Where Google's global appears. Default: the global `window`, read at call time. */
  window?: RecaptchaWindow
}

/** Google's reCAPTCHA v3, loaded on first use — never at import. */
export interface RecaptchaLoader {
  /**
   * Inject `api.js?render=<siteKey>` once per key (and, unless disabled, the document style that
   * hides Google's badge); resolves once `grecaptcha` is ready. A failure is forgotten, so the next
   * call injects again.
   *
   * @throws {CaptchaLoadError} `load`, `timeout` or `unavailable`.
   */
  prepare: (siteKey: string) => Promise<void>
  /**
   * A fresh token for `action`, loading the script first when needed.
   *
   * @throws {CaptchaLoadError} what `prepare` throws, or `execute` when Google gives no token in time.
   */
  token: (siteKey: string, action: string) => Promise<string>
}

export interface RecaptchaClientOptions<W = unknown> {
  /** The loader the client runs on. Default: the page's shared `recaptchaLoader`. */
  loader?: RecaptchaLoader
  /** An interactive widget for a page that renders one — `RecaptchaCheckbox` of `./react`. */
  widget?: W
  /** The client config record holding the site key. Default `CMOD_RECAPTCHA`. */
  siteKeyRecord?: string
}

/** The reCAPTCHA client of `@owlmeans/web-captcha`. */
export interface RecaptchaClient<W = unknown> extends CaptchaClient<W> {}
