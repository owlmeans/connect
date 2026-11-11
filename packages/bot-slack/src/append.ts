import type { BasicContext } from '@owlmeans/context'
import { appendBot, BOT_SERVICE } from '@owlmeans/server-bot'
import { makeSlackBotPlatform } from './plugin.js'
import type { SlackBotPlatformOptions, SlackBotPlatform } from './types.js'

/**
 * Register the Slack plugin on the context's bot service — appending the service (`appendBot`, its
 * default options) when it is not there yet — and answer the plugin. Registration is explicit:
 * importing this package registers nothing.
 */
export const appendSlackBotPlatform = <C extends BasicContext<any>>(
  context: C, opts?: SlackBotPlatformOptions, alias: string = BOT_SERVICE
): SlackBotPlatform => {
  const plugin = makeSlackBotPlatform(opts)
  appendBot(context, undefined, alias).register(plugin)

  return plugin
}
