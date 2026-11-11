import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import { RecaptchaCheckbox } from '../src/react.js'

interface CheckboxProps {
  sitekey: string
  hl?: string
  onChange: (token: string | null) => void
  onExpired: () => void
  onErrored: () => void
  asyncScriptOnLoad: () => void
}

describe('@owlmeans/web-captcha-recaptcha/react — the v2 checkbox widget', () => {
  test('renders Google\'s checkbox with the site key and reports tokens, expiry, readiness and errors', () => {
    const tokens: (string | null)[] = []
    const events: string[] = []
    const element = (RecaptchaCheckbox as (props: unknown) => ReactElement<CheckboxProps>)({
      siteKey: 'v2-key', language: 'pl',
      onToken: (token: string | null) => { tokens.push(token) },
      onReady: () => { events.push('ready') },
      onError: (error: Error) => { events.push(error.message) },
    })

    expect(element.type).toBe(ReCAPTCHA)
    expect(element.props.sitekey).toBe('v2-key')
    expect(element.props.hl).toBe('pl')
    element.props.onChange('token')
    element.props.onExpired()
    element.props.asyncScriptOnLoad()
    element.props.onErrored()
    expect(tokens).toEqual(['token', null])
    expect(events).toEqual(['ready', 'reCAPTCHA could not load'])
  })
})
