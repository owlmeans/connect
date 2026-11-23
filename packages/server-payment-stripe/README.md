# @owlmeans/server-payment-stripe

The Stripe provider for `@owlmeans/server-payment`: Checkout Sessions, customers, subscriptions,
refunds and credit notes, the signed webhook and its managed endpoint, the catalogue sync (products,
reusable prices, currency options), the customer-portal configuration, Stripe Tax and FX Quotes.
The host — the subscription store, purchases and consumer rights, the usage ledger, the gates, the
webhook route — is `@owlmeans/server-payment`; this package only speaks Stripe. Its paygate id is
`stripe` (`STRIPE_PAYGATE`): the webhook path `/payment-gate/webhook/stripe`, purchase ids
`stripe:<id>` and every stored `paygate` value.

## Installation

```bash
bun add @owlmeans/server-payment-stripe@^0.2.3
```

## Usage

```typescript
import { appendPaymentGatewayService, declarePaymentPricing } from '@owlmeans/server-payment'
import { appendStripeProvider, declareStripePricing, portalBranding, stripeSecrets } from '@owlmeans/server-payment-stripe'

// configuration
stripeSecrets(cfg, { api: '/secrets/stripe-key', webhook: '/secrets/stripe-webhook' })   // webhook: an optional override
portalBranding(cfg, { returnUrl: 'https://app.example.com/billing', headline: 'Example' })
declarePaymentPricing(cfg, { tax: { automatic: true, collectTaxId: true, estimate: true }, currency: { adaptive: true, estimate: true } })
declareStripePricing(cfg, { settlementCurrency: 'eur', lockCustomerEmail: true, lockCustomerCountry: true })

// every process that registers the gateway
appendStripeProvider(context)
appendPaymentGatewayService(context, { owner: 'app-api', webhookService: 'app-hooks' })
```

`makeStripeProvider({ client?, pricing? })` builds the provider without registering it: `client` is
a `Stripe` instance or a `(ctx) => Promise<Stripe>` (default: a client pinned to
`STRIPE_PINNED_API_VERSION` on the declared key), `pricing` wins over the `declareStripePricing`
record.

## Concepts

- **Explicit registration** — `appendStripeProvider(ctx)` registers the provider in the context's
  payment providers (`ensurePaymentProviders`); importing the package registers nothing.
- **Records** — `_external:stripe` (the key, the webhook override), `_external:stripe-portal` (the
  portal branding) and `_external:stripe-pricing` (settlement currency, subscription payment methods
  per charge currency, amount promotion codes, customer e-mail and country locks, the FX Quotes
  version, the unspecified-price migration switch) — backend-only, never advertised.
- **Byte-identical Stripe behaviour** — the call parameters, metadata keys, idempotency keys, event
  keys, purchase ids, the webhook URL and the product and portal fingerprints are those of
  `@owlmeans/server-payment` 0.1, pinned by golden records.
- **The pinned API version** — `2025-02-24.acacia`: the payload readers and the stored webhook
  endpoints depend on it; move it together with them.

## API

