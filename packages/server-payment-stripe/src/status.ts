import type Stripe from 'stripe'
import { SubscriptionStatus } from '@owlmeans/payment'
import type { StripeStatusHelper } from './status/types.js'

export const createStripeStatusHelper = (): StripeStatusHelper => {
  const mapStatus = (subscription: Pick<Stripe.Subscription, 'status' | 'pause_collection'>): SubscriptionStatus => {
    switch (subscription.status) {
      case 'active':
        return subscription.pause_collection != null ? SubscriptionStatus.Suspended : SubscriptionStatus.Active
      case 'trialing':
        return subscription.pause_collection != null ? SubscriptionStatus.Suspended : SubscriptionStatus.Trial
      case 'past_due': return SubscriptionStatus.PastDue
      case 'unpaid': return SubscriptionStatus.Suspended
      case 'paused': return SubscriptionStatus.Suspended
      case 'incomplete': return SubscriptionStatus.Created
      case 'incomplete_expired': return SubscriptionStatus.Ended
      case 'canceled': return SubscriptionStatus.Canceled
      default: return SubscriptionStatus.Created
    }
  }

  const isPaused = (subscription: Pick<Stripe.Subscription, 'status' | 'pause_collection'>): boolean =>
    subscription.status === 'paused'
    || (subscription.pause_collection != null && (subscription.status === 'active' || subscription.status === 'trialing'))

  return { mapStatus, isPaused }
}

export const stripeStatusHelper = createStripeStatusHelper()
