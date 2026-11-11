import type { ConsentService } from '@owlmeans/consent'
import type { GoogleConsentHeadOptions, GoogleHeadTag, GoogleTagKind, GoogleTagOptions, GtmOptions } from '../types.js'

/** A Google tag behind consent: its inline head script, its fallbacks, its id rules, its disclosure. */
export interface GoogleTagHelper {
  /**
   * The inline `<head>` snippet, consent first and the container second.
   *
   * The ORDER is the whole point of this package. Google Tag Manager decides what a tag may do from
   * the consent state present when the container loads, and a React bundle cannot get there first —
   * by the time an island mounts, the container has been running for hundreds of milliseconds. A
   * site whose defaults arrive after `gtm.js` is not configured differently; it is unconfigured for
   * the window that matters, and nothing in the page reports it.
   *
   * Emit this into the document head, above everything else, as an inline script.
   *
   * In `GOOGLE_TAG_DEFAULT_MODE` (`'basic'`) the container is not requested at all until a
   * tracking category is granted — `@owlmeans/consent`'s `consentTrackingHelper.consentGateScript`
   * wraps it, reading any stored decision immediately and otherwise waiting for `CONSENT_EVENT`.
   * Pass `mode: 'advanced'` for the original, unconditional load.
   */
  gtmHeadScript: (opts: GtmOptions) => string
  /**
   * The `<noscript>` iframe, for the body.
   *
   * In `'basic'` mode this is an empty string: the whole point of gating is that an unauthenticated
   * `<noscript>` iframe would defeat it — a browser with JavaScript disabled cannot have granted
   * anything, so there is nothing lawful left to render. `'advanced'` keeps the frame.
   */
  gtmNoscriptFrame: (opts: GtmOptions) => string
  /**
   * Load the container from script, for a host that cannot emit into its own head.
   *
   * The head snippet is strictly better and should be preferred; this exists for a single-page app
   * whose HTML is not ours to edit. It registers Google Consent Mode with the consent store unless
   * the app already did (`appendGoogleConsentMode`), starts the store so the defaults are pushed
   * first, and it still refuses to load a second time.
   *
   * In `'basic'` mode the container element is not appended until `trackingGranted` is true: either
   * the stored record already grants it, or — since this runs after the bundle mounted, past the
   * window the head snippet exists to close — a subscription to `consentStore` catches the first
   * update where it becomes true and unsubscribes. `'advanced'` appends it immediately, as before.
   */
  loadGtm: (opts: GtmOptions) => void
  /** Whether `id` is a Tag Manager container or Google tag id this package can load. */
  isGoogleTagId: (id: string) => boolean
  /** The loader `id` takes, or `null` when it is not a loadable id at all. */
  googleTagKind: (id: string) => GoogleTagKind | null
  /**
   * The one inline `<head>` script for a Google tag of any kind: the Consent Mode bootstrap FIRST
   * (`makeGoogleConsentMode(opts).bootstrapScript(opts)`), then ads redaction, then the loader the
   * id's prefix calls for — the Tag Manager container for `GTM-`, gtag.js with `js` and `config` for
   * `G-`, `GT-`, `AW-` and `DC-`.
   *
   * The order is the rule {@link gtmHeadScript} exists for, and it holds for gtag.js just the same:
   * a tag decides what it may do from the consent state present when it loads. The bootstrap
   * declares everything denied and applies any stored decision in the same turn, so a returning
   * visitor's tag starts granted and a new visitor's starts cookieless.
   *
   * An id that is not a loadable id ({@link isGoogleTagId}) yields the Consent Mode bootstrap alone
   * — a page must never lose its consent defaults because someone mistyped a tag. The result is safe
   * to place inline in HTML as-is: `</` and `<!--` inside any configured value are escaped.
   *
   * In `GOOGLE_TAG_DEFAULT_MODE` (`'basic'`) the loader itself — the last piece — is wrapped in
   * `@owlmeans/consent`'s `consentTrackingHelper.consentGateScript`: it runs immediately for a
   * returning visitor whose stored record already grants a tracking category, and otherwise waits
   * for `CONSENT_EVENT` before ever requesting the tag. The bootstrap and the redaction flags are unaffected and still
   * run unconditionally — Consent Mode's OWN denied-by-default signals are declared either way, so a
   * tag that later does load still starts from `ad_storage`/`analytics_storage` denied. Pass
   * `mode: 'advanced'` for the original, unconditional load.
   */
  googleTagHeadScript: (opts: GoogleTagOptions) => string
  /**
   * What a Google tag discloses on the cookie policy, for `CookiePolicy`'s `services`.
   *
   * Read off the id's prefix, because that is all the page knows: `G-` is Google Analytics 4
   * (`_ga`, and `_ga_<id without G->` which carries the session), `AW-` Google Ads, `DC-` Floodlight.
   * A `GTM-` container and a `GT-` Google tag route to whatever their owner configured at Google,
   * so both are disclosed as an analytics AND an advertising entry, worded as configured there —
   * the policy may not claim less than the tag can do. An invalid id discloses nothing, matching
   * {@link googleTagHeadScript}, which loads nothing for it.
   */
  googleTagServices: (id: string) => ConsentService[]
  /**
   * The tag for a page head as one object — `head` from {@link googleTagHeadScript} and `noscript`
   * from {@link gtmNoscriptFrame} — for a layout that stamps both, `@owlmeans/astro`'s
   * `owlHeadScripts({ consent, tag })` above all. Pass the same consent options the page gives the
   * dialog: `head` carries the consent bootstrap ahead of the loader and replaces the plain one.
   *
   * Strict where {@link googleTagHeadScript} is lenient: an id that is not a loadable id throws
   * (`@owlmeans/web-gtm: id is not a loadable Google tag id: "<id>"`), so a mistyped id fails the
   * build instead of shipping pages that load nothing. Only a Tag Manager container (`GTM-`) has a
   * no-script frame, and only in `'advanced'` mode; every other id and mode yields `noscript: ''`.
   */
  headTag: (opts: GoogleTagOptions) => GoogleHeadTag
  /**
   * A head with Consent Mode and no loader: the Consent Mode bootstrap alone (defaults, the linker
   * fragment, a stored decision's globals and update), escaped for inline HTML, `noscript: ''`.
   *
   * For a page that loads no Google tag from its head but still wants Consent Mode's state in place
   * — a tag a later script adds, a generated target whose owner set no tag (the same bytes
   * `googleTagHeadScript` yields for an invalid id). As `@owlmeans/astro`'s `owlHeadScripts({ tag })`
   * it replaces consent's neutral bootstrap.
   */
  consentHeadTag: (opts?: GoogleConsentHeadOptions) => GoogleHeadTag
}
