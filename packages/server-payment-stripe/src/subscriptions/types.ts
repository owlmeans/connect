import type Stripe from 'stripe'
import type { PaygateSubscription, PaygateSubscriptions } from '@owlmeans/server-payment'

/** The Stripe subscriptions of a context. */
export interface StripeSubscriptions extends PaygateSubscriptions {
  /**
   * A Stripe subscription as the host reads it. `current_period_*` are top-level on the API version
   * the client is pinned to — read through a narrow accessor because later versions move them onto
   * the subscription items.
   */
  subscriptionOf: (subscription: Stripe.Subscription) => PaygateSubscription
}
