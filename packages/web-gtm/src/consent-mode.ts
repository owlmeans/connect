import { DEFAULT_CONSENT_CATEGORIES, consentLinkHelper, consentSignalHelper, consentTrackingHelper } from '@owlmeans/consent'
import type { ConsentCategory, ConsentOptions, ConsentRecord } from '@owlmeans/consent'
import {
  GOOGLE_CONSENT_MODE_ID, GOOGLE_CONSENT_SETUP_FLAG, GOOGLE_CONSENT_SIGNAL_DEFAULTS, GOOGLE_CONSENT_SIGNALS,
} from './consts.js'
import type { ConsentModeWindow } from './types.local.js'
import type {
  GoogleConsentMode, GoogleConsentModeOptions, GoogleConsentSignal, GoogleConsentState,
} from './consent-mode/types.js'

export const makeGoogleConsentMode = (options: GoogleConsentModeOptions = {}): GoogleConsentMode => {
  const global = (): ConsentModeWindow | null =>
    typeof window !== 'undefined' ? window as unknown as ConsentModeWindow : null

  const categoriesOf = (opts?: ConsentOptions): ConsentCategory[] =>
    opts?.categories ?? DEFAULT_CONSENT_CATEGORIES

  // A `function`, not an arrow: what goes on the queue is its own `arguments` object.
  function gtagConsent(..._args: unknown[]): void {
    const win = global()
    if (win == null) {
      return
    }
    win.dataLayer = win.dataLayer ?? []
    // `arguments`, not `_args`. The rest parameter is only here to type the call sites; what goes on
    // the queue must be the arguments object itself.
    // eslint-disable-next-line prefer-rest-params
    win.dataLayer.push(arguments)
  }

  const signalsOf = (category: ConsentCategory): GoogleConsentSignal[] =>
    [...options.signals?.[category.key] ?? GOOGLE_CONSENT_SIGNALS[category.key] ?? []]

  const consentDefaults = (categories?: ConsentCategory[]): Record<string, GoogleConsentState> => {
    const used = new Set((categories ?? DEFAULT_CONSENT_CATEGORIES).flatMap(signalsOf))

    return Object.fromEntries(Object.entries(GOOGLE_CONSENT_SIGNAL_DEFAULTS)
      .filter(([signal]) => used.has(signal as GoogleConsentSignal)))
  }

  const consentUpdate = (record: ConsentRecord, categories?: ConsentCategory[]): Record<string, GoogleConsentState> => {
    const update: Record<string, GoogleConsentState> = {}
    for (const category of categories ?? DEFAULT_CONSENT_CATEGORIES) {
      const granted = category.required === true || record[category.key] === true
      for (const signal of signalsOf(category)) {
        // A signal named by two categories is granted only when every one of them is.
        update[signal] = granted && update[signal] !== 'denied' ? 'granted' : 'denied'
      }
    }

    return update
  }

  const defaults = (opts: ConsentOptions): void => {
    const win = global()
    if (win == null || opts?.silent === true || win[GOOGLE_CONSENT_SETUP_FLAG] === true) {
      return
    }
    gtagConsent('consent', 'default', consentDefaults(categoriesOf(opts)))
    win[GOOGLE_CONSENT_SETUP_FLAG] = true
  }

  const apply = (record: ConsentRecord, opts: ConsentOptions): void => {
    const win = global()
    if (win == null || opts?.silent === true) {
      return
    }
    const categories = categoriesOf(opts)
    gtagConsent('consent', 'update', consentUpdate(record, categories))

    for (const category of categories) {
      const event = options.events?.[category.key]
      if (event != null && (category.required === true || record[category.key] === true)) {
        win.dataLayer = win.dataLayer ?? []
        win.dataLayer.push({ event })
      }
    }
  }

  const bootstrapScript = (opts?: ConsentOptions): string => {
    const categories = categoriesOf(opts)
    const declared = JSON.stringify(consentDefaults(categories))
    const shape = JSON.stringify(categories.map(category => ({
      key: category.key,
      required: category.required === true,
      signals: signalsOf(category),
      globalVar: category.globalVar ?? null,
    })))
    const flag = JSON.stringify(GOOGLE_CONSENT_SETUP_FLAG)
    // Right after the default is pushed and before EITHER storage read below (this one, and the gate
    // a tag head concatenates after this whole IIFE) — an adopted decision must already be in storage
    // by the time anything reads it, so `gtm.js`'s own `page_view` never sees the parameter and a
    // granted decision loads the tag on arrival. A page with no `opts.linker` gets nothing here.
    const linker = opts?.linker != null ? `${consentLinkHelper.consentLinkerScript(opts)};` : ''

    return `(function(w,d){` +
      `w.dataLayer=w.dataLayer||[];function g(){w.dataLayer.push(arguments)}` +
      `if(w[${flag}])return;g('consent','default',${declared});w[${flag}]=true;` +
      linker +
      consentTrackingHelper.storageReadScript(opts) +
      `if(!raw)return;var r;try{r=JSON.parse(raw)}catch(e){return}` +
      consentTrackingHelper.staleAutoScript('return') +
      `var cs=${shape},u={};` +
      `for(var i=0;i<cs.length;i++){var c=cs[i];var ok=c.required||r[c.key]===true;` +
      `if(c.globalVar){w[c.globalVar]=ok}` +
      `for(var j=0;j<c.signals.length;j++){var s=c.signals[j];` +
      `u[s]=ok&&u[s]!=='denied'?'granted':'denied'}}` +
      `g('consent','update',u)})(window,document)`
  }

  return {
    id: GOOGLE_CONSENT_MODE_ID,
    defaults, apply, bootstrapScript, gtagConsent, signalsOf, consentDefaults, consentUpdate,
  }
}

/**
 * Register Google Consent Mode with `@owlmeans/consent`'s signal host — once, where the consent store
 * runs (a web app's context, a site's consent island). Registering again replaces the earlier one,
 * so the options of the last call win. Returns the registered provider.
 */
export const appendGoogleConsentMode = (options?: GoogleConsentModeOptions): GoogleConsentMode => {
  const provider = makeGoogleConsentMode(options)
  consentSignalHelper.register(provider)

  return provider
}
