import Stripe from 'stripe'
import { PaygateError } from '@owlmeans/payment'
import type { Context as ApiContext } from '@owlmeans/server-api'
import { paymentAccessOf } from '@owlmeans/server-payment'
import {
  STRIPE_PINNED_API_VERSION, STRIPE_PLUGIN_CONFIG, STRIPE_PORTAL_PLUGIN_CONFIG, STRIPE_PRICING_PLUGIN_CONFIG,
} from './consts.js'
import type {
  PortalBrandingConfig, StripePluginConfig, StripePricingDef, StripePricingPluginConfig, StripeProviderOptions,
} from './types.js'
import type { StripeAccess } from './client/types.js'
import { stripePricingHelper } from './pricing.js'

export const makeStripeAccess = (ctx: ApiContext, opts: StripeProviderOptions = {}): StripeAccess => {
  const access = paymentAccessOf(ctx)
  // Normalized once: options win over the declared record.
  const pricingOption = opts.pricing != null ? stripePricingHelper.normalize(opts.pricing) : null

  const secrets = async (): Promise<StripePluginConfig | null> =>
    await access.pluginConfig<StripePluginConfig>(STRIPE_PLUGIN_CONFIG)

  const stripe = async (): Promise<Stripe> => {
    if (typeof opts.client === 'function') {
      return await opts.client(ctx)
    }
    if (opts.client != null) {
      return opts.client
    }
    const declared = await secrets()
    if (declared?.api == null || declared.api === '') {
      throw new PaygateError('config:stripe')
    }

    return new Stripe(declared.api, { apiVersion: STRIPE_PINNED_API_VERSION as never })
  }

  const pricing = async (): Promise<StripePricingDef | null> =>
    pricingOption ?? await access.pluginConfig<StripePricingPluginConfig>(STRIPE_PRICING_PLUGIN_CONFIG)

  const branding = async (): Promise<PortalBrandingConfig | null> =>
    await access.pluginConfig<PortalBrandingConfig>(STRIPE_PORTAL_PLUGIN_CONFIG)

  return { stripe, pricing, secrets, branding }
}
