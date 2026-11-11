import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  CONSENT_ANALYTICS, CONSENT_AUTO_MAX_AGE, CONSENT_EVENT, CONSENT_KEY, CONSENT_LANGUAGE_KEY, CONSENT_MARKETING,
  DEFAULT_CONSENT_CATEGORIES, consentGeoHelper, consentLinkHelper, consentSignalHelper, consentStorageHelper,
  makeConsentStore,
} from '@owlmeans/consent'
import type { ConsentCategory } from '@owlmeans/consent'
import {
  GOOGLE_CONSENT_MODE_ID, GOOGLE_CONSENT_SETUP_FLAG, appendGoogleConsentMode, googleTagHelper, makeGoogleConsentMode,
} from '../src/index.js'

/** A minimal browser: the two stores consent writes to, and `window` as the global object. */
const browser = () => {
  const store = new Map<string, string>()
  let cookie = ''
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  }
  ;(globalThis as any).document = {
    documentElement: { setAttribute: () => {} },
    get cookie() { return cookie },
    set cookie(value: string) {
      const [pair] = value.split(';')
      cookie = cookie === '' ? pair : `${cookie}; ${pair}`
    },
  }
  ;(globalThis as any).window = globalThis

  return { store, reset: () => { store.clear(); cookie = '' } }
}

const env = browser()
const GLOBALS = ['owlConsentEssential', 'owlConsentAnalytics', 'owlConsentMarketing']

/** The queue as `command:arg` strings; an event object shows as `event:<name>`. */
const queue = (): string[] => (((globalThis as any).dataLayer ?? []) as unknown[]).map(entry => {
  const item = entry as { length?: number, event?: string }
  if (typeof item.length === 'number') {
    return Array.from(entry as ArrayLike<unknown>).slice(0, 2).map(String).join(':')
  }

  return `event:${String(item.event)}`
})

const updates = (): Record<string, string>[] => (((globalThis as any).dataLayer ?? []) as IArguments[])
  .filter(entry => entry[0] === 'consent' && entry[1] === 'update')
  .map(entry => entry[2] as Record<string, string>)

const run = (script: string) => {
  // eslint-disable-next-line no-new-func
  new Function(script)()
}

beforeEach(() => {
  env.reset()
  consentSignalHelper.clear()
  delete (globalThis as any).dataLayer
  delete (globalThis as any)[GOOGLE_CONSENT_SETUP_FLAG]
  for (const name of GLOBALS) delete (globalThis as any)[name]
})

afterEach(() => {
  consentSignalHelper.clear()
})

describe('consent mode signals', () => {
  const mode = makeGoogleConsentMode()

  test('defaults deny everything except security storage', () => {
    const defaults = mode.consentDefaults()

    expect(defaults.analytics_storage).toBe('denied')
    expect(defaults.ad_storage).toBe('denied')
    expect(defaults.ad_user_data).toBe('denied')
    expect(defaults.ad_personalization).toBe('denied')
    expect(defaults.security_storage).toBe('granted')
    // No default category drives it, so it is never declared.
    expect('personalization_storage' in defaults).toBe(false)
  })

  test('an update maps each category onto the signals it drives', () => {
    const update = mode.consentUpdate({ [CONSENT_ANALYTICS]: true, [CONSENT_MARKETING]: false })

    expect(update.analytics_storage).toBe('granted')
    expect(update.ad_storage).toBe('denied')
    // Required categories are granted whether or not the record says so.
    expect(update.security_storage).toBe('granted')
  })

  test('a custom category set drives only the signals the map names for it', () => {
    const custom = makeGoogleConsentMode({ signals: { ads: ['ad_storage'] } })
    const categories: ConsentCategory[] = [{ key: 'ads', labelKey: 'a', descriptionKey: 'b', tracking: true }]

    expect(Object.keys(custom.consentDefaults(categories))).toEqual(['ad_storage'])
    expect(custom.consentUpdate({ ads: true }, categories)).toEqual({ ad_storage: 'granted' })
    // The built-in map still answers for the default keys, and a category in neither map drives nothing.
    expect(custom.signalsOf(DEFAULT_CONSENT_CATEGORIES[1]!)).toEqual(['analytics_storage'])
    expect(custom.signalsOf({ key: 'chat', labelKey: 'c', descriptionKey: 'd' })).toEqual([])
  })

  test('the map overrides a default key, and an empty list silences it', () => {
    const custom = makeGoogleConsentMode({ signals: { [CONSENT_MARKETING]: [] } })

    expect(Object.keys(custom.consentDefaults())).not.toContain('ad_storage')
    expect(custom.consentUpdate({ [CONSENT_MARKETING]: true })).not.toHaveProperty('ad_storage')
  })

  test('a signal named by two categories is granted only when every one of them is', () => {
    const custom = makeGoogleConsentMode({ signals: { [CONSENT_ANALYTICS]: ['analytics_storage', 'ad_storage'] } })

    expect(custom.consentUpdate({ [CONSENT_ANALYTICS]: true, [CONSENT_MARKETING]: false }).ad_storage).toBe('denied')
    expect(custom.consentUpdate({ [CONSENT_ANALYTICS]: true, [CONSENT_MARKETING]: true }).ad_storage).toBe('granted')
  })

  test('defaults push `consent default` once per document, through the window flag', () => {
    mode.defaults({})
    mode.defaults({})

    expect(queue()).toEqual(['consent:default'])
    expect((globalThis as any)[GOOGLE_CONSENT_SETUP_FLAG]).toBe(true)
  })

  test('apply pushes the update and then each granted category\'s event', () => {
    const withEvents = makeGoogleConsentMode({ events: { [CONSENT_ANALYTICS]: 'analytics_granted', [CONSENT_MARKETING]: 'ads_granted' } })
    withEvents.apply({ [CONSENT_ANALYTICS]: true, [CONSENT_MARKETING]: false }, {})

    expect(queue()).toEqual(['consent:update', 'event:analytics_granted'])
  })

  test('pushes arguments, the shape gtag.js itself emits', () => {
    mode.gtagConsent('consent', 'default', {})
    const entry = ((globalThis as any).dataLayer as unknown[])[0]

    expect(Array.isArray(entry)).toBe(false)
    expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]')
  })

  test('silent pushes nothing', () => {
    mode.defaults({ silent: true })
    mode.apply({ [CONSENT_ANALYTICS]: true }, { silent: true })

    expect(queue()).toEqual([])
  })
})

