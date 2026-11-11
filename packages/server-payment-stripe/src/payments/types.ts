import type Stripe from 'stripe'
import type { PaygateCharge, PaygateInvoice, PaygatePayments, PaygateRefund } from '@owlmeans/server-payment'

/** The Stripe charges, invoices, refunds and credit notes of a context. */
export interface StripePayments extends PaygatePayments {
  /** `charge.invoice` is top-level on the pinned API version. */
  chargeOf: (charge: Stripe.Charge) => PaygateCharge
  /** `invoice.payment_intent`, `invoice.subscription` and `invoice.tax` are top-level on the pinned API version. */
  invoiceOf: (invoice: Stripe.Invoice) => PaygateInvoice
  refundOf: (refund: Stripe.Refund) => PaygateRefund
}
