import type Stripe from 'stripe'
import type { PaygateEvent } from '@owlmeans/server-payment'

/** Stripe events in the host's terms. */
export interface StripeEvents {
  /**
   * The host events of one Stripe event, in order: customers, Checkout Sessions (completed and
   * delayed-payment succeeded → `completed`), subscriptions (deleted → `deleted`, `trial_will_end` →
   * `trialEnding`), invoices (`subscription_cycle` → a renewal), refunds — `charge.refunded` lists the
   * charge's refunds, one event each —, disputes. None for `invoice.upcoming`, `refund.failed` and every
   * type the host does not process.
   */
  translate: (event: Stripe.Event) => Promise<PaygateEvent[]>
}
