import { PLUGIN_RECORD } from '@owlmeans/config'
import type { PluginConfig } from '@owlmeans/config'
import { AppType, makeBasicContext } from '@owlmeans/context'
import type { BasicConfig, BasicContext } from '@owlmeans/context'
import type { RecaptchaFetch, RecaptchaResponse } from '../src/types.js'

export interface Call {
  url: string
  init: RequestInit
}

/** A `fetch` stand-in answering `status` with `body`, recording each call — no network. */
export const answering = (status: number, body: unknown, calls: Call[] = []): RecaptchaFetch =>
  async (url, init) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(body), { status })
  }

export const GOOD: RecaptchaResponse = {
  success: true, challenge_ts: '2026-10-06T10:00:00Z', hostname: 'vib-dev-1.owlmeans.org', score: 0.9, action: 'email_pin',
}

/** A backend context with these plugin records; `setup` runs before it is configured and initialized. */
export const makeTestCtx = async (
  plugins: PluginConfig[] = [], setup?: (context: BasicContext<BasicConfig>) => void
): Promise<BasicContext<BasicConfig>> => {
  const context = makeBasicContext<BasicConfig>({
    ready: false, service: 'captcha-recaptcha-tests', type: AppType.Backend, services: {},
    [PLUGIN_RECORD]: plugins.map(record => ({ ...record })),
  } as BasicConfig)
  setup?.(context)
  context.configure()
  await context.init()

  return context
}
