import type Stripe from 'stripe'
import {
  TaxBehavior, TaxEstimateStatus, TaxType, priceEstimateHelper, type TaxEstimate, type TaxRateEstimate,
} from '@owlmeans/payment'
import type { TaxInput } from '@owlmeans/server-payment'
import { NON_SCALABLE_REASONS, TAX_TYPE_MAP } from './consts.local.js'
import type { StripeAccess } from './client/types.js'
import type { StripeTax } from './tax/types.js'
import { stripeUtils } from './utils.js'

/** A linear percentage rate scales with the amount; a flat fee, a partial exemption, or several inclusive rates do not. */
const scalableOf = (breakdown: Stripe.Tax.Calculation.TaxBreakdown[], behavior: TaxBehavior): boolean => {
  if (breakdown.some(row => row.tax_rate_details?.rate_type === 'flat_amount')) return false
  if (breakdown.some(row => NON_SCALABLE_REASONS.has(row.taxability_reason))) return false
  if (behavior === TaxBehavior.Inclusive && breakdown.length > 1) return false
  return true
}

const statusOf = (breakdown: Stripe.Tax.Calculation.TaxBreakdown[], taxMinor: number): TaxEstimateStatus => {
  if (breakdown.some(row => row.taxability_reason === 'reverse_charge')) return TaxEstimateStatus.ReverseCharge
  if (taxMinor > 0) return TaxEstimateStatus.Taxed
  if (breakdown.some(row => row.taxability_reason === 'not_supported')) return TaxEstimateStatus.AtCheckout
  return TaxEstimateStatus.None
}

const taxTypeOf = (raw: string | null | undefined): TaxType => raw != null && raw in TAX_TYPE_MAP ? TAX_TYPE_MAP[raw] : TaxType.Tax

const ratesOf = (breakdown: Stripe.Tax.Calculation.TaxBreakdown[]): TaxRateEstimate[] => breakdown
  .filter((row): row is Stripe.Tax.Calculation.TaxBreakdown & {
    tax_rate_details: NonNullable<Stripe.Tax.Calculation.TaxBreakdown['tax_rate_details']>
  } => row.tax_rate_details != null)
  .map(row => ({
    type: taxTypeOf(row.tax_rate_details.tax_type),
    percentage: row.tax_rate_details.percentage_decimal,
    ratePpm: priceEstimateHelper.ratePpmOf(row.tax_rate_details.percentage_decimal),
    ...(row.tax_rate_details.country != null ? { country: row.tax_rate_details.country } : {}),
    ...(row.tax_rate_details.state != null ? { state: row.tax_rate_details.state } : {}),
  }))

export const makeStripeTax = (access: StripeAccess): StripeTax => {
  const estimateOf = (calculation: Stripe.Tax.Calculation, behavior: TaxBehavior, subtotalMinor: number): TaxEstimate => {
    const breakdown = calculation.tax_breakdown ?? []
    const taxMinor = calculation.tax_amount_exclusive + calculation.tax_amount_inclusive
    const status = statusOf(breakdown, taxMinor)

    return {
      status, subtotalMinor, taxMinor, totalMinor: calculation.amount_total,
      scalable: scalableOf(breakdown, behavior), rates: ratesOf(breakdown),
    }
  }

  const calculate = async (input: TaxInput): Promise<TaxEstimate | null> => {
    const stripe = await access.stripe()
    try {
      const calculation = await stripe.tax.calculations.create({
        currency: input.currency,
        line_items: [{
          amount: input.amountMinor, reference: input.reference, tax_behavior: input.taxBehavior,
          ...(input.taxCode != null ? { tax_code: input.taxCode } : {}),
        }],
        customer_details: {
          address: { country: input.country },
          address_source: 'billing',
          // Cast: `Stripe.TaxId.type` (the customer's saved tax id) and the Tax Calculation parameter's
          // own tax-id-type enum are generated independently and can drift apart in the pinned SDK;
          // every value here came from a real Stripe `TaxId` record.
          ...(input.taxIds.length > 0
            ? { tax_ids: input.taxIds as Stripe.Tax.CalculationCreateParams.CustomerDetails['tax_ids'] }
            : {}),
          ...(input.exemption != null
            ? { taxability_override: input.exemption === 'exempt' ? 'customer_exempt' as const : 'reverse_charge' as const }
            : {}),
        },
      })
      return estimateOf(calculation, input.taxBehavior, input.amountMinor)
    } catch (error) {
      if (stripeUtils.isInvalidRequest(error)) return null
      throw error
    }
  }

  return { calculate, estimateOf }
}
