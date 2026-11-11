import { afterEach, describe, expect, test } from 'bun:test'
import { BotActionKind, BotChatKind, BotConnectionStatus, BotReceiveMode, BotTransport, botTextHelper, type BotUpdate } from '@owlmeans/bot'
import { BotInboxStatus, botHandler, type BotFetch, type BotRuntime } from '@owlmeans/server-bot'
import { TELEGRAM_SECRET_HEADER } from '../src/consts.js'
import { telegramBotPlatform } from '../src/plugin.js'
import { botMockHelper, makeTestBot, scopeOf, sleep, until, type TestBot } from './context.js'

const telegram = { platform: 'telegram', label: 'Moderator' }
const ORIGIN = 'https://shop.example.com'

const runtimes: BotRuntime[] = []
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map(async runtime => { await runtime.stop() }))
})

const connect = async (bot: TestBot, scope: string) => {
  const saved = await bot.service.connections.save(scope, { ...telegram, transport: BotTransport.Mock })
  return await bot.service.connections.verify(scope, saved.id)
}

describe('@owlmeans/bot-telegram — connections through the service', () => {
  test('a mock connection verifies with getMe and polls without a public origin', async () => {
    const { service } = makeTestBot()
    const scope = scopeOf()
    const saved = await service.connections.save(scope, { ...telegram, transport: BotTransport.Mock })
    const verified = await service.connections.verify(scope, saved.id, 'http://localhost:3000')

    expect([verified.status, verified.receive]).toEqual([BotConnectionStatus.Connected, BotReceiveMode.Poll])
    expect(verified.identity?.username).toMatch(/^mock_[A-Za-z0-9]+_bot$/)
    expect(verified.hookUrl).toBe(`http://localhost:3000/api/bot/hook/telegram/${saved.id}`)
    expect(verified.setup?.length).toBeGreaterThan(0)
    expect(telegramBotPlatform.mock.calls(saved.id).map(call => call.method)).toEqual(['getMe'])
  })

  test('a public HTTPS origin registers the webhook with the connection\'s secret token; removing unregisters it', async () => {
    const { service, connections } = makeTestBot()
    const scope = scopeOf()
    const saved = await service.connections.save(scope, { ...telegram, transport: BotTransport.Mock }, ORIGIN)

    const verified = await service.connections.verify(scope, saved.id, ORIGIN)
    const hookSecret = (await connections.get(saved.id)).hookSecret
    const setWebhook = telegramBotPlatform.mock.calls(saved.id).find(call => call.method === 'setWebhook')

    expect(verified.receive).toBe(BotReceiveMode.Webhook)
    expect(setWebhook?.params).toEqual({
      url: `${ORIGIN}/api/bot/hook/telegram/${saved.id}`, secret_token: hookSecret,
      allowed_updates: ['message', 'edited_message', 'channel_post'],
    })
    await service.connections.remove(scope, saved.id)
    expect(telegramBotPlatform.mock.calls(saved.id).at(-1)?.method).toBe('deleteWebhook')
  })

  test('a delivery without the secret token is rejected; a signed one is stored once', async () => {
    const bot = makeTestBot()
    const scope = scopeOf()
    const connection = await connect(bot, scope)
    const record = await bot.connections.get(connection.id)
    const inbound = botMockHelper.inbound('telegram', { text: 'twice' }, record)
    const { [TELEGRAM_SECRET_HEADER]: _dropped, ...unsigned } = inbound.headers

    await expect(bot.service.receive('telegram', record.id!, { method: 'POST', headers: unsigned, body: inbound.body }))
      .rejects.toThrow('bot:signature-rejected')
    const request = { method: 'POST', headers: inbound.headers, body: inbound.body, rawBody: inbound.rawBody }
    const first = await bot.service.receive('telegram', record.id!, request)
    expect((await bot.service.receive('telegram', record.id!, request)).updates).toEqual(first.updates)
    expect(await bot.updates.count({ connection: record.id })).toBe(1)
  })
})