describe('registered with the consent store', () => {
  test('appendGoogleConsentMode registers the provider under its id, replacing an earlier one', () => {
    const first = appendGoogleConsentMode()
    const second = appendGoogleConsentMode({ events: { [CONSENT_ANALYTICS]: 'granted' } })

    expect(consentSignalHelper.get(GOOGLE_CONSENT_MODE_ID)).toBe(second)
    expect(first).not.toBe(second)
    expect(consentSignalHelper.list()).toHaveLength(1)
  })

  test('init declares the defaults, a save signals the update after the globals, then the event fires', () => {
    appendGoogleConsentMode()
    const seen: string[] = []
    const listener = () => { seen.push(`event:${queue().join(',')}`) }
    ;(globalThis as any).addEventListener(CONSENT_EVENT, listener)
    try {
      const store = makeConsentStore()
      store.init()
      expect(queue()).toEqual(['consent:default'])

      store.save({ [CONSENT_ANALYTICS]: true, [CONSENT_MARKETING]: false })
      expect(updates()).toEqual([{
        security_storage: 'granted', functionality_storage: 'granted', analytics_storage: 'granted',
        ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
      }])
      expect((globalThis as any).owlConsentAnalytics).toBe(true)
      // The consent event fires after Consent Mode has spoken.
      expect(seen).toEqual(['event:consent:default,consent:update'])
    } finally {
      ;(globalThis as any).removeEventListener(CONSENT_EVENT, listener)
    }
  })

  test('a returning visitor\'s record is signalled on init', () => {
    consentStorageHelper.writeConsent({ [CONSENT_ANALYTICS]: false, [CONSENT_MARKETING]: true })
    appendGoogleConsentMode()
    makeConsentStore().init()

    expect(queue()).toEqual(['consent:default', 'consent:update'])
    expect(updates()[0]).toMatchObject({ analytics_storage: 'denied', ad_storage: 'granted' })
  })

  test('without the provider the store signals nothing to the queue', () => {
    const store = makeConsentStore()
    store.init()
    store.acceptAll()

    expect((globalThis as any).dataLayer).toBeUndefined()
  })

  test('the head bootstrap and the store declare the defaults once between them', () => {
    run(makeGoogleConsentMode().bootstrapScript())
    appendGoogleConsentMode()
    makeConsentStore().init()

    expect(queue().filter(entry => entry === 'consent:default')).toHaveLength(1)
  })

  test('loadGtm registers Consent Mode when the app did not, and keeps the app\'s own when it did', () => {
    ;(globalThis as any).document.getElementById = () => null
    ;(globalThis as any).document.createElement = () => ({})
    ;(globalThis as any).document.head = { appendChild: () => {} }
    try {
      googleTagHelper.loadGtm({ id: 'GTM-ABC1234', mode: 'advanced' })
      expect(consentSignalHelper.get(GOOGLE_CONSENT_MODE_ID)).not.toBeNull()
      expect(queue()[0]).toBe('consent:default')

      const own = appendGoogleConsentMode({ events: { [CONSENT_ANALYTICS]: 'mine' } })
      googleTagHelper.loadGtm({ id: 'GTM-ABC1235', mode: 'advanced' })
      expect(consentSignalHelper.get(GOOGLE_CONSENT_MODE_ID)).toBe(own)
    } finally {
      delete (globalThis as any).document.getElementById
      delete (globalThis as any).document.createElement
      delete (globalThis as any).document.head
    }
  })
})

