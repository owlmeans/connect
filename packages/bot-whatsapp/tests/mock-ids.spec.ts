import { describe, expect, test } from 'bun:test'
import { BotConnectionStatus, BotTransport, type BotSimulateInput } from '@owlmeans/bot'
import type { BotPlatformConnection, BotPlatformMock } from '@owlmeans/server-bot'
import { WHATSAPP_DESCRIPTOR } from '../src/consts.js'
import { makeWhatsAppBotPlatform } from '../src/plugin.js'
import type { WhatsAppMock } from '../src/types.js'

/** One stored mock connection, as each "process" of a test opens it. */
const connectionOf = (platform: string): BotPlatformConnection => ({
  id: `conn-${platform}`, scope: 'org', platform, label: 'Mock', transport: BotTransport.Mock,
  status: BotConnectionStatus.Connected, enabled: true, receive: WHATSAPP_DESCRIPTOR.receive[0], credentialsSet: [],
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', credentials: {}, hookSecret: 'hook-secret',
})

const input: BotSimulateInput = { text: 'hello' }

/** The native body of a simulated message, built by `mock`. */
const bodyOf = (mock: BotPlatformMock, platform: string): any => mock.inbound(input, connectionOf(platform)).body

/** Eight fresh mocks — eight process lifetimes of the same connection. */
const lifetimes = <T>(make: () => { mock: BotPlatformMock }, read: (mock: BotPlatformMock) => T): T[] =>
  Array.from({ length: 8 }, () => read(make().mock))

describe('@owlmeans/bot-whatsapp — mock ids: the platform\'s shapes, unique across restarts and processes', () => {
  test('WhatsApp: every wamid (inbound and sent) is fresh and random', async () => {
    const plugin = makeWhatsAppBotPlatform()
    const idOf = (mock: BotPlatformMock): string => bodyOf(mock, 'whatsapp').entry[0].changes[0].value.messages[0].id
    const connection = connectionOf('whatsapp')
    const sent: any = await (await plugin.mock.fetch(connection)(
      `https://graph.facebook.com/v26.0/${(plugin.mock as WhatsAppMock).phoneNumberIdOf(connection)}/messages`,
      { method: 'POST', body: JSON.stringify({ messaging_product: 'whatsapp', to: '15550001', type: 'text', text: { body: 'hi' } }) }
    )).json()
    const ids = [idOf(plugin.mock), sent.messages[0].id, ...lifetimes(makeWhatsAppBotPlatform, idOf)]

    expect(ids.every(id => /^wamid\.[A-Za-z0-9+/]+=*$/.test(id))).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
