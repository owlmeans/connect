import type { Paygate } from '@owlmeans/server-payment'
import type { StripeCatalogue } from '../catalogue/types.js'
import type { StripeCheckout } from '../checkout/types.js'
import type { StripeAccess } from '../client/types.js'
import type { StripeCustomers } from '../customers/types.js'
import type { StripeEvents } from '../events/types.js'
import type { StripeFx } from '../fx/types.js'
import type { StripePayments } from '../payments/types.js'
import type { StripePortal } from '../portal/types.js'
import type { StripeSubscriptions } from '../subscriptions/types.js'
import type { StripeTax } from '../tax/types.js'
import type { StripeWebhook } from '../webhook/types.js'

/** The Stripe paygate of one context: every capability, plus its client and settings. */
export interface StripePaygate extends Paygate {
  access: StripeAccess
  customers: StripeCustomers
  checkout: StripeCheckout
  subscriptions: StripeSubscriptions
  payments: StripePayments
  webhook: StripeWebhook
  /** The translation of a Stripe event into the host's events (what a verified delivery answers). */
  events: StripeEvents
  catalogue: StripeCatalogue
  portal: StripePortal
  tax: StripeTax
  fx: StripeFx
}
