import Stripe from 'stripe'
import type { Context as ApiContext } from '@owlmeans/server-api'
import {
  paygatesOf, paymentEventsOf, webhookOf, type ConsumerRightsOptions, type PricingDef,
} from '@owlmeans/server-payment'
import {
  makeFakeContext as makeBaseContext, type FakeContext as BaseFakeContext, type FakeContextOptions as BaseOptions,
} from '@owlmeans/test-payment'
import { WebhookSetupError } from '@owlmeans/payment'
import {
  declareStripePricing, makeStripeProvider, portalBranding, STRIPE_PAYGATE, stripeSecrets,
  type PortalBrandingDef, type StripePaygate, type StripePricingDef,
} from '../src/index.js'

import { future, past, PRO } from '@owlmeans/test-payment'

export {
  CAP_BASIC, CAP_PREVIEW, CAP_WHITELABEL, CREDIT_UNIT, CREDITS_PRODUCT, declareTestCatalogue, FREE, future, HOST,
  memoryResource, past, PLANS_PRODUCT, PRO, SERVICE, TEAM,
} from '@owlmeans/test-payment'
export type { CatalogueOptions, MemoryStore, Observed } from '@owlmeans/test-payment'

/**
 * The Stripe test harness: a fake Stripe SDK that records every call (and its request options) and
 * can fail a method's next calls, and `makeFakeContext` — the `@owlmeans/test-payment` context with
 * the Stripe provider registered on that fake (`client`), the secrets, portal branding and Stripe
 * pricing declared the way an application declares them.
 */

// -----------------------------------------------------------------------------------------------
// Fake Stripe
// -----------------------------------------------------------------------------------------------

type Rec = Record<string, any>

export type FakeFailure = string | Error

export interface FakeStripeState {
  apiVersion: string
  /** Every SDK method called, in order: `webhookEndpoints.create`, … */
  calls: string[]
  webhookEndpoints: Rec[]
  portalConfigurations: Rec[]
  /** The params every portal session was asked for with. */
  portalSessions: Rec[]
  checkoutSessions: Rec[]
  subscriptions: Record<string, Rec>
  invoices: Record<string, Rec>
  charges: Record<string, Rec>
  refunds: Rec[]
  prices: Rec[]
  products: Record<string, Rec>
  customers: Record<string, Rec>
  lineItemQuantity: number
  seq: number
  /** Every `tax.calculations.create` params, in call order. */
  taxCalculations: Rec[]
  /** Flat-percentage rates a country charges (uppercase alpha-2). Absent/empty: `not_collecting`. */
  taxRates: Record<string, Array<{ type: string, percentage: string }>>
  /** Countries whose calculation throws `customer_tax_location_invalid` (simulates a missing ZIP). */
  taxInvalidCountries: string[]
  /** Countries Stripe Tax does not cover: a `not_supported`, zero-tax breakdown row. */
  taxUnsupportedCountries: string[]
  taxSettings: Rec
  /** Every `rawRequest` call, in order: `{ method, path, params }`. */
  rawRequests: Rec[]
  /** FX Quotes rates by lowercase source currency. */
  fxRates: Record<string, { exchangeRate: number, baseRate?: number, referenceRate?: number, fxFeeRate?: number }>
  /** Every `rawRequest` to `/v1/fx_quotes` throws. */
  fxUnavailable: boolean
  /** Completed or open checkout sessions `checkout.sessions.list` answers. */
  listedSessions: Rec[]
  creditNotes: Rec[]
  /** Every `creditNotes.preview` params. */
  creditNotePreviews: Rec[]
  /** Every call's request options (`idempotencyKey`), by method. */
  requestOptions: Record<string, Rec[]>
  /**
   * Methods that throw on their next call: name → an error message (a Stripe invalid-request
   * error), an error to throw as it is, or a list of those — one per call, in order.
   */
  failures: Record<string, FakeFailure | FakeFailure[]>
  /** Every `subscriptions.update` / `.cancel` params, in order. */
  subscriptionChanges: Rec[]
  expiredSessions: string[]
}

/** The API version the installed SDK defaults to, read from a real client. */
export const SDK_API_VERSION = (new Stripe('sk_test_offline') as unknown as { getApiField: (key: string) => string })
  .getApiField('version')

export const missing = (what: string): Error => Object.assign(new Error(`No such ${what}`), {
  type: 'StripeInvalidRequestError', code: 'resource_missing', statusCode: 404,
})