| Export | Description |
|---|---|
| `appendStripeProvider(ctx, options?)` | Register the provider in `ensurePaymentProviders(ctx)` of `@owlmeans/server-payment`; returns the context |
| `makeStripeProvider({ client?, pricing? }?)` | The `PaymentProvider` (id `stripe`, `STRIPE_FEATURES`) without registering it; `bind(ctx)` answers a `StripePaygate` |
| `stripeSecrets(cfg, { api, webhook? })` | The `_external:stripe` record: the API key and the optional webhook secret override (paths are read at boot) |
| `portalBranding(cfg, { returnUrl, headline?, privacyPolicyUrl?, termsOfServiceUrl? })` | The `_external:stripe-portal` record of the managed customer portal configuration |
| `declareStripePricing(cfg, def)` | The `_external:stripe-pricing` record: settlement currency, subscription payment methods, amount promotion codes, customer e-mail and country locks, the FX Quotes version, the unspecified-price migration switch |
| `makeStripeAccess(ctx, options?)` | One context's client and declared settings: `stripe()`, `pricing()`, `secrets()`, `branding()` |
| `makeStripeCustomers(ctx, access)`, `makeStripeCheckout(ctx, access)`, `makeStripeSubscriptions(access)`, `makeStripePayments(access)` | The paygate's customers, Checkout Sessions (`paramsOf`), subscriptions and charges, invoices, refunds and credit notes |
| `makeStripeEvents(access, subscriptions, payments)`, `makeStripeWebhook(ctx, access, events)` | A Stripe event translated into host events; the managed webhook endpoint, its secrets and delivery verification |
| `makeStripeCatalogue(access)`, `makeStripePortal(ctx, access)`, `makeStripeTax(access)`, `makeStripeFx(access)` | The catalogue sync, the customer portal, Stripe Tax estimates and FX Quotes |
| `createStripeSessionHelper()`, `stripeSessionHelper` | Pure reads of a Checkout Session: `snapshotOf`, `isTaxLocatable`, `isMissingTermsUrl` |
| `createStripeStatusHelper()`, `stripeStatusHelper` | A subscription's status in the host's terms: `mapStatus`, `isPaused` |
| `createStripePricingHelper()`, `stripePricingHelper` | `normalize(def)` — the pricing settings lowercased and validated |
| `createStripeUtils()`, `stripeUtils` | `apiVersionOf`, `isMissingObject`, `isAlreadyCanceled`, `isInvalidRequest`, `metadataMatches` |
| `STRIPE_PAYGATE` | `'stripe'` |
| `STRIPE_PLUGIN_CONFIG`, `STRIPE_PORTAL_PLUGIN_CONFIG`, `STRIPE_PRICING_PLUGIN_CONFIG` | `'_external:stripe'`, `'_external:stripe-portal'`, `'_external:stripe-pricing'` |
| `STRIPE_PINNED_API_VERSION`, `STRIPE_FX_QUOTES_API_VERSION` | `'2025-02-24.acacia'`, `'2025-07-30.preview'` |
| `STRIPE_FEATURES`, `STRIPE_SESSION_TTL_MIN_SECONDS`, `STRIPE_SESSION_TTL_MAX_SECONDS`, `STRIPE_CUSTOM_TEXT_MAX` | What a Checkout Session can carry: 30 min…24 h expiry, 1200-character custom texts |
| `WEBHOOK_EVENTS`, `STRIPE_SIGNATURE` | The events the managed endpoint subscribes to; `'Stripe-Signature'` |
| `STRIPE_OWNER_KEY`, `STRIPE_OWNER_VALUE`, `STRIPE_DEPLOYMENT_KEY`, `FINGERPRINT_PORTAL` | The metadata and fingerprint keys of the objects this package creates |
| `StripeProviderOptions`, `StripeFactory`, `StripeSecretsDef`, `StripePluginConfig`, `StripePricingDef`, `StripePricingPluginConfig`, `PortalBrandingDef`, `PortalBrandingConfig` | Configuration types |
| `StripePaygate`, `StripeAccess`, `StripeCustomers`, `StripeCheckout`, `StripeSubscriptions`, `StripePayments`, `StripeEvents`, `StripeWebhook`, `StripeCatalogue`, `StripePortal`, `StripeTax`, `StripeFx`, `StripeSessionHelper`, `StripeStatusHelper`, `StripePricingHelper`, `StripeUtils` | Capability and helper types |

## Testing

`tests/fake-stripe.ts` is a recording fake Stripe SDK plus the `@owlmeans/test-payment` context with
this provider on it; `tests/golden.spec.ts` replays the golden records.

## Related

- `@owlmeans/server-payment` — the paygate host
- `@owlmeans/payment` — the contracts
- `@owlmeans/test-payment` — the payment test harness

## License

MIT

<!-- owlmeans:agent-guidance:start -->
## Agent guidance

This package ships embedded agent skills under `agent-meta/`. After installing your
`@owlmeans/*` packages, run the OwlMeans agent-skills installer to place them into
your project's skill store (`.agents/skills/`):

```sh
npx @owlmeans/agent-skills@^0.2.3
```

The embedded files are version-matched to this package release. Do not edit them
directly — they are regenerated on each publish. To contribute guidance edits,
open a PR against the source monorepo.
<!-- owlmeans:agent-guidance:end -->
