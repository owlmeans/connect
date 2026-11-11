import { describe, expect, test } from 'bun:test'
import { BOT_PLATFORM_ID_PATTERN, BotActionKind, BotTransport, type BotTexts } from '@owlmeans/bot'
import { BotInboxStatus, botHandler } from '@owlmeans/server-bot'
import { TELEGRAM_DESCRIPTOR, TELEGRAM_PLATFORM } from '../src/consts.js'
import { makeTelegramBotPlatform } from '../src/plugin.js'
import { makeTestBot, scopeOf } from './context.js'

/** The languages the bot panels ship — every text a descriptor carries is complete in each. */
const LANGUAGES = ['en', 'pl', 'ru', 'be', 'uk', 'es', 'de', 'fr']

const complete = (texts: BotTexts | undefined, what: string): void => {
  for (const language of LANGUAGES) {
    expect([what, language, typeof texts?.[language] === 'string' && texts[language].trim() !== '']).toEqual([what, language, true])
  }
}

describe('@owlmeans/bot-telegram — the descriptor', () => {
  test('names a well-formed, stable platform id and is the plugin\'s own', () => {
    expect(TELEGRAM_PLATFORM).toBe('telegram')
    expect(new RegExp(BOT_PLATFORM_ID_PATTERN).test(TELEGRAM_PLATFORM)).toBe(true)
    const plugin = makeTelegramBotPlatform()
    expect([plugin.platform, plugin.descriptor]).toEqual([TELEGRAM_PLATFORM, TELEGRAM_DESCRIPTOR])
    expect(TELEGRAM_DESCRIPTOR.platform).toBe(TELEGRAM_PLATFORM)
  })

  test('carries every label and hint in all eight panel languages', () => {
    complete(TELEGRAM_DESCRIPTOR.hint, 'hint')
    for (const field of TELEGRAM_DESCRIPTOR.credentials) {
      complete(field.label, `${field.key}.label`)
      complete(field.hint, `${field.key}.hint`)
    }
    if (TELEGRAM_DESCRIPTOR.link != null) {
      complete(TELEGRAM_DESCRIPTOR.link.label, 'link.label')
      complete(TELEGRAM_DESCRIPTOR.link.pending, 'link.pending')
    }
  })

  test('lists platform calls only (never note) and a glyph, docs and a receive mode', () => {
    expect(TELEGRAM_DESCRIPTOR.actions).not.toContain(BotActionKind.Note)
    expect(TELEGRAM_DESCRIPTOR.receive.length).toBeGreaterThan(0)
    expect(TELEGRAM_DESCRIPTOR.docs).toStartWith('https://')
    expect(['send', 'phone', 'messages', 'hash', 'chat']).toContain(TELEGRAM_DESCRIPTOR.glyph)
    expect(Object.isFrozen(TELEGRAM_DESCRIPTOR) && Object.isFrozen(TELEGRAM_DESCRIPTOR.credentials)).toBe(true)
  })

  test('a message simulated after a restart (fresh plugin, same connection and store) is stored and dispatched', async () => {
    const scope = scopeOf()
    const before = makeTestBot({ platforms: [makeTelegramBotPlatform()] })
    const saved = await before.service.connections.save(scope, { platform: TELEGRAM_PLATFORM, label: 'Mock', transport: BotTransport.Mock })
    await before.service.connections.verify(scope, saved.id)
    const first = await before.service.simulate(scope, saved.id, { text: 'before the restart' })
    expect(await before.service.runtime([botHandler('seen', async () => undefined)]).dispatch()).toBe(1)

    const after = makeTestBot({ platforms: [makeTelegramBotPlatform()] }, before.store)
    const seen: string[] = []
    const runtime = after.service.runtime([botHandler('seen', async update => { seen.push(update.id) })])
    const second = await after.service.simulate(scope, saved.id, { text: 'after the restart' })

    expect([first.duplicate, second.duplicate, second.update === first.update]).toEqual([false, false, false])
    expect(await runtime.dispatch()).toBe(1)
    expect(seen).toEqual([second.update])
    expect((await after.updates.get(second.update)).status).toBe(BotInboxStatus.Done)
  })
})
