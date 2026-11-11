import { describe, expect, test } from 'bun:test'
import { BotConnectionStatus, BotTransport, type BotSimulateInput } from '@owlmeans/bot'
import type { BotPlatformConnection, BotPlatformMock } from '@owlmeans/server-bot'
import { TELEGRAM_DESCRIPTOR, TELEGRAM_ID_MAX } from '../src/consts.js'
import { makeTelegramBotPlatform } from '../src/plugin.js'

/** One stored mock connection, as each "process" of a test opens it. */
const connectionOf = (platform: string): BotPlatformConnection => ({
  id: `conn-${platform}`, scope: 'org', platform, label: 'Mock', transport: BotTransport.Mock,
  status: BotConnectionStatus.Connected, enabled: true, receive: TELEGRAM_DESCRIPTOR.receive[0], credentialsSet: [],
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', credentials: {}, hookSecret: 'hook-secret',
})

const input: BotSimulateInput = { text: 'hello' }

/** The native body of a simulated message, built by `mock`. */
const bodyOf = (mock: BotPlatformMock, platform: string): any => mock.inbound(input, connectionOf(platform)).body

/** Eight fresh mocks — eight process lifetimes of the same connection. */
const lifetimes = <T>(make: () => { mock: BotPlatformMock }, read: (mock: BotPlatformMock) => T): T[] =>
  Array.from({ length: 8 }, () => read(make().mock))

const int32 = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= TELEGRAM_ID_MAX

describe('@owlmeans/bot-telegram — mock ids: the platform\'s shapes, unique across restarts and processes', () => {
  test('Telegram: update_id and message_id (inbound and sent) are positive 32-bit integers; each lifetime starts elsewhere', async () => {
    const plugin = makeTelegramBotPlatform()
    const [one, two] = [bodyOf(plugin.mock, 'telegram'), bodyOf(plugin.mock, 'telegram')]
    const sent: any = await (await plugin.mock.fetch(connectionOf('telegram'))(
      'https://api.telegram.org/bot/sendMessage', { method: 'POST', body: JSON.stringify({ chat_id: -100, text: 'hi' }) }
    )).json()
    const firsts = lifetimes(makeTelegramBotPlatform, mock => bodyOf(mock, 'telegram').update_id)

    expect([one.update_id, one.message.message_id, two.update_id, sent.result.message_id, ...firsts].every(int32)).toBe(true)
    expect(two.update_id - one.update_id).toBe(1)
    expect(new Set([one.update_id, ...firsts]).size).toBe(firsts.length + 1)
  })
})
