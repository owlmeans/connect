import type Stripe from 'stripe'
import type { PluginConfig } from '@owlmeans/config'
import type { Context as ApiContext } from '@owlmeans/server-api'

/** File paths (or values) of the Stripe secrets. The webhook secret is an optional override. */
export interface StripeSecretsDef { api: string; webhook?: string }
export interface StripePluginConfig extends PluginConfig { api: string; webhook?: string }

/** Stripe-only pricing settings — never a browser-visible field (see `PricingPolicy` for those). */
export interface StripePricingDef {
  /** Enable promotion-code entry on amount checkouts; absent/false keeps it disabled. */
  amountPromotionCodes?: boolean
  /** Overrides `STRIPE_FX_QUOTES_API_VERSION`, when Stripe moves or renames the preview. */
  fxApiVersion?: string
  /**
   * Stripe settlement currency used when a catalogue price is declared in another currency.
   * Recurring prices are converted during product sync; amount checkout is converted per session.
   */
  settlementCurrency?: string
  /** Explicit Stripe payment methods for subscription Checkout; absent keeps Stripe's dynamic selection. */
  subscriptionPaymentMethodTypes?: string[]
  /** Payment methods for a specific subscription charge currency; overrides the default list. */
  subscriptionPaymentMethodTypesByCurrency?: Record<string, string[]>
  /**
   * Let a matching `unspecified` price take the declared `tax.behavior` even when the Stripe
   * account's own tax-settings default resolves to the opposite one — which changes what an
   * existing subscriber is charged at their next renewal. Absent/`false`: such a price is left
   * `unspecified` and a `log.error` explains why.
   */
  migrateUnspecifiedPrices?: boolean
  /**
   * The Stripe customer's e-mail is the application's: every checkout must pass
   * `CreateLinkParams.email` (else `PaygateError('customer-email')`), which is written to the
   * customer before the session — Checkout shows a customer's valid e-mail read-only, so no other
   * address can be typed — and the portal configuration never offers to edit it.
   */
  lockCustomerEmail?: boolean
  /**
   * The billing country a checkout knows — the locked profile's, else `CreateLinkParams.country` —
   * is pinned on the Stripe customer (replacing a saved address of another country before any lock)
   * and Checkout never collects another (`customer_update.address: 'never'`, collection `'auto'`):
   * tax is calculated on it whatever the card form's "Country or region" says, the first completed
   * purchase locks it, and the portal never offers to edit the address. Where Stripe Tax needs more
   * than a country (US: a postal code; CA, IN: a postal code or province) and the customer carries
   * none, Checkout still collects the address — Stripe refuses a session otherwise.
   */
  lockCustomerCountry?: boolean
}
export interface StripePricingPluginConfig extends PluginConfig, StripePricingDef {}

/** What the managed customer portal configuration shows. */
export interface PortalBrandingDef {
  headline?: string
  privacyPolicyUrl?: string
  termsOfServiceUrl?: string
  /** Where the portal's "return" link leads when a session names none. Absolute URL. */
  returnUrl: string
}
export interface PortalBrandingConfig extends PluginConfig, PortalBrandingDef {}

/** A Stripe client for one context. */
export interface StripeFactory { (ctx: ApiContext): Promise<Stripe> }

export interface StripeProviderOptions {
  /** The client every call uses. Default: one pinned to `STRIPE_PINNED_API_VERSION` on the `stripeSecrets` key. */
  client?: Stripe | StripeFactory
  /** The pricing settings. Default: the `declareStripePricing` record; given, they win over it. */
  pricing?: StripePricingDef
}
