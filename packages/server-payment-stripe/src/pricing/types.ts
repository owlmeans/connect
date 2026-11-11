import type { StripePricingDef } from '../types.js'

/** The Stripe pricing settings as they are stored — pure. */
export interface StripePricingHelper {
  /**
   * The settings normalized: the settlement currency and every payment-method list lowercased; a
   * currency must have three letters, a method list must be nonempty and unique.
   *
   * @throws PaymentError('pricing-policy:settlement-currency' | 'pricing-policy:subscription-payment-methods'
   *   | 'pricing-policy:subscription-payment-methods-currency')
   */
  normalize: (def: StripePricingDef) => StripePricingDef
}
