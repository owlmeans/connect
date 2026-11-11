import { describe, expect, test } from 'bun:test'
import { BotConnectionStatus, BotTransport, type BotSimulateInput } from '@owlmeans/bot'
import type { BotPlatformConnection, BotPlatformMock } from '@owlmeans/server-bot'
import { DISCORD_DESCRIPTOR, DISCORD_EPOCH } from '../src/consts.js'
import { makeDiscordBotPlatform } from '../src/plugin.js'

/** One stored mock connection, as each "process" of a test opens it. */
const connectionOf = (platform: string): BotPlatformConnection => ({
  id: `conn-${platform}`, scope: 'org', platform, label: 'Mock', transport: BotTransport.Mock,
  status: BotConnectionStatus.Connected, enabled: true, receive: DISCORD_DESCRIPTOR.receive[0], credentialsSet: [],
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', credentials: {}, hookSecret: 'hook-secret',
})

const input: BotSimulateInput = { text: 'hello' }

/** The native body of a simulated message, built by `mock`. */
const bodyOf = (mock: BotPlatformMock, platform: string): any => mock.inbound(input, connectionOf(platform)).body

/** Eight fresh mocks — eight process lifetimes of the same connection. */
const lifetimes = <T>(make: () => { mock: BotPlatformMock }, read: (mock: BotPlatformMock) => T): T[] =>
  Array.from({ length: 8 }, () => read(make().mock))

describe('@owlmeans/bot-discord — mock ids: the platform\'s shapes, unique across restarts and processes', () => {
  test('Discord: snowflakes carry the current time, grow within a lifetime and differ across lifetimes of one millisecond', () => {
    const start = Date.now()
    const plugin = makeDiscordBotPlatform()
    const [one, two] = [bodyOf(plugin.mock, 'discord').d.id, bodyOf(plugin.mock, 'discord').d.id] as string[]
    const ids = [one, two, ...lifetimes(makeDiscordBotPlatform, mock => bodyOf(mock, 'discord').d.id as string)]
    const minted = Number(BigInt(one) >> 22n) + DISCORD_EPOCH

    expect(ids.every(id => /^\d{17,20}$/.test(id))).toBe(true)
    expect([minted >= start, minted <= Date.now(), BigInt(two) > BigInt(one)]).toEqual([true, true, true])
    expect(new Set(ids).size).toBe(ids.length)
  })
})