/** A Stripe `invalid_request_error`, duck-typed the same way `missing` fakes `resource_missing`. */
export const invalidRequest = (code: string): Error => Object.assign(new Error(code), {
  type: 'StripeInvalidRequestError', code, statusCode: 400,
})

const page = (items: Rec[], params: Rec = {}) => {
  let start = 0
  if (params.starting_after != null) {
    start = items.findIndex(item => item.id === params.starting_after) + 1
  }
  const limit = params.limit ?? 10
  const data = items.slice(start, start + limit)

  return { object: 'list', data: structuredClone(data), has_more: start + limit < items.length }
}

export const makeFakeStripe = (initial: Partial<FakeStripeState> = {}): { stripe: Stripe, state: FakeStripeState } => {
  const state: FakeStripeState = {
    apiVersion: SDK_API_VERSION, calls: [], webhookEndpoints: [], portalConfigurations: [], portalSessions: [],
    checkoutSessions: [], subscriptions: {}, invoices: {}, charges: {}, refunds: [], prices: [], products: {},
    customers: {}, lineItemQuantity: 7, seq: 0,
    taxCalculations: [], taxRates: {}, taxInvalidCountries: [], taxUnsupportedCountries: [],
    taxSettings: { defaults: { tax_behavior: null, tax_code: null }, head_office: null, status: 'active', status_details: {} },
    rawRequests: [], fxRates: {}, fxUnavailable: false,
    listedSessions: [], creditNotes: [], creditNotePreviews: [], requestOptions: {}, failures: {},
    subscriptionChanges: [], expiredSessions: [],
    ...initial,
  }
  const next = (prefix: string): string => `${prefix}_${++state.seq}`
  const call = (name: string, options?: Rec): void => {
    state.calls.push(name)
    if (options != null) (state.requestOptions[name] = state.requestOptions[name] ?? []).push(options)
    const failure = state.failures[name]
    if (failure != null) {
      const next = Array.isArray(failure) ? failure.shift() : failure
      if (!Array.isArray(failure) || failure.length === 0) delete state.failures[name]
      if (next != null) throw typeof next === 'string' ? invalidRequest(next) : next
    }
  }
  const find = (list: Rec[], id: string, what: string): Rec => {
    const found = list.find(item => item.id === id)
    if (found == null) throw missing(what)
    return found
  }

  const stripe = {
    getApiField: (key: string) => key === 'version' ? state.apiVersion : undefined,
    webhookEndpoints: {
      create: async (params: Rec) => {
        call('webhookEndpoints.create')
        const endpoint = {
          id: next('we'), object: 'webhook_endpoint', url: params.url, enabled_events: [...params.enabled_events],
          api_version: params.api_version, description: params.description, metadata: { ...params.metadata },
          status: 'enabled', secret: next('whsec'),
        }
        state.webhookEndpoints.push(endpoint)
        return structuredClone(endpoint)
      },
      update: async (id: string, params: Rec) => {
        call('webhookEndpoints.update')
        const endpoint = find(state.webhookEndpoints, id, 'webhook endpoint')
        Object.assign(endpoint, params)
        const { secret: _secret, ...rest } = endpoint
        return structuredClone(rest)
      },
      retrieve: async (id: string) => {
        call('webhookEndpoints.retrieve')
        const { secret: _secret, ...rest } = find(state.webhookEndpoints, id, 'webhook endpoint')
        return structuredClone(rest)
      },
      del: async (id: string) => {
        call('webhookEndpoints.del')
        find(state.webhookEndpoints, id, 'webhook endpoint')
        state.webhookEndpoints = state.webhookEndpoints.filter(item => item.id !== id)
        return { id, object: 'webhook_endpoint', deleted: true }
      },
      list: async (params: Rec = {}) => {
        call('webhookEndpoints.list')
        return page(state.webhookEndpoints.map(({ secret: _secret, ...rest }) => rest), params)
      },
    },
    billingPortal: {
      configurations: {
        create: async (params: Rec) => {
          call('billingPortal.configurations.create')
          const configuration = { id: next('bpc'), object: 'billing_portal.configuration', active: true, ...structuredClone(params) }
          state.portalConfigurations.push(configuration)
          return structuredClone(configuration)
        },
        retrieve: async (id: string) => {
          call('billingPortal.configurations.retrieve')
          return structuredClone(find(state.portalConfigurations, id, 'configuration'))
        },
        update: async (id: string, params: Rec) => {
          call('billingPortal.configurations.update')
          const configuration = find(state.portalConfigurations, id, 'configuration')
          Object.assign(configuration, structuredClone(params))
          return structuredClone(configuration)
        },
        list: async (params: Rec = {}) => {
          call('billingPortal.configurations.list')
          return page(state.portalConfigurations.filter(item => params.active == null || item.active === params.active), params)
        },
      },
      sessions: {
        create: async (params: Rec) => {
          call('billingPortal.sessions.create')
          state.portalSessions.push(structuredClone(params))
          return { id: next('bps'), url: `https://billing.example.test/p/${state.seq}` }
        },
      },
    },
    subscriptions: {
      retrieve: async (id: string) => {
        call('subscriptions.retrieve')
        const subscription = state.subscriptions[id]
        if (subscription == null) throw missing('subscription')
        return structuredClone(subscription)
      },
      update: async (id: string, params: Rec, options?: Rec) => {
        call('subscriptions.update', options)
        const subscription = state.subscriptions[id]
        if (subscription == null) throw missing('subscription')
        state.subscriptionChanges.push({ id, method: 'update', ...structuredClone(params) })
        Object.assign(subscription, params)
        return structuredClone(subscription)
      },
      cancel: async (id: string, params: Rec = {}, options?: Rec) => {
        call('subscriptions.cancel', options)
        const subscription = state.subscriptions[id]
        if (subscription == null) throw missing('subscription')
        state.subscriptionChanges.push({ id, method: 'cancel', ...structuredClone(params) })
        subscription.status = 'canceled'
        return structuredClone(subscription)
      },
    },
    creditNotes: {
      preview: async (params: Rec) => {
        call('creditNotes.preview')
        state.creditNotePreviews.push(structuredClone(params))
        const invoice = state.invoices[params.invoice]
        if (invoice == null) throw missing('invoice')
        const discount = (invoice.total_discount_amounts ?? []).reduce((sum: number, item: Rec) => sum + item.amount, 0)
        const net = invoice.subtotal - discount
        const rate = net > 0 ? (invoice.tax ?? 0) / net : 0
        const amount = params.lines.reduce((sum: number, line: Rec) => sum + (line.amount ?? 0), 0)
        const discounted = amount - (invoice.subtotal > 0 ? Math.round(amount * discount / invoice.subtotal) : 0)
        const tax = Math.round(discounted * rate)
        return { id: 'cnpreview', object: 'credit_note', amount: discounted + tax, total: discounted + tax, subtotal: amount, currency: invoice.currency }
      },
      create: async (params: Rec, options?: Rec) => {
        call('creditNotes.create', options)
        const invoice = state.invoices[params.invoice]
        if (invoice == null) throw missing('invoice')
        const discount = (invoice.total_discount_amounts ?? []).reduce((sum: number, item: Rec) => sum + item.amount, 0)
        const net = invoice.subtotal - discount
        const rate = net > 0 ? (invoice.tax ?? 0) / net : 0
        const amount = params.lines.reduce((sum: number, line: Rec) => sum + (line.amount ?? 0), 0)
        const discounted = amount - (invoice.subtotal > 0 ? Math.round(amount * discount / invoice.subtotal) : 0)
        const note = {
          id: next('cn'), object: 'credit_note', invoice: params.invoice, refund: params.refund, status: 'issued',
          total: discounted + Math.round(discounted * rate), currency: invoice.currency, memo: params.memo,
          metadata: { ...params.metadata }, lines: structuredClone(params.lines),
        }
        state.creditNotes.push(note)
        return structuredClone(note)
      },
      list: async (params: Rec = {}) => {
        call('creditNotes.list')
        return page(state.creditNotes.filter(note => params.invoice == null || note.invoice === params.invoice), params)
      },
    },
    invoices: {
      retrieve: async (id: string) => {
        call('invoices.retrieve')
        const invoice = state.invoices[id]
        if (invoice == null) throw missing('invoice')
        return structuredClone(invoice)
      },
    },
    charges: {
      retrieve: async (id: string) => {
        call('charges.retrieve')
        const charge = state.charges[id]
        if (charge == null) throw missing('charge')
        return structuredClone(charge)
      },
    },
    refunds: {
      list: async (params: Rec = {}) => {
        call('refunds.list')
        return page(state.refunds.filter(refund => (params.charge == null || refund.charge === params.charge)
          && (params.payment_intent == null || refund.payment_intent === params.payment_intent)), params)
      },
      create: async (params: Rec, options?: Rec) => {
        call('refunds.create', options)
        const refund = {
          id: next('re'), object: 'refund', amount: params.amount, currency: params.currency ?? 'eur', status: 'succeeded',
          payment_intent: params.payment_intent, charge: null, reason: params.reason, metadata: { ...params.metadata },
        }
        state.refunds.push(refund)
        return structuredClone(refund)
      },
    },
    prices: {
      list: async (params: Rec = {}) => {
        call('prices.list')
        return page(state.prices.filter(price => (params.product == null || price.product === params.product)
          && (params.active == null || price.active === params.active)
          && (params.lookup_keys == null || params.lookup_keys.includes(price.lookup_key))), { limit: 100, ...params })
      },
      create: async (params: Rec) => {
        call('prices.create')
        // Stripe's own default: a price created with no `tax_behavior` is `unspecified`.
        const price = { id: next('price'), active: true, tax_behavior: 'unspecified', ...structuredClone(params) }
        state.prices.push(price)
        return structuredClone(price)
      },
      update: async (id: string, params: Rec) => {
        call('prices.update')
        const price = find(state.prices, id, 'price')
        if (
          params.tax_behavior != null && price.tax_behavior != null && price.tax_behavior !== 'unspecified'
          && price.tax_behavior !== params.tax_behavior
        ) {
          // Real Stripe: once a price's `tax_behavior` is `exclusive` or `inclusive`, it cannot change.
          throw invalidRequest('parameter_invalid_empty')
        }
        Object.assign(price, params)
        return structuredClone(price)
      },
    },
    products: {
      retrieve: async (id: string) => {
        call('products.retrieve')
        if (state.products[id] == null) throw missing('product')
        return structuredClone(state.products[id])
      },
      update: async (id: string, params: Rec) => {
        call('products.update')
        Object.assign(state.products[id], params)
        return structuredClone(state.products[id])
      },
      create: async (params: Rec) => {
        call('products.create')
        state.products[params.id] = structuredClone(params)
        return structuredClone(params)
      },
    },
    customers: {
      retrieve: async (id: string) => {
        call('customers.retrieve')
        if (state.customers[id] == null) throw missing('customer')
        return structuredClone(state.customers[id])
      },
      create: async (params: Rec) => {
        call('customers.create')
        const customer = { id: next('cus'), object: 'customer', address: null, ...structuredClone(params) }
        state.customers[customer.id] = customer
        return structuredClone(customer)
      },
      update: async (id: string, params: Rec) => {
        call('customers.update')
        const customer = state.customers[id]
        if (customer == null) throw missing('customer')
        Object.assign(customer, params)
        return structuredClone(customer)
      },
    },
    checkout: {
      sessions: {
        create: async (params: Rec) => {
          call('checkout.sessions.create')
          state.checkoutSessions.push(structuredClone(params))
          return { id: next('cs'), url: `https://checkout.example.test/${state.seq}` }
        },
        expire: async (id: string) => {
          call('checkout.sessions.expire')
          state.expiredSessions.push(id)
          return { id, status: 'expired' }
        },
        list: async (params: Rec = {}) => {
          call('checkout.sessions.list')
          return page(state.listedSessions.filter(session => (params.status == null || session.status === params.status)
            && (params.created?.gte == null || session.created >= params.created.gte)), params)
        },
        listLineItems: async () => {
          call('checkout.sessions.listLineItems')
          return { data: [{ quantity: state.lineItemQuantity }] }
        },
      },
    },
    tax: {
      calculations: {
        /**
         * A flat-percentage tax model, entirely driven by `state.taxRates` / `taxInvalidCountries`
         * / `taxUnsupportedCountries` — real enough to exercise the status mapping and the
         * scalability rule, never a stand-in for Stripe's actual jurisdiction logic.
         */
        create: async (params: Rec) => {
          call('tax.calculations.create')
          state.taxCalculations.push(structuredClone(params))
          const country = params.customer_details?.address?.country as string | undefined
          if (country != null && state.taxInvalidCountries.includes(country)) {
            throw invalidRequest('customer_tax_location_invalid')
          }
          const lineItem = params.line_items[0]
          const amount: number = lineItem.amount
          const inclusive = lineItem.tax_behavior === 'inclusive'
          const reverseCharge = (params.customer_details?.tax_ids ?? []).length > 0
          const rates = reverseCharge ? [] : (country != null ? state.taxRates[country] ?? [] : [])
          const unsupported = !reverseCharge && rates.length === 0
            && country != null && state.taxUnsupportedCountries.includes(country)

          const breakdown = reverseCharge
            ? [{
              amount: 0, inclusive, taxable_amount: amount, taxability_reason: 'reverse_charge',
              tax_rate_details: { country, state: null, percentage_decimal: '0', tax_type: 'vat' },
            }]
            : unsupported
              ? [{
                amount: 0, inclusive, taxable_amount: amount, taxability_reason: 'not_supported',
                tax_rate_details: null,
              }]
              : rates.length === 0
                ? [{
                  amount: 0, inclusive, taxable_amount: amount, taxability_reason: 'not_collecting',
                  tax_rate_details: { country, state: null, percentage_decimal: '0', tax_type: 'vat' },
                }]
                : rates.map(rate => ({
                  amount: Math.round(amount * Number(rate.percentage) / 100), inclusive, taxable_amount: amount,
                  taxability_reason: 'standard_rated',
                  tax_rate_details: { country, state: null, percentage_decimal: rate.percentage, tax_type: rate.type },
                }))
          const taxTotal = breakdown.reduce((sum, row) => sum + row.amount, 0)

          return {
            id: next('taxcalc'), object: 'tax.calculation', currency: params.currency,
            amount_total: inclusive ? amount : amount + taxTotal,
            tax_amount_exclusive: inclusive ? 0 : taxTotal,
            tax_amount_inclusive: inclusive ? taxTotal : 0,
            tax_breakdown: breakdown,
          }
        },
      },
      settings: {
        retrieve: async () => {
          call('tax.settings.retrieve')
          return structuredClone(state.taxSettings)
        },
      },
    },
    rawRequest: async (method: string, path: string, params: Rec = {}) => {
      call('rawRequest')
      state.rawRequests.push({ method, path, params: structuredClone(params) })
      if (path !== '/v1/fx_quotes') {
        throw new Error(`fake-stripe: unhandled rawRequest path "${path}"`)
      }
      if (state.fxUnavailable) {
        throw new Error('fx_quotes unavailable')
      }
      const local = params['from_currencies[]'] as string
      const rate = state.fxRates[local]
      if (rate == null) {
        return { rates: {} }
      }
      return {
        rates: {
          [local]: {
            exchange_rate: rate.exchangeRate,
            rate_details: {
              base_rate: rate.baseRate ?? rate.exchangeRate,
              reference_rate: rate.referenceRate ?? rate.baseRate ?? rate.exchangeRate,
              fx_fee_rate: rate.fxFeeRate ?? 0.02,
            },
          },
        },
      }
    },
    webhooks: {
      /** Accepts the signature `sig:<secret>` over any body. */
      constructEventAsync: async (raw: string | Buffer, signature: string, secret: string) => {
        if (signature !== `sig:${secret}`) throw new Error('bad signature')
        return JSON.parse(raw.toString())
      },
    },
  }

  return { stripe: stripe as unknown as Stripe, state }
}

