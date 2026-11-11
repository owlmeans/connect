import type Stripe from 'stripe'
import type { TaxBehavior, TaxEstimate } from '@owlmeans/payment'
import type { PaygateTax } from '@owlmeans/server-payment'

/** Stripe Tax of a context — one Tax Calculation ($0.05) per call. */
export interface StripeTax extends PaygateTax {
  /**
   * A calculation as a `TaxEstimate`: reverse charge → `reverse-charge`, tax → `taxed`, a country
   * Stripe does not cover → `at-checkout`, else `none`; scalable unless a flat fee, a partial exemption
   * or several inclusive rates; `percentage_decimal` is a string, parsed exactly.
   */
  estimateOf: (calculation: Stripe.Tax.Calculation, behavior: TaxBehavior, subtotalMinor: number) => TaxEstimate
}
