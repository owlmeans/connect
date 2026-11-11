import type Stripe from 'stripe'
import type { PaygateCustomer, PaygateCustomers } from '@owlmeans/server-payment'

/** The Stripe customers of a context. */
export interface StripeCustomers extends PaygateCustomers {
  /** A Stripe customer as the host reads it (`taxLocatable` from Stripe Tax's customer-locations rule). */
  customerOf: (customer: Stripe.Customer) => PaygateCustomer
}
