import type { BasicContext } from '@owlmeans/context'
import { appendBot, BOT_SERVICE, type BotPlatformPlugin } from '@owlmeans/server-bot'
import { makeTelegramBotPlatform } from './plugin.js'
import type { TelegramBotPlatformOptions } from './types.js'

/**
 * Register the Telegram plugin on the context's bot service — appending the service (`appendBot`, its
 * default options) when it is not there yet — and answer the plugin. Registration is explicit:
 * importing this package registers nothing.
 */
export const appendTelegramBotPlatform = <C extends BasicContext<any>>(
  context: C, opts?: TelegramBotPlatformOptions, alias: string = BOT_SERVICE
): BotPlatformPlugin => {
  const plugin = makeTelegramBotPlatform(opts)
  appendBot(context, undefined, alias).register(plugin)

  return plugin
}