describe('the bootstrap script', () => {
  const script = makeGoogleConsentMode().bootstrapScript()

  test('declares the defaults before anything else can', () => {
    expect(script).toContain("'consent','default'")
    expect(script.indexOf("'consent','default'")).toBeLessThan(script.indexOf("'consent','update'"))
  })

  test('is idempotent through the setup flag', () => {
    expect(script).toContain(GOOGLE_CONSENT_SETUP_FLAG)
  })

  test('reads the same storage key consent writes', () => {
    expect(script).toContain(JSON.stringify(CONSENT_KEY))
  })

  test('pushes arguments, the shape gtag.js itself emits', () => {
    expect(script).toContain('w.dataLayer.push(arguments)')
  })

  test('applies a stored decision: globals and update in the same turn', () => {
    consentStorageHelper.writeConsent({ [CONSENT_ANALYTICS]: true, [CONSENT_MARKETING]: false })
    run(script)

    expect(queue()).toEqual(['consent:default', 'consent:update'])
    expect(updates()[0]).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied', security_storage: 'granted' })
    expect((globalThis as any).owlConsentAnalytics).toBe(true)
    expect((globalThis as any).owlConsentMarketing).toBe(false)
  })

  test('applies a fresh automatic decision and skips a stale one', () => {
    const now = Math.floor(Date.now() / 1000)
    consentStorageHelper.writeConsent({ ...consentGeoHelper.automaticRecord(), auto: now })
    run(script)
    expect(updates()[0]?.analytics_storage).toBe('granted')

    delete (globalThis as any).dataLayer
    delete (globalThis as any)[GOOGLE_CONSENT_SETUP_FLAG]
    consentStorageHelper.writeConsent({ ...consentGeoHelper.automaticRecord(), auto: now - CONSENT_AUTO_MAX_AGE - 1 })
    run(script)
    expect(updates()).toEqual([])
  })

  test('the linker fragment sits after the default push and before the storage read', () => {
    const linked = makeGoogleConsentMode().bootstrapScript({ linker: { domains: ['owlmeans.com', 'owlmeans.pl'] } })
    const defaultAt = linked.indexOf("'consent','default'")
    const linkerAt = linked.indexOf(consentLinkHelper.consentLinkerScript({ linker: { domains: ['owlmeans.com', 'owlmeans.pl'] } }))
    const storageAt = linked.lastIndexOf('w.localStorage.getItem')

    expect(defaultAt).toBeGreaterThan(-1)
    expect(linkerAt).toBeGreaterThan(defaultAt)
    expect(storageAt).toBeGreaterThan(linkerAt)
    expect(script).not.toContain('URLSearchParams')
  })

  test('a receiving linker\'s language write sits after the defaults and before the last storage read', () => {
    const linked = makeGoogleConsentMode().bootstrapScript({ linker: { domains: ['a.test'], language: { supported: ['pl'] } } })

    expect(linked.indexOf(CONSENT_LANGUAGE_KEY)).toBeGreaterThan(linked.indexOf("'consent','default'"))
    expect(linked.indexOf(CONSENT_LANGUAGE_KEY)).toBeLessThan(linked.lastIndexOf('w.localStorage.getItem'))
  })
})

describe('consentHeadTag', () => {
  test('is the Consent Mode bootstrap alone, inline-safe, with no noscript', () => {
    expect(googleTagHelper.consentHeadTag()).toEqual({ head: makeGoogleConsentMode().bootstrapScript(), noscript: '' })
    expect(googleTagHelper.consentHeadTag({ storageKey: 'k</script>' }).head).not.toContain('</script')
  })

  test('equals what an invalid id yields, so a project with no tag gets the same head', () => {
    expect(googleTagHelper.consentHeadTag().head).toBe(googleTagHelper.googleTagHeadScript({ id: '' }))
  })

  test('the signal map reaches the head', () => {
    const head = googleTagHelper.consentHeadTag({ signals: { [CONSENT_MARKETING]: [] } }).head

    expect(head).not.toContain('ad_storage')
  })
})
