import type Stripe from 'stripe'
import type { PortalBrandingConfig, StripePluginConfig, StripePricingDef } from '../types.js'

/** What one context's Stripe paygate reads: its client and its declared settings. */
export interface StripeAccess {
  /**
   * The client every call uses: the provider's `client` option, else one pinned to
   * {@link STRIPE_PINNED_API_VERSION} on the declared key — the API version this package's payload
   * readers, the stored webhook endpoints and the test doubles are written for. The installed SDK is
   * typed for a newer one, so a read of a field the newer version moved (a subscription's period, an
   * invoice's subscription) is cast at the seam until the readers are migrated.
   *
   * @throws PaygateError('config:stripe') when neither a client nor `stripeSecrets` is declared
   */
  stripe: () => Promise<Stripe>
  /** The pricing settings: the provider's `pricing` option, else the `declareStripePricing` record, or `null`. */
  pricing: () => Promise<StripePricingDef | null>
  /** The secrets declared with `stripeSecrets`, or `null`. */
  secrets: () => Promise<StripePluginConfig | null>
  /** The portal branding declared with `portalBranding`, or `null`. */
  branding: () => Promise<PortalBrandingConfig | null>
}
