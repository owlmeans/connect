import type Stripe from 'stripe'

export interface StripeErrorShape {
  type?: string
  rawType?: string
  code?: string
  param?: string
  message?: string
  raw?: { type?: string, code?: string, param?: string, message?: string }
}

export interface FxQuoteResponse {
  rates?: Record<string, {
    exchange_rate?: number
    rate_details?: { base_rate?: number; fx_fee_rate?: number; reference_rate?: number }
  }>
}

export type ConfigurationParams = Stripe.BillingPortal.ConfigurationCreateParams

/** Whose a portal configuration is by its metadata. */
export type Claim = 'ours' | 'foreign' | 'unclaimed'

/**
 * A credit note's creation parameters in the API version the client is pinned to: the refund it corrects
 * is named by `refund` there, where the installed SDK's types (a newer version) list `refunds`.
 */
export interface PinnedCreditNoteParams extends Stripe.CreditNoteCreateParams { refund?: string }
