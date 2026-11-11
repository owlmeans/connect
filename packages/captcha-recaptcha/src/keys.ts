import { PLUGIN_RECORD } from '@owlmeans/config'
import type { PluginConfig } from '@owlmeans/config'
import type { BasicConfig, BasicContext } from '@owlmeans/context'
import { CMOD_RECAPTCHA, MOD_RECAPTCHA } from './consts.js'
import type { RecaptchaKeys, RecaptchaRecord } from './types.js'

/**
 * The keys of a context's reCAPTCHA records, read per call: the secret is `MOD_RECAPTCHA.value`, the
 * site key `MOD_RECAPTCHA.siteKey` or else the `CMOD_RECAPTCHA` client record's `value`. A value that
 * is empty — or still an unresolved `/…` file path — counts as none.
 */
export const makeRecaptchaKeys = <C extends BasicConfig, T extends BasicContext<C>>(context: T): RecaptchaKeys => {
  const recordOf = (id: string): RecaptchaRecord | undefined =>
    (context.cfg as { [PLUGIN_RECORD]?: PluginConfig[] })[PLUGIN_RECORD]?.find(entry => entry.id === id)

  const textOf = (value: unknown): string | null => {
    const text = typeof value === 'string' ? value.trim() : ''

    return text !== '' && !text.startsWith('/') ? text : null
  }

  const secret: RecaptchaKeys['secret'] = () => textOf(recordOf(MOD_RECAPTCHA)?.value)

  const siteKey: RecaptchaKeys['siteKey'] = () =>
    textOf(recordOf(MOD_RECAPTCHA)?.siteKey) ?? textOf(recordOf(CMOD_RECAPTCHA)?.value)

  return { secret, siteKey }
}
