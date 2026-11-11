import type Stripe from 'stripe'
import {
  paymentUtils, type CancelSchedule, type PaygateCall, type PaygateSubscription,
} from '@owlmeans/server-payment'
import type { StripeAccess } from './client/types.js'
import type { StripeSubscriptions } from './subscriptions/types.js'
import { stripeStatusHelper } from './status.js'
import { stripeUtils } from './utils.js'

export const makeStripeSubscriptions = (access: StripeAccess): StripeSubscriptions => {
  const subscriptionOf = (subscription: Stripe.Subscription): PaygateSubscription => {
    const item = subscription.items?.data?.[0]
    const period = subscription as unknown as { current_period_start?: number | null, current_period_end?: number | null }

    return paymentUtils.compact({
      id: subscription.id,
      customerId: paymentUtils.idOf(subscription.customer),
      metadata: { ...(subscription.metadata ?? {}) },
      status: stripeStatusHelper.mapStatus(subscription),
      externalStatus: subscription.status,
      paused: stripeStatusHelper.isPaused(subscription),
      // A price recreated by the catalogue sync (an opposite `tax_behavior`) loses its lookup key; its
      // sku metadata survives.
      planSku: item?.price?.lookup_key ?? item?.price?.metadata?.sku ?? undefined,
      itemId: item?.id,
      priceId: item?.price?.id,
      unitAmountMinor: item?.price?.unit_amount ?? undefined,
      quantity: item?.quantity ?? undefined,
      priceCurrency: item?.price?.currency ?? undefined,
      taxBehavior: item?.price?.tax_behavior ?? undefined,
      periodStart: paymentUtils.dateOf(period.current_period_start),
      periodEnd: paymentUtils.dateOf(period.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
      canceledAt: paymentUtils.dateOf(subscription.canceled_at),
      endedAt: paymentUtils.dateOf(subscription.ended_at),
      trialEnd: paymentUtils.dateOf(subscription.trial_end),
      latestInvoiceId: paymentUtils.idOf(subscription.latest_invoice),
      currency: subscription.currency ?? undefined,
      createdAt: paymentUtils.dateOf(subscription.created),
    }) as PaygateSubscription
  }

  const retrieve = async (subscriptionId: string): Promise<PaygateSubscription | null> => {
    try {
      return subscriptionOf(await (await access.stripe()).subscriptions.retrieve(subscriptionId))
    } catch (error) {
      if (stripeUtils.isMissingObject(error)) {
        return null
      }
      throw error
    }
  }

  const cancelNow = async (subscriptionId: string, call: PaygateCall): Promise<{ alreadyCanceled: boolean }> => {
    try {
      await (await access.stripe()).subscriptions.cancel(subscriptionId, {
        prorate: false, invoice_now: false, cancellation_details: { comment: call.comment },
      }, { idempotencyKey: call.idempotencyKey })
      return { alreadyCanceled: false }
    } catch (error) {
      if (stripeUtils.isAlreadyCanceled(error)) {
        return { alreadyCanceled: true }
      }
      throw error
    }
  }

  const scheduleCancel = async (subscriptionId: string, when: CancelSchedule, call: PaygateCall): Promise<void> => {
    const details = { comment: call.comment }
    await (await access.stripe()).subscriptions.update(subscriptionId, when.atPeriodEnd || when.at == null
      ? { cancel_at_period_end: true, cancellation_details: details }
      : { cancel_at: Math.floor(when.at.getTime() / 1000), proration_behavior: 'none', cancellation_details: details },
    { idempotencyKey: call.idempotencyKey })
  }

  return { retrieve, cancelNow, scheduleCancel, subscriptionOf }
}
