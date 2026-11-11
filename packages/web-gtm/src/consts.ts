import { CONSENT_ANALYTICS, CONSENT_ESSENTIAL, CONSENT_MARKETING } from '@owlmeans/consent'
import type { GoogleConsentSignal, GoogleConsentState } from './consent-mode/types.js'
import type { GoogleTagMode } from './types.js'

/**
 * The platform default for {@link GtmOptions.mode} / {@link GoogleTagOptions.mode}.
 *
 * One named constant so flipping it later is a one-line change.
 *
 * - `'basic'` withholds the loader until a tracking category is granted (`ConsentCategory.tracking`,
 *   analytics or marketing by default) — which holds back Google's own IP receipt too, not only
 *   what a granted tag may then do with it.
 * - `'advanced'` loads immediately with Consent Mode signals denied — today's only behavior, and
 *   Google's own recommended default for its own conversion modeling.
 *
 * Default is `'basic'`: read it as the EU/DE worst-case reading of ePrivacy Art. 5(3) — no third
 * party receives a connection before consent.
 */
export const GOOGLE_TAG_DEFAULT_MODE: GoogleTagMode = 'basic'

/**
 * The hosts a page running a Google tag has to allow in `script-src`, `connect-src` and
 * `img-src`, for Google Analytics 4, Tag Manager and Google Ads together.
 *
 * Taken from Google's CSP guide (developers.google.com/tag-platform/security/guides/csp) and
 * folded into one list, because the platform adds one list to all three directives:
 *
 * - `*.googletagmanager.com` — gtm.js and gtag/js (`www.`), and their measurement pings;
 * - `*.google-analytics.com` — GA4 collection (`region1.`, `www.`);
 * - `*.g.doubleclick.net` — GA4 with Google signals and Ads (`stats.g.`, `googleads.g.`);
 * - `ad.doubleclick.net` — Ads and Floodlight conversions;
 * - `www.googleadservices.com` — the Ads conversion script;
 * - `pagead2.googlesyndication.com` — Ads and GA4-with-ads pings;
 * - `*.google.com` — `www.google.com` (the Ads script, consent-mode pings), `adservice.`, and the
 *   `analytics.google.com` collection endpoints.
 *
 * Every entry is an `https://` scheme, an optional `*.` label and a dotted host — the only shape
 * the publisher's CSP filter lets through — and there are few enough to stay inside its per-slot
 * cap. Google's country domains (`google.<TLD>`) cannot be named in that shape and are left out:
 * what is lost is a remarketing ping from visitors on those domains, never the tag itself.
 */
export const GOOGLE_TAG_CSP_SOURCES: readonly string[] = Object.freeze([
  'https://*.googletagmanager.com',
  'https://*.google-analytics.com',
  'https://*.g.doubleclick.net',
  'https://ad.doubleclick.net',
  'https://www.googleadservices.com',
  'https://pagead2.googlesyndication.com',
  'https://*.google.com',
])

/**
 * The hosts a Google tag frames: Tag Manager's service-worker and preview frames, and the Ads
 * remarketing frame. For `frame-src`, which otherwise stays `'none'`.
 */
export const GOOGLE_TAG_FRAME_SOURCES: readonly string[] = Object.freeze([
  'https://www.googletagmanager.com',
  'https://td.doubleclick.net',
])

/** The id Google Consent Mode registers under in `@owlmeans/consent`'s signal host. */
export const GOOGLE_CONSENT_MODE_ID = 'google-consent-mode'

/**
 * Idempotence flag for the Consent Mode defaults, on `window`. Fixed — the inline head bootstrap and
 * a bundle both read it, and pages already carry it under this name.
 */
export const GOOGLE_CONSENT_SETUP_FLAG = 'cookieConsentSetup'

/**
 * Every signal Consent Mode v2 knows, and what it defaults to before anyone has chosen — in the
 * order the `default` command lists them.
 *
 * `security_storage` is granted by Google's own documented recommendation — it covers things like
 * fraud prevention, which are strictly necessary. Everything else starts denied.
 */
export const GOOGLE_CONSENT_SIGNAL_DEFAULTS: Readonly<Record<GoogleConsentSignal, GoogleConsentState>> = Object.freeze({
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'denied',
  personalization_storage: 'denied',
  security_storage: 'granted',
})

/**
 * The signals each of `@owlmeans/consent`'s default categories drives: essential storage is security
 * and functionality storage, analytics is analytics storage, marketing is the three ad signals.
 * `personalization_storage` is driven by none of them, so it is never declared.
 */
export const GOOGLE_CONSENT_SIGNALS: Readonly<Record<string, readonly GoogleConsentSignal[]>> = Object.freeze({
  [CONSENT_ESSENTIAL]: Object.freeze(['security_storage', 'functionality_storage'] as GoogleConsentSignal[]),
  [CONSENT_ANALYTICS]: Object.freeze(['analytics_storage'] as GoogleConsentSignal[]),
  [CONSENT_MARKETING]: Object.freeze(['ad_storage', 'ad_user_data', 'ad_personalization'] as GoogleConsentSignal[]),
})
