import type Stripe from 'stripe'
import type { Context as ApiContext } from '@owlmeans/server-api'
import {
  consumerRecordsOf, paymentUtils, type CheckoutPage, type PaygateSession, type SessionInput,
} from '@owlmeans/server-payment'
import type { StripeAccess } from './client/types.js'
import type { StripeErrorShape } from './types.local.js'
import type { StripeCheckout } from './checkout/types.js'
import { log } from './log.js'
import { stripeSessionHelper } from './session.js'

/** The same session without the terms checkbox and its text — and saying so in its metadata. */
const withoutTerms = (params: Stripe.Checkout.SessionCreateParams): Stripe.Checkout.SessionCreateParams => {
  const { consent_collection: consent, custom_text: customText, ...rest } = params
  const { terms_of_service: _terms, ...otherConsent } = consent ?? {}
  const { terms_of_service_acceptance: _acceptance, ...otherText } = customText ?? {}
  const marked = (metadata: Stripe.MetadataParam | undefined): Stripe.MetadataParam | undefined =>
    metadata != null ? { ...metadata, termsCollected: 'false' } : metadata

  return {
    ...rest,
    ...(Object.keys(otherConsent).length > 0 ? { consent_collection: otherConsent } : {}),
    ...(Object.keys(otherText).length > 0 ? { custom_text: otherText } : {}),
    metadata: marked(rest.metadata) ?? { termsCollected: 'false' },
    ...(rest.subscription_data != null
      ? { subscription_data: { ...rest.subscription_data, metadata: marked(rest.subscription_data.metadata) ?? { termsCollected: 'false' } } }
      : {}),
  }
}

/** One console warning per context — a process builds one. */
const warnedTermsFallback = new WeakSet<object>()

