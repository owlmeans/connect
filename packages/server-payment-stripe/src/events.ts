import type Stripe from 'stripe'
import { paymentUtils, type EventInvoice, type PaygateEvent } from '@owlmeans/server-payment'
import { DISPUTE_PHASES, INVOICE_CHANGES, SUBSCRIPTION_EVENTS } from './consts.local.js'
import type { StripeAccess } from './client/types.js'
import type { StripePayments } from './payments/types.js'
import type { StripeSubscriptions } from './subscriptions/types.js'
import type { StripeEvents } from './events/types.js'
import { stripeSessionHelper } from './session.js'

type Ref = string | { id?: string } | null | undefined

/** `invoice.subscription`, top-level on the pinned API version. */
const invoiceOf = (invoice: Stripe.Invoice): EventInvoice => paymentUtils.compact({
  id: invoice.id as string,
  subscriptionId: paymentUtils.idOf((invoice as unknown as { subscription?: Ref }).subscription),
  customerId: paymentUtils.idOf(invoice.customer),
  renewal: invoice.billing_reason === 'subscription_cycle',
  attempt: invoice.attempt_count ?? undefined,
  nextAttemptAt: paymentUtils.dateOf(invoice.next_payment_attempt),
}) as EventInvoice

export const makeStripeEvents = (
  access: StripeAccess, subscriptions: StripeSubscriptions, payments: StripePayments,
): StripeEvents => {
  const translate = async (event: Stripe.Event): Promise<PaygateEvent[]> => {
    const type = event.type as string
    const object = event.data.object as unknown
    switch (type) {
      case 'customer.created':
      case 'customer.updated': {
        const customer = object as Stripe.Customer
        return [{
          type: 'customer', change: 'upserted',
          customer: paymentUtils.compact({
            id: customer.id, email: customer.email ?? undefined, name: customer.name ?? undefined,
            taxId: customer.tax_ids?.data?.[0]?.value ?? undefined,
            country: customer.address?.country ?? undefined, currency: customer.currency ?? undefined,
            metadata: { ...(customer.metadata ?? {}) },
          }) as never,
        }]
      }
      case 'customer.deleted':
        return [{ type: 'customer', change: 'deleted', customer: { id: (object as Stripe.Customer).id, metadata: {} } }]
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return [{ type: 'checkout', outcome: 'completed', session: stripeSessionHelper.snapshotOf(object as Stripe.Checkout.Session) }]
      case 'checkout.session.async_payment_failed':
        return [{ type: 'checkout', outcome: 'failed', session: stripeSessionHelper.snapshotOf(object as Stripe.Checkout.Session) }]
      case 'checkout.session.expired':
        return [{ type: 'checkout', outcome: 'expired', session: stripeSessionHelper.snapshotOf(object as Stripe.Checkout.Session) }]
      case 'charge.refunded': {
        const charge = object as Stripe.Charge
        const refunds = await (await access.stripe()).refunds.list({ charge: charge.id, limit: 100 })
        const paygateCharge = payments.chargeOf(charge)
        return refunds.data.map(refund => ({ type: 'refund', refund: payments.refundOf(refund), charge: paygateCharge }))
      }
      case 'refund.created':
      case 'refund.updated':
        return [{ type: 'refund', refund: payments.refundOf(object as Stripe.Refund) }]
      default:
        break
    }
    if (SUBSCRIPTION_EVENTS.has(type)) {
      return [{
        type: 'subscription', eventId: event.id, createdAt: new Date(event.created * 1000),
        subscription: subscriptions.subscriptionOf(object as Stripe.Subscription),
        deleted: type === 'customer.subscription.deleted',
        trialEnding: type === 'customer.subscription.trial_will_end',
      }]
    }
    const change = INVOICE_CHANGES[type]
    if (change != null) {
      return [{ type: 'invoice', eventId: event.id, change, invoice: invoiceOf(object as Stripe.Invoice) }]
    }
    const phase = DISPUTE_PHASES[type]
    if (phase != null) {
      const dispute = object as Stripe.Dispute
      return [{
        type: 'dispute', phase,
        dispute: paymentUtils.compact({
          id: dispute.id, status: dispute.status, amountMinor: dispute.amount, currency: dispute.currency,
          paymentId: paymentUtils.idOf(dispute.payment_intent), chargeId: paymentUtils.idOf(dispute.charge),
        }) as never,
      }]
    }

    return []
  }

  return { translate }
}
