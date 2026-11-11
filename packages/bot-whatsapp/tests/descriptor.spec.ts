import { describe, expect, test } from 'bun:test'
import { BOT_PLATFORM_ID_PATTERN, BotActionKind, BotTransport, type BotTexts } from '@owlmeans/bot'
import { BotInboxStatus, botHandler } from '@owlmeans/server-bot'
import { WHATSAPP_DESCRIPTOR, WHATSAPP_PLATFORM } from '../src/consts.js'
import { makeWhatsAppBotPlatform } from '../src/plugin.js'
import { makeTestBot, scopeOf } from './context.js'

/** The languages the bot panels ship — every text a descriptor carries is complete in each. */
const LANGUAGES = ['en', 'pl', 'ru', 'be', 'uk', 'es', 'de', 'fr']

const complete = (texts: BotTexts | undefined, what: string): void => {
  for (const language of LANGUAGES) {
    expect([what, language, typeof texts?.[language] === 'string' && texts[language].trim() !== '']).toEqual([what, language, true])
  }
}

describe('@owlmeans/bot-whatsapp — the descriptor', () => {
  test('names a well-formed, stable platform id and is the plugin\'s own', () => {
    expect(WHATSAPP_PLATFORM).toBe('whatsapp')
    expect(new RegExp(BOT_PLATFORM_ID_PATTERN).test(WHATSAPP_PLATFORM)).toBe(true)
    const plugin = makeWhatsAppBotPlatform()
    expect([plugin.platform, plugin.descriptor]).toEqual([WHATSAPP_PLATFORM, WHATSAPP_DESCRIPTOR])
    expect(WHATSAPP_DESCRIPTOR.platform).toBe(WHATSAPP_PLATFORM)
  })

  test('carries every label and hint in all eight panel languages', () => {
    complete(WHATSAPP_DESCRIPTOR.hint, 'hint')
    for (const field of WHATSAPP_DESCRIPTOR.credentials) {
      complete(field.label, `${field.key}.label`)
      complete(field.hint, `${field.key}.hint`)
    }
    if (WHATSAPP_DESCRIPTOR.link != null) {
      complete(WHATSAPP_DESCRIPTOR.link.label, 'link.label')
      complete(WHATSAPP_DESCRIPTOR.link.pending, 'link.pending')
    }
  })

  test('lists platform calls only (never note) and a glyph, docs and a receive mode', () => {
    expect(WHATSAPP_DESCRIPTOR.actions).not.toContain(BotActionKind.Note)
    expect(WHATSAPP_DESCRIPTOR.receive.length).toBeGreaterThan(0)
    expect(WHATSAPP_DESCRIPTOR.docs).toStartWith('https://')
    expect(['send', 'phone', 'messages', 'hash', 'chat']).toContain(WHATSAPP_DESCRIPTOR.glyph)
    expect(Object.isFrozen(WHATSAPP_DESCRIPTOR) && Object.isFrozen(WHATSAPP_DESCRIPTOR.credentials)).toBe(true)
  })

  test('a message simulated after a restart (fresh plugin, same connection and store) is stored and dispatched', async () => {
    const scope = scopeOf()
    const before = makeTestBot({ platforms: [makeWhatsAppBotPlatform()] })
    const saved = await before.service.connections.save(scope, { platform: WHATSAPP_PLATFORM, label: 'Mock', transport: BotTransport.Mock })
    await before.service.connections.verify(scope, saved.id)
    const first = await before.service.simulate(scope, saved.id, { text: 'before the restart' })
    expect(await before.service.runtime([botHandler('seen', async () => undefined)]).dispatch()).toBe(1)

    const after = makeTestBot({ platforms: [makeWhatsAppBotPlatform()] }, before.store)
    const seen: string[] = []
    const runtime = after.service.runtime([botHandler('seen', async update => { seen.push(update.id) })])
    const second = await after.service.simulate(scope, saved.id, { text: 'after the restart' })

    expect([first.duplicate, second.duplicate, second.update === first.update]).toEqual([false, false, false])
    expect(await runtime.dispatch()).toBe(1)
    expect(seen).toEqual([second.update])
    expect((await after.updates.get(second.update)).status).toBe(BotInboxStatus.Done)
  })
})
