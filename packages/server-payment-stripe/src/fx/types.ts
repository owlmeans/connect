import type { PaygateFx } from '@owlmeans/server-payment'

/**
 * Stripe FX Quotes of a context — a PREVIEW endpoint (`rawRequest`, `STRIPE_FX_QUOTES_API_VERSION`
 * unless `fxApiVersion` overrides it): one unlocked quote per call, `reference_rate` for settlement
 * conversion, `exchange_rate` fee-inclusive (`base_rate × (1 − fx_fee_rate)`).
 */
export interface StripeFx extends PaygateFx {}
