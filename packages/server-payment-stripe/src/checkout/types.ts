import type Stripe from 'stripe'
import type { PaygateCheckout, SessionInput } from '@owlmeans/server-payment'

/** Stripe Checkout of a context. */
export interface StripeCheckout extends PaygateCheckout {
  /**
   * The Checkout Session parameters of a host session: the line, the tax and currency options the
   * host decided (automatic tax with a required billing address — `'auto'` when the saved address is
   * kept —, tax-id collection, `customer_update`, Adaptive Pricing always sent explicitly), promotion
   * codes (amount sessions only under `amountPromotionCodes`), the terms checkbox, the custom texts,
   * `expires_at`, the metadata (and the subscription's), `invoice_creation` on one-time sessions and
   * the subscription payment methods of the charge currency.
   */
  paramsOf: (input: SessionInput) => Promise<Stripe.Checkout.SessionCreateParams>
}
