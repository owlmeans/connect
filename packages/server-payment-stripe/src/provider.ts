import type { Context as ApiContext } from '@owlmeans/server-api'
import { ensurePaymentProviders, type Config, type Context, type PaymentProvider } from '@owlmeans/server-payment'
import { STRIPE_FEATURES, STRIPE_PAYGATE } from './consts.js'
import type { StripeProviderOptions } from './types.js'
import type { StripePaygate } from './provider/types.js'
import { makeStripeAccess } from './client.js'
import { makeStripeCustomers } from './customers.js'
import { makeStripeCheckout } from './checkout.js'
import { makeStripeSubscriptions } from './subscriptions.js'
import { makeStripePayments } from './payments.js'
import { makeStripeEvents } from './events.js'
import { makeStripeWebhook } from './webhook.js'
import { makeStripeCatalogue } from './catalogue.js'
import { makeStripePortal } from './portal.js'
import { makeStripeTax } from './tax.js'
import { makeStripeFx } from './fx.js'

/**
 * The Stripe payment provider (paygate `stripe`): Checkout, subscriptions, refunds and credit notes,
 * the signed webhook and its managed endpoint, the catalogue sync, the customer portal, Stripe Tax
 * and FX Quotes. `client` and `pricing` win over the declared records (`stripeSecrets`,
 * `declareStripePricing`).
 */
export const makeStripeProvider = (opts: StripeProviderOptions = {}): PaymentProvider => ({
  id: STRIPE_PAYGATE,
  features: STRIPE_FEATURES,
  bind: (ctx: ApiContext): StripePaygate => {
    const access = makeStripeAccess(ctx, opts)
    const subscriptions = makeStripeSubscriptions(access)
    const payments = makeStripePayments(access)
    const events = makeStripeEvents(access, subscriptions, payments)

    return {
      id: STRIPE_PAYGATE,
      features: STRIPE_FEATURES,
      access,
      settlementCurrency: async () => (await access.pricing())?.settlementCurrency?.toLowerCase(),
      customers: makeStripeCustomers(ctx, access),
      checkout: makeStripeCheckout(ctx, access),
      subscriptions,
      payments,
      webhook: makeStripeWebhook(ctx, access, events),
      events,
      catalogue: makeStripeCatalogue(access),
      portal: makeStripePortal(ctx, access),
      tax: makeStripeTax(access),
      fx: makeStripeFx(access),
    }
  },
})

/**
 * Register the Stripe provider in a context — in every process that registers the payment gateway,
 * before or after it (the providers service is lazy). Registering it again replaces it.
 */
export const appendStripeProvider = <C extends Config, T extends Context<C>>(ctx: T, opts?: StripeProviderOptions): T => {
  ensurePaymentProviders(ctx).register(makeStripeProvider(opts))

  return ctx
}
