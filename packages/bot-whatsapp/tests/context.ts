import { randomUUID } from 'node:crypto'
import { AppType, makeBasicContext, type BasicConfig, type BasicContext } from '@owlmeans/context'
import { configureLog } from '@owlmeans/log'
import type { Resource } from '@owlmeans/resource'
import {
  appendBot, RES_BOT_ACTIVITY, RES_BOT_CONNECTION, RES_BOT_UPDATE, type BotActivityRecord, type BotConnectionRecord,
  type BotService, type BotServiceOptions, type BotUpdateRecord,
} from '@owlmeans/server-bot'
import { makeBotMockHelper } from '@owlmeans/server-bot/mock'
import { createStaticResource } from '@owlmeans/static-resource'
import { whatsappBotPlatform } from '../src/plugin.js'

export const SECRET = 'bot-whatsapp-tests-secret'

// Refusals and handler failures are expected here; `LOG_LEVEL=debug bun test` shows every line.
configureLog({ level: process.env.LOG_LEVEL ?? 'error' })

/** Native, signed payloads of the ready plugin instance — the one every `makeTestBot()` registers. */
export const botMockHelper = makeBotMockHelper([whatsappBotPlatform])

export interface TestBot {
  /** The store key: another `makeTestBot(options, store)` reads and writes the same rows (a restart). */
  store: string
  context: BasicContext<BasicConfig>
  service: BotService
  connections: Resource<BotConnectionRecord>
  updates: Resource<BotUpdateRecord>
  activities: Resource<BotActivityRecord>
}

let stores = 0

/**
 * One real context per test: the three resources as `@owlmeans/static-resource` stores (a fresh key
 * each time, unless `store` names an earlier bot's — that bot's process restarted), then `appendBot`
 * with this package's ready plugin instance (unless `options.platforms` names others). A fast
 * dispatcher; the secret is a fixture.
 */
export const makeTestBot = (options: BotServiceOptions = {}, store?: string): TestBot => {
  const key = store ?? `bot-whatsapp-tests-${++stores}`
  const context = makeBasicContext<BasicConfig>({ ready: false, service: 'bot-whatsapp-tests', type: AppType.Backend, services: {} })
  const connections = createStaticResource<BotConnectionRecord>(RES_BOT_CONNECTION, `${key}-connection`)
  const updates = createStaticResource<BotUpdateRecord>(RES_BOT_UPDATE, `${key}-update`)
  const activities = createStaticResource<BotActivityRecord>(RES_BOT_ACTIVITY, `${key}-activity`)
  context.registerResource(connections)
  context.registerResource(updates)
  context.registerResource(activities)
  const service = appendBot(context, {
    secret: () => SECRET, pollMs: 5, reconcileMs: 20, ...options, platforms: options.platforms ?? [whatsappBotPlatform],
  })

  return { store: key, context, service, connections, updates, activities }
}

export const scopeOf = (): string => `scope-${randomUUID()}`

/** A response the bound handler resolves or rejects — the smallest the transport needs. */
export const invoke = async (entrypoint: object, request: Record<string, unknown>): Promise<any> => {
  const response: any = {
    resolve: (value: unknown) => { response.value = value },
    reject: (error: Error) => { response.error = error },
  }
  await (entrypoint as { handle: (req: unknown, res: unknown) => Promise<unknown> }).handle({
    alias: 'test', headers: {}, params: {}, query: {}, body: {}, path: '/', ...request,
  }, response)
  if (response.error != null) {
    throw response.error
  }

  return response.value
}

export const sleep = async (ms: number): Promise<void> => { await new Promise(resolve => setTimeout(resolve, ms)) }

/** Poll until `probe` holds (or fail after `timeoutMs`). */
export const until = async (probe: () => Promise<boolean>, timeoutMs: number = 3_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await probe()) {
      return
    }
    await sleep(10)
  }
  throw new Error('condition not reached')
}
