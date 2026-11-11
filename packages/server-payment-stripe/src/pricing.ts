import { PaymentError } from '@owlmeans/payment'
import type { StripePricingDef } from './types.js'
import type { StripePricingHelper } from './pricing/types.js'

export const createStripePricingHelper = (): StripePricingHelper => {
  const normalizeMethods = (methods: string[]): string[] => {
    const normalized = methods.map(type => type.toLowerCase())
    if (normalized.length === 0 || normalized.some(type => !/^[a-z][a-z0-9_]*$/.test(type))
      || new Set(normalized).size !== normalized.length) {
      throw new PaymentError('pricing-policy:subscription-payment-methods')
    }
    return normalized
  }

  const normalize = (def: StripePricingDef): StripePricingDef => {
    const settlementCurrency = def.settlementCurrency?.toLowerCase()
    if (settlementCurrency != null && !/^[a-z]{3}$/.test(settlementCurrency)) {
      throw new PaymentError('pricing-policy:settlement-currency')
    }
    const subscriptionPaymentMethodTypes = def.subscriptionPaymentMethodTypes != null
      ? normalizeMethods(def.subscriptionPaymentMethodTypes) : undefined
    const subscriptionPaymentMethodTypesByCurrency: Record<string, string[]> = {}
    for (const [key, methods] of Object.entries(def.subscriptionPaymentMethodTypesByCurrency ?? {})) {
      const currency = key.toLowerCase()
      if (!/^[a-z]{3}$/.test(currency) || Object.hasOwn(subscriptionPaymentMethodTypesByCurrency, currency)) {
        throw new PaymentError('pricing-policy:subscription-payment-methods-currency')
      }
      subscriptionPaymentMethodTypesByCurrency[currency] = normalizeMethods(methods)
    }

    return {
      ...def,
      ...(settlementCurrency != null ? { settlementCurrency } : {}),
      ...(subscriptionPaymentMethodTypes != null ? { subscriptionPaymentMethodTypes } : {}),
      ...(def.subscriptionPaymentMethodTypesByCurrency != null ? { subscriptionPaymentMethodTypesByCurrency } : {}),
    }
  }

  return { normalize }
}

export const stripePricingHelper = createStripePricingHelper()
