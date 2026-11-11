import type { BasicContext } from '@owlmeans/context'
import { appendBot, BOT_SERVICE, type BotPlatformPlugin } from '@owlmeans/server-bot'
import { makeDiscordBotPlatform } from './plugin.js'
import type { DiscordBotPlatformOptions } from './types.js'

/**
 * Register the Discord plugin on the context's bot service — appending the service (`appendBot`, its
 * default options) when it is not there yet — and answer the plugin. Registration is explicit:
 * importing this package registers nothing.
 */
export const appendDiscordBotPlatform = <C extends BasicContext<any>>(
  context: C, opts?: DiscordBotPlatformOptions, alias: string = BOT_SERVICE
): BotPlatformPlugin => {
  const plugin = makeDiscordBotPlatform(opts)
  appendBot(context, undefined, alias).register(plugin)

  return plugin
}
