import type Stripe from 'stripe'
import type { SubscriptionStatus } from '@owlmeans/payment'

/** A Stripe subscription's status in the host's terms — pure. */
export interface StripeStatusHelper {
  /**
   * Stripe's subscription status as a `SubscriptionStatus`: `active`→Active, `trialing`→Trial,
   * `past_due`→PastDue (still entitles), `unpaid`/`paused`→Suspended, `incomplete`→Created,
   * `incomplete_expired`→Ended, `canceled`→Canceled; paused collection is Suspended.
   */
  mapStatus: (subscription: Pick<Stripe.Subscription, 'status' | 'pause_collection'>) => SubscriptionStatus
  /** Paused itself, or collection paused on an active or trialing subscription. */
  isPaused: (subscription: Pick<Stripe.Subscription, 'status' | 'pause_collection'>) => boolean
}
