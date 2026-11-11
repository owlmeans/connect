import type { BasicContext } from '@owlmeans/context'
import { appendBot, BOT_SERVICE, type BotPlatformPlugin } from '@owlmeans/server-bot'
import { makeWhatsAppBotPlatform } from './plugin.js'
import type { WhatsAppBotPlatformOptions } from './types.js'

/**
 * Register the WhatsApp plugin on the context's bot service — appending the service (`appendBot`, its
 * default options) when it is not there yet — and answer the plugin. Registration is explicit:
 * importing this package registers nothing.
 */
export const appendWhatsAppBotPlatform = <C extends BasicContext<any>>(
  context: C, opts?: WhatsAppBotPlatformOptions, alias: string = BOT_SERVICE
): BotPlatformPlugin => {
  const plugin = makeWhatsAppBotPlatform(opts)
  appendBot(context, undefined, alias).register(plugin)

  return plugin
}
