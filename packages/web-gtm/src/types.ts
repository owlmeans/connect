import type { ConsentOptions } from '@owlmeans/consent'
import type { GoogleConsentModeOptions } from './consent-mode/types.js'

/** `'gtm'` container / `'gtag'` — see {@link GtmOptions.mode} / {@link GoogleTagOptions.mode}. */
export type GoogleTagMode = 'basic' | 'advanced'

/** The window a Google tag's queue lives on. */
export interface DataLayerWindow {
  dataLayer?: unknown[]
}

/**
 * The consent options of a page with this package's Consent Mode — the categories, storage and
 * linker `@owlmeans/consent` reads, plus how they map onto Consent Mode signals. Pass the same
 * options `appendGoogleConsentMode` was given, or the head and the store disagree.
 */
export interface GoogleConsentHeadOptions extends ConsentOptions, GoogleConsentModeOptions {}

export interface GtmOptions extends GoogleConsentHeadOptions {
  /** Container id, e.g. `GTM-XXXXXXX`. */
  id: string
  /** The queue name, when a page runs more than one container. */
  dataLayerName?: string
  /** See {@link GOOGLE_TAG_DEFAULT_MODE}. Defaults to `GOOGLE_TAG_DEFAULT_MODE` (`'basic'`). */
  mode?: GoogleTagMode
}

/**
 * Which loader an id takes: `gtm` is the Tag Manager container (`gtm.js`), `gtag` the Google tag
 * (`gtag.js`) — Google Analytics 4 (`G-`), a Google tag (`GT-`), Google Ads (`AW-`) and
 * Floodlight (`DC-`).
 */
export type GoogleTagKind = 'gtm' | 'gtag'

export interface GoogleTagOptions extends GoogleConsentHeadOptions {
  /** `GTM-…`, `G-…`, `GT-…`, `AW-…` or `DC-…` — see {@link isGoogleTagId}. */
  id: string
  /**
   * The queue name, when a page runs more than one tag. This package's Consent Mode — the head
   * bootstrap AND the provider's later updates — always speaks on `window.dataLayer`, so a tag
   * given another queue never hears a consent command. Leave it unset on a consent-gated page.
   */
  dataLayerName?: string
  /** See {@link GOOGLE_TAG_DEFAULT_MODE}. Defaults to `GOOGLE_TAG_DEFAULT_MODE` (`'basic'`). */
  mode?: GoogleTagMode
}

/**
 * A Google tag rendered for a page head — the shape `@owlmeans/astro`'s `HeadTag` takes, declared
 * here so this package depends on no site framework.
 */
export interface GoogleHeadTag {
  /**
   * `googleTagHelper.googleTagHeadScript(opts)`: the Consent Mode bootstrap, ads redaction, then the
   * loader — or, from `consentHeadTag`, the Consent Mode bootstrap alone.
   */
  head: string
  /** The `<noscript>` frame: filled only for a `GTM-` container in `'advanced'` mode, else `''`. */
  noscript: string
}
