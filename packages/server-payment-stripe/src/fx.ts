import type Stripe from 'stripe'
import type { FxQuote } from '@owlmeans/server-payment'
import { STRIPE_FX_QUOTES_API_VERSION } from './consts.js'
import type { FxQuoteResponse } from './types.local.js'
import type { StripeAccess } from './client/types.js'
import type { StripeFx } from './fx/types.js'

export const makeStripeFx = (access: StripeAccess): StripeFx => {
  const quote = async (fromCurrency: string, toCurrency: string): Promise<FxQuote | null> => {
    const from = fromCurrency.toLowerCase()
    const to = toCurrency.toLowerCase()
    if (from === to) return { from, to, exchangeRate: 1, baseRate: 1, referenceRate: 1 }
    const apiVersion = (await access.pricing())?.fxApiVersion ?? STRIPE_FX_QUOTES_API_VERSION
    const response = await (await access.stripe()).rawRequest(
      'POST', '/v1/fx_quotes',
      { to_currency: to, 'from_currencies[]': from, lock_duration: 'none' },
      { apiVersion },
    ) as Stripe.Response<FxQuoteResponse>
    const rate = response.rates?.[from]
    if (rate?.exchange_rate == null) return null
    return {
      from,
      to,
      exchangeRate: rate.exchange_rate,
      baseRate: rate.rate_details?.base_rate ?? rate.exchange_rate / (1 - (rate.rate_details?.fx_fee_rate ?? 0)),
      referenceRate: rate.rate_details?.reference_rate ?? rate.rate_details?.base_rate ?? rate.exchange_rate,
      ...(rate.rate_details?.fx_fee_rate != null ? { fxFeeRate: rate.rate_details.fx_fee_rate } : {}),
    }
  }

  return { quote }
}
