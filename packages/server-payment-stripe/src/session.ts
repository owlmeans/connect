import type Stripe from 'stripe'
import { paymentUtils, type CheckoutSnapshot } from '@owlmeans/server-payment'
import { NEEDS_POSTAL_CODE, NEEDS_POSTAL_CODE_OR_STATE } from './consts.local.js'
import type { StripeErrorShape } from './types.local.js'
import type { StripeSessionHelper } from './session/types.js'

export const createStripeSessionHelper = (): StripeSessionHelper => {
  const snapshotOf = (session: Stripe.Checkout.Session): CheckoutSnapshot => {
    const details = session.customer_details
    const presentment = (session as unknown as {
      presentment_details?: { presentment_amount?: number, presentment_currency?: string } | null
    }).presentment_details
    const terms = session.consent?.terms_of_service

    return {
      id: session.id,
      mode: session.mode === 'subscription' ? 'subscription' : session.mode === 'payment' ? 'payment' : 'other',
      ...(session.status != null ? { status: session.status } : {}),
      payment: session.payment_status === 'paid' ? 'paid'
        : session.payment_status === 'no_payment_required' ? 'not-required' : 'unpaid',
      promotionCodes: session.allow_promotion_codes === true,
      metadata: { ...(session.metadata ?? {}) },
      ...paymentUtils.compact({
        customerId: paymentUtils.idOf(session.customer),
        currency: session.currency ?? undefined,
        paymentId: paymentUtils.idOf(session.payment_intent),
        invoiceId: paymentUtils.idOf(session.invoice),
        subscriptionId: paymentUtils.idOf(session.subscription),
        createdAt: paymentUtils.dateOf(session.created),
      }),
      amountSubtotalMinor: session.amount_subtotal,
      amountTotalMinor: session.amount_total,
      amountTaxMinor: session.total_details?.amount_tax,
      amountDiscountMinor: session.total_details?.amount_discount,
      buyer: paymentUtils.compact({
        country: details?.address?.country ?? undefined,
        email: details?.email ?? undefined,
        name: details?.name ?? undefined,
        business: (details?.tax_ids?.length ?? 0) > 0 || details?.tax_exempt === 'reverse',
      }),
      ...(presentment != null ? {
        presentment: paymentUtils.compact({ currency: presentment.presentment_currency, amountMinor: presentment.presentment_amount }),
      } : {}),
      ...(terms === 'accepted' ? { termsAccepted: true } : terms != null ? { termsAccepted: false } : {}),
    }
  }

  const present = (value: string | null | undefined): boolean => value != null && value.trim() !== ''

  const isTaxLocatable = (address: Stripe.Address | null | undefined): boolean => {
    const country = address?.country?.toUpperCase()
    if (country == null || country === '') {
      return false
    }
    if (NEEDS_POSTAL_CODE.has(country)) {
      return present(address?.postal_code)
    }
    if (NEEDS_POSTAL_CODE_OR_STATE.has(country)) {
      return present(address?.postal_code) || present(address?.state)
    }

    return true
  }

  const isMissingTermsUrl = (error: unknown): boolean => {
    if (error == null || typeof error !== 'object') {
      return false
    }
    const typed = error as StripeErrorShape
    const kind = typed.rawType ?? typed.raw?.type ?? typed.type
    if (kind != null && kind !== 'invalid_request_error' && kind !== 'StripeInvalidRequestError') {
      return false
    }
    const param = (typed.param ?? typed.raw?.param ?? '').replace(/\s/g, '')
    const message = typed.message ?? typed.raw?.message ?? ''
    const aboutTerms = /terms of service/i.test(message)
    const onTermsParam = /^consent_collection(\[|\.)terms_of_service\]?$/.test(param)

    return (onTermsParam && aboutTerms) || (aboutTerms && /\burl\b/i.test(message) && /dashboard/i.test(message))
  }

  return { snapshotOf, isTaxLocatable, isMissingTermsUrl }
}

export const stripeSessionHelper = createStripeSessionHelper()
