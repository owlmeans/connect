import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { CONSENT_MARKETING, consentStore } from '@owlmeans/consent'
import { addLogPlugin, logger, resetLog } from '@owlmeans/log'
import { gtmAnalyticsPlugin } from '../src/index.js'

const win = globalThis as unknown as { window?: { dataLayer?: unknown[] } }

let granted: string[] = []
const original = consentStore.granted
const hadWindow = 'window' in globalThis
const previous = (globalThis as any).window

beforeEach(() => {
  resetLog()
  win.window = {}
  granted = []
  consentStore.granted = key => granted.includes(key)
})

afterEach(() => {
  consentStore.granted = original
  if (hadWindow) (globalThis as any).window = previous
  else delete win.window
  resetLog()
})

describe('gtmAnalyticsPlugin', () => {
  test('drops an event while analytics consent is missing — it is never queued', () => {
    addLogPlugin(gtmAnalyticsPlugin())
    logger('ui').info('x', { a: 1 }, { analytics: 'page_view' })
    expect(win.window?.dataLayer).toBeUndefined()
    granted = ['analytics']
    expect(win.window?.dataLayer).toBeUndefined()
  })

  test('pushes {event, ...data} to the dataLayer once consent is granted', () => {
    granted = ['analytics']
    addLogPlugin(gtmAnalyticsPlugin())
    logger('ui').info('x', { plan: 'pro' }, { analytics: 'subscription.started' })
    expect(win.window?.dataLayer).toEqual([{ event: 'subscription.started', plan: 'pro' }])
  })

  test('ignores plain console calls', () => {
    granted = ['analytics']
    addLogPlugin(gtmAnalyticsPlugin())
    logger('ui').info('just a line')
    expect(win.window?.dataLayer).toBeUndefined()
  })

  test('the allow-list and the category reach the gate', () => {
    granted = ['analytics']
    addLogPlugin(gtmAnalyticsPlugin({ name: 'gtm-ads', category: CONSENT_MARKETING, allow: ['purchase'] }))
    logger('ui').info('x', undefined, { analytics: 'purchase' })
    expect(win.window?.dataLayer).toBeUndefined()
    granted = ['analytics', CONSENT_MARKETING]
    logger('ui').info('x', undefined, { analytics: 'page_view' })
    logger('ui').info('x', undefined, { analytics: 'purchase' })
    expect(win.window?.dataLayer).toEqual([{ event: 'purchase' }])
  })

  test('is named gtm: a second default one replaces the first', () => {
    granted = ['analytics']
    addLogPlugin(gtmAnalyticsPlugin({ allow: ['a'] }))
    addLogPlugin(gtmAnalyticsPlugin({ allow: ['b'] }))
    logger('ui').info('x', undefined, { analytics: 'a' })
    logger('ui').info('x', undefined, { analytics: 'b' })
    expect(win.window?.dataLayer).toEqual([{ event: 'b' }])
  })

  test('outside a browser it does nothing', () => {
    granted = ['analytics']
    delete win.window
    addLogPlugin(gtmAnalyticsPlugin())
    expect(() => logger('ui').info('x', undefined, { analytics: 'e' })).not.toThrow()
  })
})