// -----------------------------------------------------------------------------------------------
// Stripe objects
// -----------------------------------------------------------------------------------------------

let objectSeq = 0
const epoch = (date: Date): number => Math.floor(date.getTime() / 1000)

export interface SubscriptionShape {
  id?: string
  customer?: string
  entityId?: string
  planSku?: string
  status?: Stripe.Subscription.Status
  itemId?: string
  priceId?: string
  periodStart?: Date
  periodEnd?: Date
  cancelAtPeriodEnd?: boolean
  pauseCollection?: Rec | null
  trialEnd?: Date
  latestInvoice?: string
  created?: Date
  endedAt?: Date
  defaultPaymentMethod?: string
}

export const subscriptionOf = (shape: SubscriptionShape = {}): Stripe.Subscription => ({
  id: shape.id ?? 'sub_1',
  object: 'subscription',
  customer: shape.customer ?? 'cus_1',
  status: shape.status ?? 'active',
  metadata: { ...(shape.entityId !== undefined ? { entityId: shape.entityId } : { entityId: 'entity-1' }) },
  items: {
    object: 'list', has_more: false, url: '',
    data: [{ id: shape.itemId ?? 'si_1', price: { id: shape.priceId ?? `price_${shape.planSku ?? PRO}`, lookup_key: shape.planSku ?? PRO } }],
  },
  current_period_start: epoch(shape.periodStart ?? past(1)),
  current_period_end: epoch(shape.periodEnd ?? future(29)),
  cancel_at_period_end: shape.cancelAtPeriodEnd ?? false,
  canceled_at: null,
  ended_at: shape.endedAt != null ? epoch(shape.endedAt) : null,
  pause_collection: shape.pauseCollection ?? null,
  trial_end: shape.trialEnd != null ? epoch(shape.trialEnd) : null,
  latest_invoice: shape.latestInvoice ?? 'in_1',
  created: epoch(shape.created ?? past(1)),
  default_payment_method: shape.defaultPaymentMethod ?? 'pm_1',
} as unknown as Stripe.Subscription)

