import { describe, expect, test } from 'bun:test'
import { captchaClients, captchaNoticeHelper, createCaptchaClients } from '@owlmeans/web-captcha'
import { appendRecaptchaClient } from '../src/append.js'
import { makeRecaptchaClient } from '../src/client.js'
import { CMOD_RECAPTCHA, RECAPTCHA_PRIVACY_URL, RECAPTCHA_PROVIDER, RECAPTCHA_TERMS_URL, RECAPTCHA_TEXTS } from '../src/consts.js'
import { createRecaptchaLoader } from '../src/loader.js'
import { makeTestPage } from './context.js'

/** The eight languages of OwlMeans sign-in. */
const LANGUAGES = ['en', 'pl', 'ru', 'be', 'uk', 'es', 'de', 'fr']

const placeholders = (text: string): string[] => [...text.matchAll(/\{\{\s*([\w-]+)\s*\}\}/g)].map(m => m[1]).sort()

describe('@owlmeans/web-captcha-recaptcha — the client', () => {
  test('is the recaptcha provider\'s client: tokens through the v3 loader, the site key record named', async () => {
    const page = makeTestPage()
    const client = makeRecaptchaClient({ loader: createRecaptchaLoader({ document: page.document, window: page.window }) })

    expect(client.id).toBe(RECAPTCHA_PROVIDER)
    expect(RECAPTCHA_PROVIDER).toBe('recaptcha')
    expect(client.siteKeyRecord).toBe(CMOD_RECAPTCHA)
    expect(CMOD_RECAPTCHA).toBe('_client-external:re-captcha')
    expect(client.widget).toBeUndefined()

    const loaded = client.load('k')
    page.arrive(page.scripts()[0])
    await loaded
    expect(await client.execute('k', 'inquiry')).toBe('token:k:inquiry')
  })

  test('registers in the page\'s clients — or the registry given — explicitly, never on import', () => {
    expect(captchaClients.list()).toEqual([])

    const clients = createCaptchaClients()
    const widget = () => null
    const client = appendRecaptchaClient({ widget }, clients)
    expect(clients.get(RECAPTCHA_PROVIDER)).toBe(client)
    expect(client.widget).toBe(widget)
    expect(captchaClients.list()).toEqual([])
  })

  test('ships Google\'s notice in the eight languages: the same placeholders, both links, none empty', () => {
    expect(Object.keys(RECAPTCHA_TEXTS).sort()).toEqual([...LANGUAGES].sort())
    for (const language of LANGUAGES) {
      const texts = RECAPTCHA_TEXTS[language]
      expect([language, Object.keys(texts).sort()]).toEqual([language, ['notice', 'privacy', 'terms']])
      expect(placeholders(texts.notice)).toEqual(['privacy', 'terms'])
      for (const text of Object.values(texts)) {
        expect(text.trim()).not.toBe('')
      }
    }

    expect(captchaNoticeHelper.noticeOf(makeRecaptchaClient(), 'de-AT')).toEqual({
      sentence: RECAPTCHA_TEXTS.de.notice,
      links: {
        privacy: { text: 'Datenschutzerklärung', href: RECAPTCHA_PRIVACY_URL },
        terms: { text: 'Nutzungsbedingungen', href: RECAPTCHA_TERMS_URL },
      },
    })
    expect(captchaNoticeHelper.noticeOf(makeRecaptchaClient(), 'it')?.sentence)
      .toBe('This site is protected by reCAPTCHA and the Google {{privacy}} and {{terms}} apply.')
  })
})
