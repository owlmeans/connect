import { describe, expect, test } from 'bun:test'
import { AuthUnavailable } from '@owlmeans/auth'
import { addLogPlugin, memoryPlugin } from '@owlmeans/log'
import { CMOD_RECAPTCHA, MOD_RECAPTCHA, RECAPTCHA_PROVIDER } from '../src/consts.js'
import { makeRecaptchaProvider } from '../src/provider.js'
import { answering, GOOD } from './context.js'
import type { Call } from './context.js'

describe('@owlmeans/captcha-recaptcha — the provider', () => {
  test('maps Google\'s answer onto the neutral verdict, asking with the secret, the token and the IP', async () => {
    const calls: Call[] = []
    const provider = makeRecaptchaProvider({ secret: 'secret', siteKey: 'site-key', fetch: answering(200, GOOD, calls) })

    expect(provider.id).toBe(RECAPTCHA_PROVIDER)
    // Shared with the browser client (`@owlmeans/web-captcha-recaptcha`) and stored in deployed configs.
    expect([RECAPTCHA_PROVIDER, MOD_RECAPTCHA, CMOD_RECAPTCHA]).toEqual(['recaptcha', '_external:re-captcha', '_client-external:re-captcha'])
    expect(await provider.verify('token', { action: 'email_pin', remoteIp: '203.0.113.7' })).toEqual({
      success: true, score: 0.9, action: 'email_pin', hostname: 'vib-dev-1.owlmeans.org', at: '2026-10-06T10:00:00Z',
    })
    expect(Object.fromEntries(calls[0].init.body as URLSearchParams)).toEqual({ secret: 'secret', response: 'token', remoteip: '203.0.113.7' })

    const refused = makeRecaptchaProvider({
      secret: 'secret', fetch: answering(200, { success: false, challenge_ts: '', hostname: '', 'error-codes': ['timeout-or-duplicate'] }),
    })
    expect(await refused.verify('token')).toEqual({ success: false, hostname: '', errors: ['timeout-or-duplicate'] })

    const checkbox = makeRecaptchaProvider({ secret: 'secret', fetch: answering(200, { success: true, challenge_ts: '2026-10-06T10:00:00Z', hostname: 'a.org' }) })
    expect(await checkbox.verify('token')).toEqual({ success: true, hostname: 'a.org', at: '2026-10-06T10:00:00Z' })
  })

  test('advertises its id and site key; fixed values win over keys read per call', () => {
    let siteKey: string | null = null
    const keys = { secret: () => 'from-keys', siteKey: () => siteKey }
    const provider = makeRecaptchaProvider({ keys })

    expect(provider.clientSettings()).toEqual({ provider: 'recaptcha', siteKey: '' })
    siteKey = 'resolved-later'
    expect(provider.clientSettings()).toEqual({ provider: 'recaptcha', siteKey: 'resolved-later' })
    expect(makeRecaptchaProvider({ keys, siteKey: 'fixed', id: 'recaptcha-enterprise' }).clientSettings())
      .toEqual({ provider: 'recaptcha-enterprise', siteKey: 'fixed' })
  })

  test('without a secret nothing is asked: unavailability, logged once', async () => {
    const memory = memoryPlugin('recaptcha-secret')
    const remove = addLogPlugin(memory)
    try {
      const calls: Call[] = []
      const provider = makeRecaptchaProvider({ keys: { secret: () => null, siteKey: () => 'k' }, fetch: answering(200, GOOD, calls) })
      for (let attempt = 0; attempt < 2; attempt++) {
        const error = await provider.verify('token').catch((e: unknown) => e)
        expect(error).toBeInstanceOf(AuthUnavailable)
        expect((error as Error).message).toContain('captcha:config')
      }
      expect(calls).toHaveLength(0)
      expect(memory.records.filter(record => record.event === 'auth.captcha.config')).toHaveLength(1)
    } finally {
      remove()
    }
  })
})