describe('@owlmeans/bot-telegram — actions and the receiver', () => {
  test('a handler deletes and replies with the Bot API\'s parameters', async () => {
    const bot = makeTestBot()
    const scope = scopeOf()
    const connection = await connect(bot, scope)
    const seen: BotUpdate[] = []
    const runtime = bot.service.runtime([botHandler('moderate', async (update, actions) => {
      seen.push(update)
      if (botTextHelper.matched(update.message?.text ?? '', ['casino']).length > 0) {
        await actions.delete(update)
        await actions.reply(update, 'Removed.')
      }
    })])
    runtimes.push(runtime)
    await bot.service.simulate(scope, connection.id, { text: 'Best CASINO in town' })
    await runtime.dispatch()

    const [message] = seen
    const calls = telegramBotPlatform.mock.calls(connection.id)
    expect(calls.find(call => call.method === 'deleteMessage')?.params).toEqual({
      chat_id: Number(message.chat.id), message_id: Number(message.message!.ref.id),
    })
    expect(calls.find(call => call.method === 'sendMessage')?.params).toMatchObject({
      chat_id: Number(message.chat.id), reply_parameters: { message_id: Number(message.message!.ref.id), allow_sending_without_reply: true },
    })
  })

  test('mute, ban and react reach the platform with Telegram\'s parameters', async () => {
    const bot = makeTestBot()
    const scope = scopeOf()
    const connection = await connect(bot, scope)
    const runtime = bot.service.runtime([botHandler('punish', async (update, actions) => {
      await actions.mute(update, { minutes: 60 })
      await actions.ban({ chat: update.chat, user: update.sender!.id })
      await actions.react(update, '👎')
    })])
    runtimes.push(runtime)
    const before = Math.floor(Date.now() / 1000)
    await bot.service.simulate(scope, connection.id, { text: 'rude' })
    await runtime.dispatch()

    const calls = telegramBotPlatform.mock.calls(connection.id)
    const restrict = calls.find(call => call.method === 'restrictChatMember')!.params
    expect(restrict).toMatchObject({ user_id: 424242001, use_independent_chat_permissions: true, permissions: { can_send_messages: false } })
    expect(Number(restrict.until_date) - before).toBeGreaterThanOrEqual(3600)
    expect(calls.find(call => call.method === 'banChatMember')!.params).toMatchObject({ user_id: 424242001 })
    expect(calls.find(call => call.method === 'setMessageReaction')!.params).toMatchObject({ reaction: [{ type: 'emoji', emoji: '👎' }] })
    expect((await bot.service.activity.list(scope)).map(entry => entry.action)).toEqual(
      [BotActionKind.React, BotActionKind.Ban, BotActionKind.Mute]
    )
  })

  test('the Bot API\'s refusal answers one sentence naming Telegram; the marker stays in `code`', async () => {
    const bot = makeTestBot({
      fetch: async url => new Response(JSON.stringify(url.endsWith('/deleteMessage')
        ? { ok: false, error_code: 400, description: 'Bad Request: message to delete not found' }
        : { ok: true, result: true })),
    })
    const scope = scopeOf()
    const live = await bot.service.connections.save(scope, { ...telegram, credentials: { token: '1:x' } })
    const actions = await bot.service.actions({ scope, connection: live.id })

    expect(await actions.delete({ chat: '-100', id: '7' })).toEqual({
      ok: false,
      error: 'Telegram refused: Bad Request: message to delete not found.',
      code: 'bot:platform:telegram:400:Bad Request: message to delete not found',
    })
  })

  test('a poll connection\'s receiver drops the webhook, long-polls and drains the mock feed; stop() aborts it', async () => {
    const bot = makeTestBot()
    const scope = scopeOf()
    const connection = await connect(bot, scope)
    const record = await bot.connections.get(connection.id)
    const seen: string[] = []
    const runtime = bot.service.runtime([botHandler('echo', async update => { seen.push(update.message?.text ?? '') })])
    runtimes.push(runtime)
    await runtime.start()

    botMockHelper.feed('telegram', record, { text: 'via polling', chat: { kind: BotChatKind.Private } })
    await until(async () => seen.includes('via polling'))
    const methods = telegramBotPlatform.mock.calls(connection.id).map(call => call.method)
    expect(methods).toContain('deleteWebhook')
    expect(methods).toContain('getUpdates')
    expect((await bot.updates.list({ connection: connection.id })).items.map(row => row.status)).toEqual([BotInboxStatus.Done])

    await runtime.stop()
    const callsAfterStop = telegramBotPlatform.mock.calls(connection.id).length
    await sleep(50)
    expect(telegramBotPlatform.mock.calls(connection.id).length).toBe(callsAfterStop)
  })

  test('getUpdates answering 401 is fatal (the connection fails); an unreachable API is recoverable', async () => {
    let polling: 'revoked' | 'down' = 'revoked'
    const fetch: BotFetch = async url => {
      const method = url.split('/').pop() ?? ''
      if (method === 'getMe') {
        return Response.json({ ok: true, result: { id: 42, is_bot: true, first_name: 'Guard', username: 'guard_bot' } })
      }
      if (method !== 'getUpdates') {
        return Response.json({ ok: true, result: true })
      }
      if (polling === 'down') {
        throw new TypeError('fetch failed')
      }
      return Response.json({ ok: false, error_code: 401, description: 'Unauthorized' }, { status: 401 })
    }
    const bot = makeTestBot({ fetch })
    const scope = scopeOf()
    const saved = await bot.service.connections.save(scope, { ...telegram, credentials: { token: '42:AA' } })
    await bot.service.connections.verify(scope, saved.id)
    const runtime = bot.service.runtime([])
    runtimes.push(runtime)

    await runtime.reconcile()
    await until(async () => (await bot.connections.get(saved.id)).status === BotConnectionStatus.Failed)
    expect((await bot.connections.get(saved.id)).lastError).toBe('receiver:bot:platform:telegram:401:Unauthorized')

    polling = 'down'
    await bot.service.connections.verify(scope, saved.id)
    await runtime.reconcile()
    await until(async () => (await bot.connections.get(saved.id)).lastError != null)
    const record = await bot.connections.get(saved.id)
    expect([record.status, record.lastError]).toEqual([BotConnectionStatus.Connected, 'receiver:bot:platform:telegram:503:getUpdates: unreachable'])
  })
})
