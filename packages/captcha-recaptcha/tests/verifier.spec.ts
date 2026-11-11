import { describe, expect, test } from 'bun:test'
import { AuthUnavailable } from '@owlmeans/auth'
import { RECAPTCHA_SITEVERIFY_URL, RECAPTCHA_VERIFY_TIMEOUT } from '../src/consts.js'
import type { RecaptchaFetch, RecaptchaResponse } from '../src/types.js'
import { createRecaptchaVerifier } from '../src/verifier.js'
import { answering, GOOD } from './context.js'
import type { Call } from './context.js'

describe('@owlmeans/captcha-recaptcha — siteverify', () => {
  test('posts the siteverify form to Google over https', async () => {
    const calls: Call[] = []
    const verifier = createRecaptchaVerifier({ fetch: answering(200, GOOD, calls) })

    expect(await verifier.verify({ secret: 's', response: 'r', remoteip: '203.0.113.7' })).toEqual(GOOD)
    expect(await verifier.verify({ secret: 's', response: 'r', remoteip: '' })).toEqual(GOOD)
    expect(calls).toHaveLength(2)
    expect(calls[0].url).toBe(RECAPTCHA_SITEVERIFY_URL)
    expect(RECAPTCHA_SITEVERIFY_URL).toBe('https://www.google.com/recaptcha/api/siteverify')
    expect(calls[0].init.method).toBe('POST')
    expect(new Headers(calls[0].init.headers).get('content-type')).toBe('application/x-www-form-urlencoded')
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal)
    expect(Object.fromEntries(calls[0].init.body as URLSearchParams)).toEqual({ secret: 's', response: 'r', remoteip: '203.0.113.7' })
    expect(Object.fromEntries(calls[1].init.body as URLSearchParams)).toEqual({ secret: 's', response: 'r' })
    expect(RECAPTCHA_VERIFY_TIMEOUT).toBe(10_000)
  })

  test('an unreachable or unreadable Google is unavailability, not a refusal', async () => {
    const failing: RecaptchaFetch = async () => { throw new Error('offline') }
    const garbage: RecaptchaFetch = async () => new Response('<html>', { status: 200 })
    for (const fetch of [failing, garbage, answering(500, GOOD), answering(200, { nothing: true }), answering(200, null)]) {
      const error = await createRecaptchaVerifier({ fetch }).verify({ secret: 's', response: 'r' }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(AuthUnavailable)
      expect((error as Error).message).toEndWith('unavailable:captcha')
    }
  })

  test('a refusal is an answer, not an error', async () => {
    const refusal: RecaptchaResponse = { ...GOOD, success: false, 'error-codes': ['invalid-input-response'] }

    expect(await createRecaptchaVerifier({ fetch: answering(200, refusal) }).verify({ secret: 's', response: 'r' })).toEqual(refusal)
  })

  test('refuses a siteverify address that is not https', () => {
    expect(() => createRecaptchaVerifier({ url: 'http://www.google.com/recaptcha/api/siteverify' })).toThrow(SyntaxError)
  })
})
