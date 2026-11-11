import type { ConsentCategory, ConsentOptions, ConsentRecord, ConsentSignalProvider } from '@owlmeans/consent'

/**
 * Google Consent Mode v2 signals.
 *
 * Named here rather than left as free strings because a typo in a signal name is silent: the tag
 * simply never sees the update, and the only symptom is analytics that stay switched off for
 * everyone who agreed to them.
 */
export type GoogleConsentSignal =
  | 'ad_storage' | 'ad_user_data' | 'ad_personalization'
  | 'analytics_storage' | 'functionality_storage'
  | 'personalization_storage' | 'security_storage'

/** A Consent Mode signal's value. */
export type GoogleConsentState = 'granted' | 'denied'

/**
 * How consent categories map onto Consent Mode. Both maps are keyed by `ConsentCategory.key` and
 * merged over the built-in one, so a site names only what differs.
 */
export interface GoogleConsentModeOptions {
  /**
   * The signals each category drives — over {@link GOOGLE_CONSENT_SIGNALS} (essential → security and
   * functionality storage, analytics → analytics storage, marketing → the three ad signals). A key
   * mapped to `[]` drives nothing; a category in neither map drives nothing.
   */
  signals?: Record<string, GoogleConsentSignal[]>
  /** A `dataLayer` event pushed after each update while that category is granted: `{ event }`. */
  events?: Record<string, string>
}

/** Google Consent Mode as an `@owlmeans/consent` signal provider: the queue, the signals, the head script. */
export interface GoogleConsentMode extends ConsentSignalProvider {
  /**
   * Declare every signal the configured categories drive at its pre-consent value — `consent`,
   * `default` on `window.dataLayer`, before any tag can act.
   *
   * Idempotent through a window flag ({@link GOOGLE_CONSENT_SETUP_FLAG}), because the page may carry
   * this twice — once inline in the document head, once from whatever bundle runs the consent store
   * — and a second `default` after a tag has loaded is worse than none: it can widen what was
   * already narrowed. Nothing under `silent`.
   */
  defaults: (opts: ConsentOptions) => void
  /**
   * Signal a decision: `consent`, `update` with every signal at the value the record implies, then
   * the per-category events of {@link GoogleConsentModeOptions.events}. `@owlmeans/consent` has
   * written the category globals before this runs. Nothing under `silent`.
   */
  apply: (record: ConsentRecord, opts: ConsentOptions) => void
  /**
   * The inline script a document stamps ABOVE its Google tag.
   *
   * It exists because the defaults have to be on the queue before `gtm.js`/`gtag.js` loads, and a
   * React bundle cannot be: by the time an island mounts, the container has been running for
   * hundreds of milliseconds and has already decided what it may do. It declares the defaults,
   * embeds consent's linker fragment (with `opts.linker`), then reads the stored record — an
   * automatic one past its age skipped — and writes the category globals and the update in one
   * turn, so a returning visitor's tags are not denied for the first paint of every page. Dynamic
   * values are JSON-encoded; escaping the result for HTML is the caller's job (`googleTagHelper`
   * does it).
   */
  bootstrapScript: (opts?: ConsentOptions) => string
  /**
   * Push onto `window.dataLayer` in the shape Google's own snippet uses — its `arguments` object,
   * not an array literal: that is what `gtag.js` itself emits, and a page that carries both should
   * not have two shapes in one queue.
   */
  gtagConsent: (...args: unknown[]) => void
  /** The signals one category drives under this provider's map. */
  signalsOf: (category: ConsentCategory) => GoogleConsentSignal[]
  /** Every signal the categories drive, at its pre-consent value ({@link GOOGLE_CONSENT_SIGNAL_DEFAULTS}). */
  consentDefaults: (categories?: ConsentCategory[]) => Record<string, GoogleConsentState>
  /**
   * Every signal the categories drive, at the value `record` implies — a required category always
   * granted, and a signal named by two categories granted only when every one of them is.
   */
  consentUpdate: (record: ConsentRecord, categories?: ConsentCategory[]) => Record<string, GoogleConsentState>
}
