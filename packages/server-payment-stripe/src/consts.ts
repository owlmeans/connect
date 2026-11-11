import type { PaygateFeatures } from '@owlmeans/server-payment'

/** The paygate id of Stripe — stored on every record it produced and named in its webhook path (`/payment-gate/webhook/stripe`). */
export const STRIPE_PAYGATE = 'stripe'

/** The secrets record (`stripeSecrets`): the API key and the optional webhook secret override. */
export const STRIPE_PLUGIN_CONFIG = '_external:stripe'
/** The customer-portal branding record (`portalBranding`). */
export const STRIPE_PORTAL_PLUGIN_CONFIG = '_external:stripe-portal'
/**
 * The Stripe pricing settings record (`declareStripePricing`): settlement currency, payment methods,
 * customer locks, the FX Quotes version and the unspecified-price migration switch — never
 * advertised to the browser, unlike the `PricingPolicy` record itself.
 */
export const STRIPE_PRICING_PLUGIN_CONFIG = '_external:stripe-pricing'
export const STRIPE_SIGNATURE = 'Stripe-Signature'

/**
 * The Stripe API version every client of this package is pinned to (the one stripe-node 17 defaulted to).
 * Moving it re-creates the stored webhook endpoints with their payload shapes, so it moves together with
 * the readers of `current_period_*`, an invoice's subscription and a credit note's refund.
 */
export const STRIPE_PINNED_API_VERSION = '2025-02-24.acacia'

/**
 * The FX Quotes API is a Stripe PREVIEW endpoint as of this writing: it answers only a
 * `Stripe-Version` header naming a preview version, never the SDK's pinned stable one. Verify this
 * string against https://docs.stripe.com/api/fx_quotes/create before relying on it, and override it
 * with `declareStripePricing(cfg, { fxApiVersion })` once Stripe moves the API or renames the preview.
 */
export const STRIPE_FX_QUOTES_API_VERSION = '2025-07-30.preview'

/** Stripe's own bounds of a Checkout Session's `expires_at`, from now. */
export const STRIPE_SESSION_TTL_MIN_SECONDS = 30 * 60
export const STRIPE_SESSION_TTL_MAX_SECONDS = 24 * 60 * 60

/** Stripe's limit on every `custom_text` message. */
export const STRIPE_CUSTOM_TEXT_MAX = 1200

/** What a Stripe Checkout Session can carry — every policy feature the host knows. */
export const STRIPE_FEATURES: PaygateFeatures = Object.freeze({
  automaticTax: true,
  taxIdCollection: true,
  adaptiveCurrency: true,
  termsConsent: true,
  customTextMax: STRIPE_CUSTOM_TEXT_MAX,
  sessionTtl: Object.freeze({ minSeconds: STRIPE_SESSION_TTL_MIN_SECONDS, maxSeconds: STRIPE_SESSION_TTL_MAX_SECONDS }),
}) as PaygateFeatures

/**
 * The metadata every Stripe object this package creates carries (`{ owlmeans: 'payment', service }`,
 * `service` valued with the gateway's `owner`). It labels the object for an operator; several
 * deployments of one owner share it, so it never decides on its own that an object belongs to this
 * deployment.
 */
export const STRIPE_OWNER_KEY = 'owlmeans'
export const STRIPE_OWNER_VALUE = 'payment'

/**
 * The metadata key naming the ONE deployment a portal configuration belongs to, valued with that
 * deployment's webhook URL. Only an exact match lets a deployment adopt a configuration it holds no
 * fingerprint row for.
 */
export const STRIPE_DEPLOYMENT_KEY = 'deployment'

/** Fingerprint sku prefix of a portal configuration: `portal:<owner>` (the gateway's `owner`). */
export const FINGERPRINT_PORTAL = 'portal'

/**
 * Every Stripe event the managed webhook endpoint subscribes to.
 *
 * `invoice.upcoming` is enabled although nothing handles it (it carries no invoice id and nothing
 * is due), so an application can observe it without a Stripe dashboard change.
 */
export const WEBHOOK_EVENTS: readonly string[] = Object.freeze([
  'checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed', 'checkout.session.expired',
  'customer.created', 'customer.updated', 'customer.deleted',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed', 'customer.subscription.trial_will_end',
  'customer.subscription.pending_update_applied', 'customer.subscription.pending_update_expired',
  'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required', 'invoice.upcoming',
  'invoice.marked_uncollectible', 'invoice.voided',
  'charge.refunded', 'refund.created', 'refund.updated', 'refund.failed',
  'charge.dispute.created', 'charge.dispute.closed', 'charge.dispute.funds_withdrawn',
  'charge.dispute.funds_reinstated',
])