export const eventOf = (type: string, object: unknown, overrides: Rec = {}): Stripe.Event => ({
  id: `evt_${++objectSeq}`, object: 'event', type, created: epoch(new Date()), data: { object }, ...overrides,
} as unknown as Stripe.Event)


// -----------------------------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------------------------

export interface FakeContextOptions extends Omit<BaseOptions, 'pricing' | 'rights' | 'providers' | 'configure'> {
  /** The configured webhook override secret. */
  webhookSecret?: string
  portal?: PortalBrandingDef
  /** The pricing policy, and the Stripe pricing settings under `stripe` (`declareStripePricing`). */
  pricing?: PricingDef & { stripe?: StripePricingDef }
  stripe?: Partial<FakeStripeState>
  /** Another process's fake Stripe — one Stripe account shared by two deployments. */
  sharedStripe?: { stripe: Stripe, state: FakeStripeState }
  /** The application's consumer-rights options (default: managed, with `meter`). */
  rights?: (stripe: Stripe) => ConsumerRightsOptions
}

export interface FakeContext extends Omit<BaseFakeContext, 'paygate'> {
  stripe: Stripe
  state: FakeStripeState
  /** The Stripe paygate of the context, bound on the fake. */
  paygate: StripePaygate
}

/** The bound Stripe paygate of a context. */
export const stripePaygateOf = (ctx: ApiContext): StripePaygate => paygatesOf(ctx).get(STRIPE_PAYGATE) as StripePaygate

