import { afterAll, beforeAll, describe, expect, setSystemTime, test } from 'bun:test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import Stripe from 'stripe'
import { CancellationKind, PlanDuration, ProductType, TaxBehavior } from '@owlmeans/payment'
import { bind } from '@owlmeans/server-entrypoint'
import {
  declarePaymentPlan, declarePaymentProduct, paymentAccessOf, paymentGate, paymentGateHandlers, webhookOf,
} from '@owlmeans/server-payment'
import type { CheckoutPlugin, CheckoutSettled, Config } from '@owlmeans/server-payment'
import {
  ALL_ON, ENTITY, epoch, fixedMeter, FX, invoiceOf, makeRightsContext, paidSession, requestStart, rightsOf,
  TEXT_VERSION,
} from './consumer-fixtures.js'
import {
  CREDIT_UNIT, CREDITS_PRODUCT, declareTestCatalogue, future, makeFakeContext, past, PLANS_PRODUCT, PRO, SERVICE,
  subscriptionOf, TEAM,
} from './fake-stripe.js'
import type { FakeContext } from './fake-stripe.js'

/**
 * Golden records of the paygate behaviour — recorded once on the code before the provider split and
 * replayed after it. Every SDK call (method, arguments, request options), every observer payload and
 * every stored row of each scenario is compared against `golden/<scenario>.json`, so a byte of a call
 * parameter, an event key, a purchase id, the webhook URL or a fingerprint that moved fails here.
 *
 * `GOLDEN_UPDATE=1 bun test ./tests/golden.spec.ts` rewrites the records — only ever on purpose.
 */

type Rec = Record<string, any>

const NOW = new Date('2026-11-02T10:00:00.000Z')
const PINNED = '2025-02-24.acacia'
const SECRET = 'whsec_golden'
const SUCCESS = 'https://app.example.com/billing/ok'
const CANCEL = 'https://app.example.com/billing/cancel'
const MANAGED = { manage: true, bootstrap: false }
const SEATS_PRODUCT = 'app-seats'
const SEAT = 'seat-pack'
const PRO_YEARLY = 'pro-yearly'
const PORTAL = { returnUrl: 'https://app.example.com/billing', headline: 'Example', termsOfServiceUrl: 'https://legal.example.com/terms' }

const PRICING = {
  tax: { automatic: true, behavior: TaxBehavior.Exclusive, collectTaxId: true, estimate: true },
  currency: { adaptive: true, adaptiveFeeRate: 0.04, estimate: true },
  stripe: {
    amountPromotionCodes: true, settlementCurrency: 'eur', subscriptionPaymentMethodTypes: ['card', 'link', 'klarna'],
    subscriptionPaymentMethodTypesByCurrency: { usd: ['card', 'link'] }, lockCustomerEmail: true, lockCustomerCountry: true,
  },
}

const PRO_PRICE = {
  id: 'price_pro', product: PLANS_PRODUCT, lookup_key: PRO, active: true, recurring: { interval: 'month' },
  currency: 'eur', unit_amount: 1_800, tax_behavior: 'exclusive',
  currency_options: { eur: { unit_amount: 1_800 }, usd: { unit_amount: 2_000, tax_behavior: 'exclusive' } },
}
const PRO_USD_PRICE = {
  id: 'price_pro_usd', product: PLANS_PRODUCT, lookup_key: PRO, active: true, recurring: { interval: 'month' },
  currency: 'usd', unit_amount: 2_000,
}
const TEAM_PRICE = {
  id: 'price_team', product: PLANS_PRODUCT, lookup_key: TEAM, active: true, recurring: { interval: 'month' },
  currency: 'eur', unit_amount: 4_500,
}
const SEAT_PRICE = {
  id: 'price_seats', product: SEATS_PRODUCT, lookup_key: `${SEATS_PRODUCT}-consumable`, active: true,
  currency: 'usd', unit_amount: 500,
}

const declareGolden = (cfg: Config): void => {
  declareTestCatalogue(cfg, {
    plans: [{
      productSku: PLANS_PRODUCT, sku: PRO_YEARLY, duration: PlanDuration.Yearly, rank: 15, price: 200,
      recurring: { interval: 'year' }, currencyPrices: { eur: 180, usd: 200 },
    }],
  })
  declarePaymentProduct(cfg, {
    sku: SEATS_PRODUCT, type: ProductType.Consumable, services: [SERVICE], name: 'Seats', unitLabel: 'seat',
    taxCode: 'txcd_10103001',
  })
  declarePaymentPlan(cfg, {
    productSku: SEATS_PRODUCT, sku: SEAT, duration: PlanDuration.Consumable, price: 5,
    quantityPolicy: { minimum: 1, maximum: 50, default: 5 },
  })
}

