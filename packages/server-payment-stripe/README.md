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
bun add @owlmeans/server-payment-stripe@^0.2.0-alpha.0
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
npx @owlmeans/agent-skills@^0.2.0-alpha.0
```

The embedded files are version-matched to this package release. Do not edit them
directly — they are regenerated on each publish. To contribute guidance edits,
open a PR against the source monorepo.
<!-- owlmeans:agent-guidance:end -->