/**
 * A real server context — real catalogue, payment service, observer, gateway (unmanaged unless
 * `gateway` says otherwise), gates and entitlement service — over in-memory resources, with the
 * Stripe provider on a fake Stripe.
 */
export const makeFakeContext = async (opts: FakeContextOptions = {}): Promise<FakeContext> => {
  const { stripe, state } = opts.sharedStripe ?? makeFakeStripe(opts.stripe)
  const { stripe: stripePricing, ...policy } = opts.pricing ?? {}
  const { webhookSecret, portal, pricing, rights, stripe: _state, sharedStripe: _shared, ...rest } = opts
  const base = await makeBaseContext({
    ...rest,
    ...(pricing != null ? { pricing: policy as PricingDef } : {}),
    configure: cfg => {
      stripeSecrets(cfg, { api: 'sk_test_offline', ...(webhookSecret != null ? { webhook: webhookSecret } : {}) })
      if (portal != null) {
        portalBranding(cfg, portal)
      }
      if (stripePricing != null) {
        declareStripePricing(cfg, stripePricing)
      }
    },
    ...(rights != null ? { rights: () => rights(stripe) } : {}),
    providers: [makeStripeProvider({ client: stripe })],
  })

  return { ...base, stripe, state, paygate: stripePaygateOf(base.ctx) }
}

/** Apply a Stripe event the way a verified delivery does: translated by the provider, applied by the host. */
export const deliverEvent = async (fake: { ctx: ApiContext }, event: Stripe.Event): Promise<void> => {
  const paygate = stripePaygateOf(fake.ctx)
  for (const translated of await paygate.events.translate(event)) {
    await paymentEventsOf(fake.ctx).apply(paygate, translated)
  }
}

/** The secret a Stripe signature is verified with first. @throws WebhookSetupError('secret') */
export const stripeWebhookSecret = async (ctx: ApiContext): Promise<string> => {
  const [secret] = await stripePaygateOf(ctx).webhook.secrets({ owner: webhookOf(ctx).gatewayOwnerOf() })
  if (secret == null) {
    throw new WebhookSetupError('secret')
  }

  return secret
}
