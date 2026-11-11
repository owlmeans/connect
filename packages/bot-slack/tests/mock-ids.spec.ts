import { describe, expect, test } from 'bun:test'
import { BotConnectionStatus, BotTransport, type BotSimulateInput } from '@owlmeans/bot'
import type { BotPlatformConnection, BotPlatformMock } from '@owlmeans/server-bot'
import { SLACK_DESCRIPTOR } from '../src/consts.js'
import { makeSlackBotPlatform } from '../src/plugin.js'

/** One stored mock connection, as each "process" of a test opens it. */
const connectionOf = (platform: string): BotPlatformConnection => ({
  id: `conn-${platform}`, scope: 'org', platform, label: 'Mock', transport: BotTransport.Mock,
  status: BotConnectionStatus.Connected, enabled: true, receive: SLACK_DESCRIPTOR.receive[0], credentialsSet: [],
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', credentials: {}, hookSecret: 'hook-secret',
})

const input: BotSimulateInput = { text: 'hello' }

/** The native body of a simulated message, built by `mock`. */
const bodyOf = (mock: BotPlatformMock, platform: string): any => mock.inbound(input, connectionOf(platform)).body

/** Eight fresh mocks — eight process lifetimes of the same connection. */
const lifetimes = <T>(make: () => { mock: BotPlatformMock }, read: (mock: BotPlatformMock) => T): T[] =>
  Array.from({ length: 8 }, () => read(make().mock))

describe('@owlmeans/bot-slack — mock ids: the platform\'s shapes, unique across restarts and processes', () => {
  test('Slack: ts is now with a unique microsecond part, event_id is random; both differ across lifetimes', () => {
    const plugin = makeSlackBotPlatform()
    const one = bodyOf(plugin.mock, 'slack')
    const bodies = [one, bodyOf(plugin.mock, 'slack'), ...lifetimes(makeSlackBotPlatform, mock => bodyOf(mock, 'slack'))]
    const stamps = bodies.map(body => body.event.ts as string)
    const events = bodies.map(body => body.event_id as string)

    expect(stamps.every(ts => /^\d{10}\.\d{6}$/.test(ts))).toBe(true)
    expect(Math.abs(Number(one.event.ts) - Date.now() / 1000)).toBeLessThan(5)
    expect(events.every(id => /^Ev[0-9A-Z]{10}$/.test(id))).toBe(true)
    expect([new Set(stamps).size, new Set(events).size]).toEqual([bodies.length, bodies.length])
  })
})
