import { describe, expect, test } from 'bun:test'
import { DEFAULT_CONSENT_CATEGORIES, consentTrackingHelper } from '@owlmeans/consent'
import type { ConsentCategory } from '@owlmeans/consent'
import { googleTagHelper, makeGoogleConsentMode } from '../src/index.js'
import type { GoogleConsentHeadOptions } from '../src/index.js'
import golden from './fixtures/head-golden.json' with { type: 'json' }

/**
 * The head strings pages already carry, captured before Consent Mode left `@owlmeans/consent` for
 * this package (`fixtures/head-golden.json`). Documents are served under a hash-based CSP and a
 * generated target's build stamps the same string, so the same inputs must keep producing the same
 * bytes.
 */
const expected = golden as Record<string, string>

const HOSTILE_KEY = 'x</script><!--y'

/** The inputs each capture was taken with — in today's shape (a category's signals live in the map). */
const inputs: Record<string, GoogleConsentHeadOptions> = {
  C0: {},
  C2: { linker: { domains: ['owlmeans.com', 'owlmeans.pl', 'platform.owlmeans.com'], language: {} } },
  C3: { linker: { domains: ['owlmeans.com', 'owlmeans.pl', 'localhost', 'owlmeans.org'], language: { supported: ['en', 'pl', 'uk', 'ru', 'be', 'es', 'de', 'fr'] } } },
  C4: { cookieDays: 30, linker: { domains: ['a.test'], maxAge: 120, param: 'x' } },
  C7: { categories: [...DEFAULT_CONSENT_CATEGORIES, { key: 'chat', labelKey: 'chat', descriptionKey: 'chatDesc', globalVar: 'owlConsentChat' }] },
  C8: { storageKey: 'k</script>' },
  HOSTILE: {
    categories: [
      ...DEFAULT_CONSENT_CATEGORIES,
      { key: HOSTILE_KEY, labelKey: 'x', descriptionKey: 'x', globalVar: 'probe', tracking: true } satisfies ConsentCategory,
    ],
    signals: { [HOSTILE_KEY]: ['personalization_storage'] },
  },
}

describe('the emitted head strings are byte-identical to the captured ones', () => {
  for (const key of Object.keys(expected)) {
    test(key, () => {
      const [kind, name, id, mode] = key.split('|')
      const opts = { ...inputs[name!], id: id!, ...(mode != null && mode !== 'undefined' ? { mode: mode as 'basic' | 'advanced' } : {}) }
      const actual = kind === 'googleTagHeadScript' ? googleTagHelper.googleTagHeadScript(opts)
        : kind === 'gtmHeadScript' ? googleTagHelper.gtmHeadScript(opts)
          : kind === 'headTag' ? JSON.stringify(googleTagHelper.headTag(opts))
            : kind === 'gate' ? consentTrackingHelper.consentGateScript('window.__loaded=1', inputs[name!])
              : kind === 'bootstrap' ? makeGoogleConsentMode(inputs[name!]).bootstrapScript(inputs[name!])
                : name === 'tagless' ? googleTagHelper.consentHeadTag().head
                  : googleTagHelper.googleTagHeadScript({ id: 'G-ABCD1234' })

      expect(actual).toBe(expected[key]!)
    })
  }
})
