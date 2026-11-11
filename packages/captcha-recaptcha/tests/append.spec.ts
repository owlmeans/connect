import { describe, expect, test } from 'bun:test'
import { AuthenFailed } from '@owlmeans/auth'
import { captchaResolverOf, makeCaptchaCheck, MOD_CAPTCHA } from '@owlmeans/captcha'
import { AppType } from '@owlmeans/context'
import { appendRecaptcha } from '../src/append.js'
import { CMOD_RECAPTCHA, MOD_RECAPTCHA, RECAPTCHA_PROVIDER } from '../src/consts.js'
import { makeRecaptchaKeys } from '../src/keys.js'
import { answering, GOOD, makeTestCtx } from './context.js'
import type { Call } from './context.js'

describe('@owlmeans/captcha-recaptcha — appendRecaptcha', () => {
  test('registers the provider in the context\'s captcha host, keys read from the records', async () => {
    const calls: Call[] = []
    const context = await makeTestCtx([
      { id: MOD_RECAPTCHA, type: AppType.Backend, value: 'recaptcha-secret' },
      { id: CMOD_RECAPTCHA, type: AppType.Frontend, value: 'site-key' },
    ], ctx => { appendRecaptcha(ctx, { fetch: answering(200, GOOD, calls) }) })

    const provider = captchaResolverOf(context).provider(RECAPTCHA_PROVIDER)
    expect(provider.clientSettings()).toEqual({ provider: RECAPTCHA_PROVIDER, siteKey: 'site-key' })

    const check = makeCaptchaCheck(context, { provider: RECAPTCHA_PROVIDER, hostnames: 'owlmeans.org', minScore: 0.5 })
    expect(check.clientSettings()).toEqual({ provider: 'recaptcha', siteKey: 'site-key' })
    await check.assert({ token: 'token', action: 'email_pin', remoteIp: '203.0.113.7' })
    expect(Object.fromEntries(calls[0].init.body as URLSearchParams))
      .toEqual({ secret: 'recaptcha-secret', response: 'token', remoteip: '203.0.113.7' })
    await expect(check.assert({ token: 'token', action: 'email_password' })).rejects.toBeInstanceOf(AuthenFailed)
  })

  test('the record\'s own site key wins; an empty or unresolved value counts as none', async () => {
    const context = await makeTestCtx([
      { id: MOD_RECAPTCHA, value: '/etc/master-secret/recaptcha-secret', siteKey: 'own-key' },
      { id: CMOD_RECAPTCHA, value: 'client-key' },
    ])
    const keys = makeRecaptchaKeys(context)

    expect(keys.siteKey()).toBe('own-key')
    expect(keys.secret()).toBeNull()
    expect(makeRecaptchaKeys(await makeTestCtx([{ id: CMOD_RECAPTCHA, value: ' ' }])).siteKey()).toBeNull()
  })

  test('options replace the records, and the host record boots only with the provider registered', async () => {
    const declared = { id: MOD_CAPTCHA, provider: RECAPTCHA_PROVIDER, hostnames: 'owlmeans.org' }
    const context = await makeTestCtx([declared], ctx => { appendRecaptcha(ctx, { secret: 's', siteKey: 'fixed' }) })

    expect(captchaResolverOf(context).find()?.clientSettings()).toEqual({ provider: 'recaptcha', siteKey: 'fixed' })
    await expect(makeTestCtx([declared], ctx => { appendRecaptcha(ctx, { id: 'recaptcha-enterprise' }) }))
      .rejects.toThrow('captcha:provider:recaptcha')
  })
})
