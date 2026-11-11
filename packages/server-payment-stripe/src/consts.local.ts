import { TaxType } from '@owlmeans/payment'
import type { DisputePhase, InvoiceEvent } from '@owlmeans/server-payment'

export const NON_SCALABLE_REASONS = new Set([
  'portion_product_exempt', 'portion_reduced_rated', 'portion_standard_rated', 'taxable_basis_reduced',
  'proportionally_rated',
])

export const TAX_TYPE_MAP: Readonly<Record<string, TaxType>> = Object.freeze({
  vat: TaxType.Vat, gst: TaxType.Gst, sales_tax: TaxType.SalesTax,
})

export const DISPUTE_PHASES: Record<string, DisputePhase> = {
  'charge.dispute.created': 'opened',
  'charge.dispute.funds_withdrawn': 'funds-withdrawn',
  'charge.dispute.funds_reinstated': 'funds-reinstated',
  'charge.dispute.closed': 'closed',
}

/** Countries where Stripe Tax cannot place a customer from the country alone (docs: tax/customer-locations). */
export const NEEDS_POSTAL_CODE = new Set(['US'])

export const NEEDS_POSTAL_CODE_OR_STATE = new Set(['CA', 'IN'])

/** The invoice events the host processes, and what each means. */
export const INVOICE_CHANGES: Record<string, InvoiceEvent['change']> = {
  'invoice.paid': 'paid',
  'invoice.payment_failed': 'payment-failed',
  'invoice.payment_action_required': 'action-required',
  'invoice.marked_uncollectible': 'uncollectible',
  'invoice.voided': 'voided',
}

/** The subscription events the host applies. */
export const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.pending_update_applied',
  'customer.subscription.pending_update_expired', 'customer.subscription.paused', 'customer.subscription.resumed',
  'customer.subscription.deleted', 'customer.subscription.trial_will_end',
])