export const makeStripeCheckout = (ctx: ApiContext, access: StripeAccess): StripeCheckout => {
  const paramsOf = async (input: SessionInput): Promise<Stripe.Checkout.SessionCreateParams> => {
    const pricing = await access.pricing()
    const customerUpdate: Stripe.Checkout.SessionCreateParams.CustomerUpdate = {}
    if (input.automaticTax) customerUpdate.address = input.keepAddress ? 'never' : 'auto'
    if (input.collectTaxId) customerUpdate.name = 'auto'
    const promotions = input.mode === 'amount' ? pricing?.amountPromotionCodes === true : true
    // Driven by the declared `PricingPolicy`; `customer_update.address` lets automatic tax use the
    // address Checkout just collected, `customer_update.name` lets tax-id collection save the business
    // name — unless the saved address is kept (`'never'`, collection `'auto'`).
    const options: Partial<Stripe.Checkout.SessionCreateParams> = {
      ...(input.automaticTax
        ? { automatic_tax: { enabled: true }, billing_address_collection: input.keepAddress ? 'auto' as const : 'required' as const }
        : {}),
      ...(input.collectTaxId ? { tax_id_collection: { enabled: true } } : {}),
      ...(Object.keys(customerUpdate).length > 0 ? { customer_update: customerUpdate } : {}),
      adaptive_pricing: { enabled: input.adaptiveCurrency },
      allow_promotion_codes: promotions,
    }
    const customText = paymentUtils.compact({
      ...(input.texts.submit != null ? { submit: { message: input.texts.submit } } : {}),
      ...(input.texts.afterSubmit != null ? { after_submit: { message: input.texts.afterSubmit } } : {}),
      ...(input.texts.terms != null ? { terms_of_service_acceptance: { message: input.texts.terms } } : {}),
    })
    const custom = Object.keys(customText).length > 0 ? { custom_text: customText } : {}
    const consent = input.collectTerms ? { consent_collection: { terms_of_service: 'required' as const } } : {}
    const expiry = input.expiresAt != null ? { expires_at: Math.floor(input.expiresAt.getTime() / 1000) } : {}
    const currency = input.forceCurrency ? { currency: input.currency } : {}
    const shared = {
      customer: input.customerId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...(input.locale != null ? { locale: input.locale as Stripe.Checkout.SessionCreateParams.Locale } : {}),
      metadata: input.metadata,
    }
    const line = input.line

    if (line.kind === 'amount') {
      return {
        mode: 'payment',
        line_items: [{
          price_data: { product: line.productSku, currency: line.currency, unit_amount: line.unitAmountMinor, tax_behavior: line.taxBehavior },
          quantity: 1,
        }],
        invoice_creation: { enabled: true },
        ...options, ...consent, ...custom, ...expiry, ...shared,
      }
    }
    if (line.kind === 'quantity') {
      return {
        mode: 'payment',
        line_items: [{
          price: line.priceId, adjustable_quantity: { enabled: true, minimum: line.minimum, maximum: line.maximum },
          quantity: line.default,
        }],
        invoice_creation: { enabled: true },
        ...currency, ...options, ...consent, ...custom, ...expiry, ...shared,
      }
    }
    const methods = (pricing?.subscriptionPaymentMethodTypesByCurrency?.[input.currency]
      ?? pricing?.subscriptionPaymentMethodTypes) as string[] | undefined

    return {
      mode: 'subscription',
      line_items: [{ price: line.priceId, quantity: 1 }],
      ...currency,
      ...(methods != null ? { payment_method_types: methods } : {}),
      ...custom,
      subscription_data: { metadata: input.subscriptionMetadata ?? {} },
      ...options, ...consent, ...expiry, ...shared,
    }
  }

  /**
   * A Dashboard without a terms-of-service URL must never stop a payment: the session is created
   * once more without the checkbox, an operator is told (once), and the degraded checkout is audited
   * as a `checkout-terms-fallback` event of the organization (`externalId` = the session).
   */
  const createWithoutTerms = async (
    stripe: Stripe, input: SessionInput, params: Stripe.Checkout.SessionCreateParams, refusal: unknown,
  ): Promise<Stripe.Checkout.Session> => {
    const stripeMessage = paymentUtils.errorText(refusal)
    if (!warnedTermsFallback.has(ctx)) {
      warnedTermsFallback.add(ctx)
      log.warn('Stripe refused the terms-of-service checkbox: this account has no terms of service URL. '
        + 'Checkouts continue WITHOUT the checkbox (metadata termsCollected=false). Operator: set the Billing Terms URL '
        + 'in the Stripe Dashboard → Settings → Public details (test and live mode alike).')
    }
    const typed = refusal as StripeErrorShape
    const detail = JSON.stringify(paymentUtils.compact({
      message: stripeMessage, code: typed.code ?? typed.raw?.code, param: typed.param ?? typed.raw?.param,
      mode: input.mode, productSku: input.productSku, planSku: input.planSku,
    }))
    try {
      const session = await stripe.checkout.sessions.create(withoutTerms(params))
      await consumerRecordsOf(ctx).recordEvent({
        recordId: input.entityId, recordKind: 'checkout', entityId: input.entityId, action: 'checkout-terms-fallback',
        ok: false, externalId: session.id, detail,
      })

      return session
    } catch (error) {
      await consumerRecordsOf(ctx).recordEvent({
        recordId: input.entityId, recordKind: 'checkout', entityId: input.entityId, action: 'checkout-terms-fallback',
        ok: false, detail, error: paymentUtils.errorText(error),
      })
      throw error
    }
  }

  const createSession = async (input: SessionInput): Promise<PaygateSession> => {
    const stripe = await access.stripe()
    const params = await paramsOf(input)
    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create(params)
    } catch (error) {
      if (params.consent_collection?.terms_of_service !== 'required' || !stripeSessionHelper.isMissingTermsUrl(error)) {
        throw error
      }
      session = await createWithoutTerms(stripe, input, params, error)
    }

    return { id: session.id, url: session.url ?? null }
  }

  const expireSession = async (sessionId: string): Promise<void> => {
    await (await access.stripe()).checkout.sessions.expire(sessionId)
  }

  const units = async (sessionId: string): Promise<number> => {
    const lineItems = await (await access.stripe()).checkout.sessions.listLineItems(sessionId, { limit: 100 })

    return lineItems.data.reduce((sum, line) => sum + (line.quantity ?? 0), 0)
  }

  const listCompleted = async (since: Date, cursor?: string): Promise<CheckoutPage> => {
    const page = await (await access.stripe()).checkout.sessions.list({
      created: { gte: Math.floor(since.getTime() / 1000) }, status: 'complete', limit: 100,
      ...(cursor != null ? { starting_after: cursor } : {}),
    })

    return {
      items: page.data.map(stripeSessionHelper.snapshotOf),
      ...(page.has_more && page.data.length > 0 ? { cursor: page.data[page.data.length - 1].id } : {}),
    }
  }

  return { createSession, expireSession, units, listCompleted, paramsOf }
}