// -----------------------------------------------------------------------------------------------
// Recording
// -----------------------------------------------------------------------------------------------

const GOLDEN_DIR = join(import.meta.dir, 'golden')

const normalize = (value: unknown): unknown => JSON.parse(JSON.stringify(value ?? null, (_key, entry) =>
  typeof entry === 'string' ? entry.replace(/CR-\d{6}-[2-9A-Z]{6}/g, 'CR-<ref>') : entry))

const golden = (name: string, value: unknown): void => {
  const file = join(GOLDEN_DIR, `${name}.json`)
  const actual = normalize(value)
  if (process.env.GOLDEN_UPDATE === '1') {
    mkdirSync(GOLDEN_DIR, { recursive: true })
    writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`)
    return
  }
  expect(actual).toEqual(JSON.parse(readFileSync(file, 'utf8')))
}

/** Wrap every SDK method of the fake in place: each call is logged with its arguments and request options. */
const recordCalls = (stripe: unknown): Rec[] => {
  const calls: Rec[] = []
  const walk = (target: Rec, path: string[]): void => {
    for (const key of Object.keys(target)) {
      const value = target[key]
      if (typeof value === 'function') {
        if (key === 'getApiField') continue
        target[key] = async (...args: unknown[]) => {
          const trimmed = [...args]
          while (trimmed.length > 0 && trimmed[trimmed.length - 1] === undefined) trimmed.pop()
          calls.push({ call: [...path, key].join('.'), args: JSON.parse(JSON.stringify(trimmed)) })
          return await value(...args)
        }
      } else if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        walk(value, [...path, key])
      }
    }
  }
  walk(stripe as Rec, [])
  return calls
}

const rows = (fake: FakeContext, alias: string): Rec[] => fake.stores[alias].rows

const runEntrypoint = async (fake: FakeContext, entrypoint: any, req: Rec): Promise<{ value?: unknown, error?: string }> => {
  fake.ctx.registerEntrypoint(entrypoint)
  const res: any = { resolve: (value: unknown) => { res.value = value }, reject: (error: Error) => { res.error = error } }
  await entrypoint.handle({ headers: {}, query: {}, params: {}, body: {}, path: '/', alias: entrypoint.alias, ...req }, res)
  return { value: res.value, ...(res.error != null ? { error: `${res.error.constructor.name}:${res.error.message}` } : {}) }
}

/** A signed delivery through the webhook route, the way the paygate posts it. */
const deliver = async (fake: FakeContext, type: string, object: unknown, id: string): Promise<string | undefined> => {
  const event = { id, object: 'event', type, created: epoch(new Date()), data: { object } }
  const outcome = await runEntrypoint(fake, bind(paymentGate.webhook, paymentGateHandlers.webhook), {
    params: { paygate: 'stripe' }, headers: { 'stripe-signature': `sig:${SECRET}` }, rawBody: JSON.stringify(event),
  })
  return outcome.error
}

const resync = async (fake: FakeContext): Promise<unknown> =>
  await runEntrypoint(fake, bind(paymentGate.resync, paymentGateHandlers.resync), {})

const gateway = (fake: FakeContext) => paymentAccessOf(fake.ctx).gateway()
const rights = (fake: FakeContext) => paymentAccessOf(fake.ctx).consumerRights()

const startFor = async (fake: FakeContext, entityId: string, planSku: string = PRO): Promise<string> =>
  (await rights(fake).recordStartRequest(
    { entityId, email: 'owner@shop.eu', name: 'Anna' },
    { planSku, textVersion: TEXT_VERSION, language: 'en', acknowledged: true },
    { ip: '203.0.113.7' }, { plan: 'Pro' },
  )).startRequestId

const TERMS_URL_MESSAGE = 'You cannot collect consent to your terms of service unless a URL is set in the Stripe '
  + 'Dashboard. Update your public business details at https://dashboard.stripe.com/settings/public to set the URL '
  + 'for your terms of service.'

beforeAll(() => { setSystemTime(NOW) })
afterAll(() => { setSystemTime() })

// -----------------------------------------------------------------------------------------------
// Scenarios
// -----------------------------------------------------------------------------------------------

describe('golden — paygate behaviour', () => {
  test('bootstrap: products and prices, the portal configuration, the webhook endpoint — twice', async () => {
    const fake = await makeFakeContext({
      declare: declareGolden, pricing: PRICING, consumerRights: rightsOf(), portal: PORTAL, gateway: MANAGED,
      stripe: { fxRates: FX, apiVersion: PINNED },
    })
    const calls = recordCalls(fake.stripe)
    const first = await resync(fake)
    const firstCalls = calls.splice(0)
    const second = await resync(fake)

    golden('bootstrap', {
      webhookUrl: webhookOf(fake.ctx).webhookUrlOf('stripe'),
      first, firstCalls, second, secondCalls: calls,
      fingerprints: rows(fake, 'payment-fingerprint'),
      webhooks: rows(fake, 'payment-webhook'),
    })
  })

  test('checkout without a consumer-rights policy: amount, quantity and subscription sessions', async () => {
    const fake = await makeFakeContext({
      declare: declareGolden, gateway: MANAGED, stripe: { prices: [PRO_USD_PRICE, SEAT_PRICE], apiVersion: PINNED },
    })
    const calls = recordCalls(fake.stripe)
    const urls = [
      await gateway(fake).createLink(fake.ctx, {
        productSku: CREDITS_PRODUCT, entityId: ENTITY, service: SERVICE, amountMinor: 1_000, locale: 'de',
        submitText: 'Top up the balance', successUrl: SUCCESS, cancelUrl: CANCEL,
      }),
      await gateway(fake).createLink(fake.ctx, {
        productSku: SEATS_PRODUCT, entityId: ENTITY, service: SERVICE, successUrl: SUCCESS,
        submitText: context => `${context.currency}:${context.unitAmountMinor ?? ''}:${context.language}`,
      }),
      await gateway(fake).createLink(fake.ctx, {
        productSku: PLANS_PRODUCT, planSku: PRO, entityId: ENTITY, profileId: 'profile-1', service: SERVICE,
        locale: 'en', successUrl: SUCCESS,
      }),
    ]

    golden('checkout-plain', { urls, calls, customers: rows(fake, 'payment-paygate-customer') })
  })

  test('checkout under a consumer-rights policy: pinned customer, FX, terms, start request, plugins', async () => {
    const fake = await makeRightsContext({
      declare: declareGolden, pricing: PRICING, gateway: MANAGED,
      consumerRights: rightsOf({ mechanisms: { ...ALL_ON, checkoutTerms: true } }),
      stripe: { prices: [PRO_PRICE, SEAT_PRICE], apiVersion: PINNED },
    })
    const admitted: Rec[] = []
    const created: Rec[] = []
    const plugin: CheckoutPlugin = {
      alias: 'hold', sessionTtlSeconds: 3_600,
      admit: async (_ctx, attempt) => { admitted.push(attempt); return { reservationId: `r-${admitted.length}` } },
      created: async (_ctx, session) => { created.push(session) },
    }
    gateway(fake).use(plugin)
    const startRequestId = await requestStart(fake)
    const usStart = await startFor(fake, 'entity-us')
    const calls = recordCalls(fake.stripe)
    const urls = [
      await gateway(fake).createLink(fake.ctx, {
        productSku: CREDITS_PRODUCT, entityId: ENTITY, service: SERVICE, amountMinor: 1_000, country: 'pl', ipCountry: 'pl',
        email: 'owner@shop.eu', locale: 'pl', successUrl: SUCCESS,
      }),
      await gateway(fake).createLink(fake.ctx, {
        productSku: PLANS_PRODUCT, planSku: PRO, entityId: ENTITY, service: SERVICE, country: 'PL', startRequestId,
        email: 'Owner@Shop.eu', successUrl: SUCCESS, cancelUrl: CANCEL,
      }),
      await gateway(fake).createLink(fake.ctx, {
        productSku: PLANS_PRODUCT, planSku: PRO, entityId: 'entity-us', service: SERVICE, country: 'US',
        startRequestId: usStart, email: 'buyer@shop.us', consumerLanguage: 'en', successUrl: SUCCESS,
      }),
      await gateway(fake).createLink(fake.ctx, {
        productSku: SEATS_PRODUCT, entityId: ENTITY, service: SERVICE, country: 'PL', email: 'owner@shop.eu',
        successUrl: SUCCESS,
      }),
    ]

    golden('checkout-consumer', {
      urls, calls, admitted, created, customers: rows(fake, 'payment-paygate-customer'),
    })
  })

  test('checkout fallbacks: a Dashboard without a terms URL, and a plugin refusing the created session', async () => {
    const fake = await makeRightsContext({
      declare: declareGolden, pricing: PRICING, gateway: MANAGED,
      consumerRights: rightsOf({ mechanisms: { ...ALL_ON, checkoutTerms: true } }),
      stripe: { prices: [PRO_PRICE, SEAT_PRICE], apiVersion: PINNED },
    })
    const settled: CheckoutSettled[] = []
    gateway(fake).use({ alias: 'hold', admit: async () => ({ reservationId: 'r-hold' }), settled: async (_ctx, done) => { settled.push(done) } })
    const calls = recordCalls(fake.stripe)
    fake.state.failures['checkout.sessions.create'] = new Stripe.errors.StripeInvalidRequestError({
      type: 'invalid_request_error', message: TERMS_URL_MESSAGE, param: 'consent_collection[terms_of_service]', statusCode: 400,
    })
    const fallback = await gateway(fake).createLink(fake.ctx, {
      productSku: CREDITS_PRODUCT, entityId: ENTITY, service: SERVICE, amountMinor: 2_000, country: 'DE',
      email: 'owner@shop.eu', successUrl: SUCCESS,
    })
    gateway(fake).use({ alias: 'veto', created: async () => { throw new Error('vetoed after creation') } })
    const refused = await gateway(fake).createLink(fake.ctx, {
      productSku: CREDITS_PRODUCT, entityId: ENTITY, service: SERVICE, amountMinor: 1_500, country: 'DE',
      email: 'owner@shop.eu', successUrl: SUCCESS,
    }).catch((error: Error) => error.message)

    golden('checkout-fallbacks', {
      fallback, refused, calls, settled, events: rows(fake, 'payment-consumer-event'),
    })
  })

  test('portal: configuration on first use, then every flow', async () => {
    const fake = await makeFakeContext({
      declare: declareGolden, pricing: PRICING, consumerRights: rightsOf(), portal: PORTAL, gateway: MANAGED,
      stripe: {
        apiVersion: PINNED, prices: [PRO_PRICE, TEAM_PRICE],
        customers: { cus_portal: { id: 'cus_portal', object: 'customer', address: { country: 'PL' } } },
      },
      seed: {
        'payment-paygate-customer': [{ id: 'seed-customer', paygate: 'stripe', externalId: 'cus_portal', entityId: ENTITY }],
        'payment-subscription': [{
          id: 'seed-subscription', entityId: ENTITY, planSku: PRO, productSku: PLANS_PRODUCT, service: SERVICE,
          paygate: 'stripe', externalId: 'sub_portal', itemId: 'si_portal', status: 'active', rank: 10, createdAt: past(5),
        }],
      },
    })
    const calls = recordCalls(fake.stripe)
    const returnUrl = 'https://app.example.com/billing/back'
    const links: Rec = {}
    for (const flow of ['manage', 'payment-method', 'cancel', 'update', 'change']) {
      links[flow] = await gateway(fake).portalLink(fake.ctx, ENTITY, {
        flow: flow as never, returnUrl, ...(flow === 'change' ? { planSku: TEAM } : {}),
      }).catch((error: Error) => `${error.constructor.name}:${error.message}`)
    }

    golden('portal', { links, calls, fingerprints: rows(fake, 'payment-fingerprint') })
  })

  test('webhook deliveries: customers, checkouts, subscriptions, invoices, refunds, disputes', async () => {
    const fake = await makeRightsContext({
      declare: declareGolden, pricing: PRICING, gateway: MANAGED, webhookSecret: SECRET,
      stripe: {
        apiVersion: PINNED,
        invoices: {
          in_pl: invoiceOf('in_pl', { charge: 'ch_pl' }),
          in_sub: invoiceOf('in_sub', {
            subtotal: 1_800, tax: 414, total: 2_214, payment_intent: 'pi_sub', subscription: 'sub_1',
            lines: { object: 'list', data: [{ id: 'il_sub', amount: 1_800 }] },
          }),
        },
        charges: {
          ch_pl: { id: 'ch_pl', payment_intent: 'pi_pl', invoice: 'in_pl', amount: 1_130, amount_refunded: 600 },
          ch_sub: { id: 'ch_sub', payment_intent: 'pi_sub', invoice: 'in_sub', amount: 2_214, amount_refunded: 0 },
        },
        refunds: [{ id: 're_1', object: 'refund', charge: 'ch_pl', payment_intent: 'pi_pl', amount: 500, currency: 'eur', status: 'succeeded', metadata: {} }],
      },
    })
    const settled: CheckoutSettled[] = []
    gateway(fake).use({ alias: 'listen', settled: async (_ctx, done) => { settled.push(done) } })
    const startRequestId = await requestStart(fake)
    const subscription = subscriptionOf({
      id: 'sub_1', customer: 'cus_1', planSku: PRO, latestInvoice: 'in_sub', periodStart: past(1), periodEnd: future(29),
    }) as unknown as Rec
    subscription.currency = 'eur'
    subscription.items.data[0].price.unit_amount = 1_800
    subscription.items.data[0].quantity = 1
    subscription.metadata = {
      entityId: ENTITY, planSku: PRO, productSku: PLANS_PRODUCT, service: SERVICE, startRequestId, country: 'PL',
      language: 'pl', termsVersion: TEXT_VERSION, ipCountry: 'PL',
    }
    fake.state.subscriptions.sub_1 = subscription as never
    const calls = recordCalls(fake.stripe)
    const errors: Rec = {}
    const send = async (type: string, object: unknown, id: string) => {
      const error = await deliver(fake, type, object, id)
      if (error != null) errors[id] = error
    }

    await send('customer.created', {
      id: 'cus_1', object: 'customer', email: 'buyer@shop.eu', name: 'Jan Kowalski', address: { country: 'pl' },
      currency: 'EUR', metadata: { entityId: ENTITY, profileId: 'profile-1' }, tax_ids: { data: [{ value: 'PL1234567890' }] },
    }, 'evt_customer')
    await send('checkout.session.completed', paidSession(), 'evt_paid')
    await send('checkout.session.completed', paidSession(), 'evt_paid')
    await send('customer.subscription.created', subscription, 'evt_sub_created')
    await send('checkout.session.completed', {
      id: 'cs_sub', object: 'checkout.session', mode: 'subscription', payment_status: 'paid', status: 'complete',
      customer: 'cus_1', subscription: 'sub_1', invoice: 'in_sub', currency: 'eur', amount_subtotal: 1_800,
      amount_total: 2_214, total_details: { amount_tax: 414 },
      customer_details: { address: { country: 'PL' }, email: 'buyer@shop.eu', name: 'Jan Kowalski', tax_ids: [], tax_exempt: 'none' },
      consent: { terms_of_service: 'accepted' }, created: epoch(new Date()),
      metadata: {
        entityId: ENTITY, service: SERVICE, productSku: PLANS_PRODUCT, planSku: PRO, pricingMode: 'quantity', country: 'PL',
        language: 'pl', termsVersion: TEXT_VERSION, startRequestId,
      },
    }, 'evt_sub_checkout')
    await send('invoice.paid', { id: 'in_cycle', object: 'invoice', billing_reason: 'subscription_cycle', subscription: 'sub_1', customer: 'cus_1' }, 'evt_renewal')
    await send('invoice.paid', { id: 'in_manual', object: 'invoice', billing_reason: 'manual', subscription: 'sub_1', customer: 'cus_1' }, 'evt_invoice_manual')
    await send('invoice.payment_failed', {
      id: 'in_fail', object: 'invoice', subscription: 'sub_1', customer: 'cus_1', attempt_count: 2,
      next_payment_attempt: epoch(future(3)),
    }, 'evt_invoice_failed')
    await send('invoice.payment_action_required', {
      id: 'in_action', object: 'invoice', subscription: 'sub_1', customer: 'cus_1', attempt_count: 1,
    }, 'evt_invoice_action')
    fake.state.subscriptions.sub_1.cancel_at_period_end = true
    await send('customer.subscription.updated', fake.state.subscriptions.sub_1, 'evt_sub_cancel_scheduled')
    await send('charge.refunded', { id: 'ch_pl', object: 'charge', payment_intent: 'pi_pl', invoice: 'in_pl', amount: 1_130, amount_refunded: 500 }, 'evt_charge_refunded')
    await send('refund.updated', {
      id: 're_w', object: 'refund', charge: 'ch_pl', payment_intent: 'pi_pl', amount: 100, currency: 'eur',
      status: 'succeeded', metadata: { withdrawalId: 'w-1', owlmeans: 'payment' },
    }, 'evt_refund_updated')
    await send('refund.failed', { id: 're_f', object: 'refund', status: 'failed', amount: 100 }, 'evt_refund_failed')
    await send('charge.dispute.created', { id: 'dp_1', object: 'dispute', charge: 'ch_sub', payment_intent: 'pi_sub', amount: 2_214, currency: 'eur', status: 'needs_response' }, 'evt_dispute_opened')
    await send('charge.dispute.closed', { id: 'dp_1', object: 'dispute', charge: 'ch_sub', payment_intent: 'pi_sub', amount: 2_214, currency: 'eur', status: 'won' }, 'evt_dispute_closed')
    await send('checkout.session.async_payment_failed', {
      id: 'cs_fail', object: 'checkout.session', mode: 'payment', customer: 'cus_1', payment_intent: 'pi_fail',
      metadata: { entityId: ENTITY, service: SERVICE, productSku: CREDITS_PRODUCT, planSku: CREDIT_UNIT, pricingMode: 'amount', amountMinor: '2000' },
    }, 'evt_async_failed')
    await send('checkout.session.expired', {
      id: 'cs_exp', object: 'checkout.session', mode: 'payment', customer: 'cus_1',
      metadata: { entityId: ENTITY, service: SERVICE, productSku: CREDITS_PRODUCT, planSku: CREDIT_UNIT, amountMinor: '500' },
    }, 'evt_expired')
    await send('invoice.voided', { id: 'in_void', object: 'invoice', subscription: 'sub_1', customer: 'cus_1' }, 'evt_voided')
    await send('invoice.upcoming', { object: 'invoice', subscription: 'sub_1', customer: 'cus_1' }, 'evt_upcoming')
    await send('product.created', { id: 'prod_x', object: 'product' }, 'evt_ignored')
    fake.state.subscriptions.sub_1.status = 'canceled'
    fake.state.subscriptions.sub_1.ended_at = epoch(new Date())
    await send('customer.subscription.deleted', fake.state.subscriptions.sub_1, 'evt_sub_deleted')
    await send('customer.deleted', { id: 'cus_1', object: 'customer', deleted: true }, 'evt_customer_deleted')
    const unknownPaygate = await runEntrypoint(fake, bind(paymentGate.webhook, paymentGateHandlers.webhook), {
      params: { paygate: 'paypal' }, headers: {}, rawBody: '{}',
    })
    const badSignature = await runEntrypoint(fake, bind(paymentGate.webhook, paymentGateHandlers.webhook), {
      params: { paygate: 'stripe' }, headers: { 'stripe-signature': 'sig:other' }, rawBody: '{}',
    })

    golden('webhook-events', {
      errors, unknownPaygate, badSignature, calls, settled,
      observed: { ...fake.observed },
      purchases: rows(fake, 'payment-purchase'),
      fulfillments: rows(fake, 'payment-fulfillment'),
      subscriptions: rows(fake, 'payment-subscription'),
      customers: rows(fake, 'payment-paygate-customer'),
      profiles: rows(fake, 'payment-billing-profile'),
      events: rows(fake, 'payment-consumer-event'),
      mails: fake.mails.map(mail => ({ to: mail.to, subject: mail.subject })),
    })
  })

  test('withdrawals, a retried refund and cancellations at the paygate', async () => {
    const fake = await makeRightsContext({
      declare: declareGolden, pricing: PRICING, gateway: MANAGED, webhookSecret: SECRET,
      meter: fixedMeter({ granted: 1_000, used: 200, usedAfter: 100 }),
      stripe: {
        apiVersion: PINNED,
        invoices: {
          in_pl: invoiceOf('in_pl'),
          in_2: invoiceOf('in_2', { payment_intent: 'pi_2', lines: { object: 'list', data: [{ id: 'il_2', amount: 919 }] } }),
          in_w: invoiceOf('in_w', {
            subtotal: 1_800, tax: 414, total: 2_214, payment_intent: 'pi_w', subscription: 'sub_w',
            lines: { object: 'list', data: [{ id: 'il_w', amount: 1_800 }] },
          }),
        },
      },
    })
    const startRequestId = await requestStart(fake)
    const subscriptionW = subscriptionOf({
      id: 'sub_w', customer: 'cus_1', planSku: PRO, latestInvoice: 'in_w', periodStart: past(2), periodEnd: future(28),
    }) as unknown as Rec
    subscriptionW.currency = 'eur'
    subscriptionW.items.data[0].price.unit_amount = 1_800
    subscriptionW.metadata = { entityId: ENTITY, planSku: PRO, startRequestId, country: 'PL', language: 'pl' }
    fake.state.subscriptions.sub_w = subscriptionW as never
    const subscriptionC = subscriptionOf({
      id: 'sub_c', customer: 'cus_c', planSku: TEAM, entityId: 'entity-c', latestInvoice: 'in_c', periodStart: past(10),
      periodEnd: future(20),
    }) as unknown as Rec
    subscriptionC.currency = 'eur'
    fake.state.subscriptions.sub_c = subscriptionC as never
    const calls = recordCalls(fake.stripe)

    await deliver(fake, 'checkout.session.completed', paidSession(), 'evt_w_paid')
    await deliver(fake, 'customer.subscription.created', subscriptionW, 'evt_w_sub')
    await deliver(fake, 'checkout.session.completed', paidSession({
      id: 'cs_2', payment_intent: 'pi_2', invoice: 'in_2',
    }), 'evt_w_paid_2')
    await deliver(fake, 'customer.subscription.created', subscriptionC, 'evt_c_sub')
    const subject = { entityId: ENTITY, email: 'owner@shop.eu', name: 'Anna' }
    const topUp = await rights(fake).withdraw(subject, { purchaseId: 'stripe:cs_pl', name: 'Anna', email: 'owner@shop.eu', language: 'en' })
    const ofSubscription = await rights(fake).withdraw(subject, { purchaseId: 'stripe:sub_w', name: 'Anna', email: 'owner@shop.eu' })
    fake.state.failures['refunds.create'] = 'rate_limit'
    const failed = await rights(fake).withdraw(subject, { purchaseId: 'stripe:cs_2', name: 'Anna', email: 'owner@shop.eu' })
    const reconciled = await rights(fake).reconcile()
    const atPeriodEnd = await rights(fake).cancel({ entityId: 'entity-c', email: 'c@shop.eu', name: 'Cee' }, {
      kind: CancellationKind.Ordinary, name: 'Cee', email: 'c@shop.eu', effective: 'earliest', language: 'en',
    })
    const later = new Date(future(20).getTime() + 45 * 86_400_000).toISOString().slice(0, 10)
    const atDate = await rights(fake).cancel({ entityId: 'entity-c', email: 'c@shop.eu', name: 'Cee' }, {
      kind: CancellationKind.Ordinary, name: 'Cee', email: 'c@shop.eu', effective: 'date', date: later, language: 'en',
    })

    golden('withdrawals', {
      receipts: { topUp, ofSubscription, failed, reconciled, atPeriodEnd, atDate },
      calls,
      observed: { withdrawal: fake.observed.withdrawal, cancellation: fake.observed.cancellation },
      purchases: rows(fake, 'payment-purchase'),
      declarations: rows(fake, 'payment-consumer-declaration'),
      events: rows(fake, 'payment-consumer-event'),
      subscriptions: rows(fake, 'payment-subscription'),
    })
  })

  test('price estimates: Stripe Tax at a requested country and at the customer\'s, with the local line', async () => {
    const fake = await makeRightsContext({
      declare: declareGolden, pricing: PRICING, gateway: MANAGED,
      stripe: {
        apiVersion: PINNED,
        taxRates: { PL: [{ type: 'vat', percentage: '23' }], DE: [{ type: 'vat', percentage: '19' }] },
        fxRates: { usd: { exchangeRate: 0.88, referenceRate: 0.9, baseRate: 0.9 }, pln: { exchangeRate: 0.22, baseRate: 0.23, fxFeeRate: 0.02 } },
        customers: {
          cus_e: {
            id: 'cus_e', object: 'customer', address: { country: 'DE' }, tax_exempt: 'reverse',
            tax_ids: { data: [{ type: 'eu_vat', value: 'DE123456789', country: 'DE' }, { type: 'gb_vat', value: 'GB1', country: 'GB' }] },
          },
        },
      },
      seed: {
        'payment-paygate-customer': [{ id: 'seed-customer', paygate: 'stripe', externalId: 'cus_e', entityId: 'entity-e' }],
        'payment-fingerprint': [{
          id: 'seed-fingerprint', sku: PLANS_PRODUCT, hash: 'x', productId: PLANS_PRODUCT, updatedAt: past(1),
          prices: [{
            planSku: PRO, priceId: 'price_pro', lookupKey: PRO, currency: 'eur', unitAmount: 1_800,
            options: [{ currency: 'usd', unitAmount: 2_000 }], taxBehavior: 'exclusive', interval: 'month',
            sourceUnitAmount: 2_000, sourceCurrency: 'usd', syncedAt: past(1),
          }],
        }],
      },
    })
    const calls = recordCalls(fake.stripe)
    const estimates = [
      await gateway(fake).estimatePrice(fake.ctx, { productSku: CREDITS_PRODUCT, entityId: ENTITY, country: 'pl' }),
      await gateway(fake).estimatePrice(fake.ctx, { productSku: CREDITS_PRODUCT, entityId: ENTITY, country: 'pl' }),
      await gateway(fake).estimatePrice(fake.ctx, { productSku: PLANS_PRODUCT, planSku: PRO, entityId: 'entity-e' }),
      await gateway(fake).estimatePrice(fake.ctx, { productSku: PLANS_PRODUCT, planSku: PRO, entityId: 'entity-us', country: 'US' }),
      await gateway(fake).estimatePrice(fake.ctx, { productSku: PLANS_PRODUCT, planSku: PRO, entityId: 'entity-none' }),
    ]

    golden('estimates', { estimates, calls })
  })

  test('resync and reconcile: subscriptions re-read, purchases backfilled, legacy organizations locked', async () => {
    const session = paidSession({ id: 'cs_back', payment_intent: 'pi_back', invoice: 'in_back', created: epoch(past(2)) })
    const subscriptionR = subscriptionOf({ id: 'sub_r', customer: 'cus_r', planSku: TEAM, latestInvoice: 'in_r' }) as unknown as Rec
    subscriptionR.metadata = { entityId: ENTITY }
    const fake = await makeRightsContext({
      declare: declareGolden, pricing: PRICING, gateway: MANAGED,
      stripe: {
        apiVersion: PINNED,
        subscriptions: { sub_r: subscriptionR },
        invoices: { in_back: invoiceOf('in_back', { payment_intent: 'pi_back' }) },
        listedSessions: [session, { ...paidSession({ id: 'cs_open' }), status: 'open', payment_status: 'unpaid' }],
        customers: { cus_legacy: { id: 'cus_legacy', object: 'customer', address: { country: 'DE' } } },
      },
      seed: {
        'payment-subscription': [
          { id: 'seed-r', entityId: ENTITY, planSku: PRO, productSku: PLANS_PRODUCT, service: SERVICE, paygate: 'stripe', externalId: 'sub_r', status: 'active', rank: 10, createdAt: past(40) },
          { id: 'seed-gone', entityId: ENTITY, planSku: PRO, productSku: PLANS_PRODUCT, service: SERVICE, paygate: 'stripe', externalId: 'sub_gone', status: 'active', rank: 10, createdAt: past(80) },
        ],
        'payment-paygate-customer': [{ id: 'seed-legacy', paygate: 'stripe', externalId: 'cus_legacy', entityId: 'entity-legacy' }],
        'payment-fulfillment': [{
          id: 'seed-fulfillment', entityId: 'entity-legacy', productSku: CREDITS_PRODUCT, service: SERVICE, paygate: 'stripe',
          externalId: 'cs_legacy', mode: 'amount', createdAt: past(100), fulfilledAt: past(100),
        }],
      },
    })
    const calls = recordCalls(fake.stripe)
    const all = await gateway(fake).resyncAll(fake.ctx)
    const entity = await gateway(fake).resyncSubscription(fake.ctx, { entityId: ENTITY })
    const reconciled = await rights(fake).reconcile()

    golden('resync-reconcile', {
      all, entity, reconciled, calls,
      observed: { subscription: fake.observed.subscription },
      subscriptions: rows(fake, 'payment-subscription'),
      purchases: rows(fake, 'payment-purchase'),
      profiles: rows(fake, 'payment-billing-profile'),
    })
  })
})

