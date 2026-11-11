import { plugin } from '@owlmeans/config'
import type { Config } from '@owlmeans/server-payment'
import { STRIPE_PLUGIN_CONFIG, STRIPE_PORTAL_PLUGIN_CONFIG, STRIPE_PRICING_PLUGIN_CONFIG } from './consts.js'
import type { PortalBrandingDef, StripePricingDef, StripeSecretsDef } from './types.js'
import { stripePricingHelper } from './pricing.js'

/**
 * Where the Stripe secrets live (`_external:stripe`). A value that looks like a path is read into the
 * configuration at boot. The webhook secret is an optional override of the one the managed endpoint stores.
 */
export const stripeSecrets = (cfg: Config, paths: StripeSecretsDef): void => {
  plugin(cfg, {
    api: paths.api, ...(paths.webhook != null && paths.webhook !== '' ? { webhook: paths.webhook } : {}),
  }, STRIPE_PLUGIN_CONFIG)
}

/** Branding and the default return URL of the managed customer portal configuration (`_external:stripe-portal`). */
export const portalBranding = (cfg: Config, def: PortalBrandingDef): void => {
  plugin(cfg, {
    returnUrl: def.returnUrl,
    ...(def.headline != null ? { headline: def.headline } : {}),
    ...(def.privacyPolicyUrl != null ? { privacyPolicyUrl: def.privacyPolicyUrl } : {}),
    ...(def.termsOfServiceUrl != null ? { termsOfServiceUrl: def.termsOfServiceUrl } : {}),
  }, STRIPE_PORTAL_PLUGIN_CONFIG)
}

/**
 * Declare the Stripe-only pricing settings (`_external:stripe-pricing`, a backend plugin record never
 * advertised to the browser): the settlement currency, subscription payment methods (per charge
 * currency), amount promotion codes, the customer e-mail and country locks, the FX Quotes version and
 * the unspecified-price migration switch. The browser-safe policy is `declarePaymentPricing`
 * (`@owlmeans/server-payment`).
 *
 * @throws PaymentError (`stripePricingHelper.normalize`) for a malformed currency or method list
 */
export const declareStripePricing = (cfg: Config, def: StripePricingDef): void => {
  plugin(cfg, { ...stripePricingHelper.normalize(def) }, STRIPE_PRICING_PLUGIN_CONFIG)
}
