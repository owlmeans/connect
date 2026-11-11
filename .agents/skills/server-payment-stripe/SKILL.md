---
name: server-payment-stripe
description: How to use @owlmeans/server-payment-stripe (OwlMeans connect) — the Stripe provider of the @owlmeans/server-payment paygate host (paygate id `stripe`). makeStripeProvider / appendStripeProvider (explicit registration, every process), stripeSecrets / portalBranding / declareStripePricing (the `_external:stripe*` records), Checkout Session parameters (tax, Adaptive Pricing, terms checkbox and its Dashboard fallback, customer e-mail and country locks, payment methods), the signed webhook and its managed endpoint, the catalogue sync (products, prices, currency_options, tax_behavior), the customer portal configuration, Stripe Tax and FX Quotes, refunds and credit notes, the pinned API version. Use when wiring Stripe into an OwlMeans backend, declaring Stripe settings, changing Stripe call parameters, or debugging a Stripe webhook, checkout, portal, sync or estimate.
user-invocable: false
---

# @owlmeans/server-payment-stripe

**Layer:** Server
**Repo:** OwlMeans connect (`@owlmeans/server-payment-stripe`) — the Stripe half; the host (the
stores, the subscription and purchase logic, consumer rights, the gates, the webhook route) is
common's `@owlmeans/server-payment` (its `server-payment` skill)
**Install:** `"@owlmeans/server-payment-stripe": "^0.2.0-alpha.0"` in `dependencies`

The provider turns the host's neutral paygate calls into Stripe SDK calls and Stripe payloads into
the host's events. It decides nothing the host owns — which plan, which paygate, the buyer's
country and currency, the plugins, the purchase, the observers — and the host never sees a Stripe
object. Every behaviour below is pinned call-by-call by `tests/golden.spec.ts` (golden records
recorded before the provider split, compared byte for byte).

## Wiring

```typescript
import { appendStripeProvider, declareStripePricing, portalBranding, stripeSecrets } from '@owlmeans/server-payment-stripe'

stripeSecrets(cfg, { api: '/secrets/stripe-key' })     // webhook secret: an optional override
portalBranding(cfg, { returnUrl: 'https://app.example.com/billing', headline: 'Example' })
declarePaymentPricing(cfg, { tax: { … }, currency: { … } })        // @owlmeans/server-payment: the advertised policy
declareStripePricing(cfg, {                            // the Stripe-only settings, backend-only
  settlementCurrency: 'eur', amountPromotionCodes: true,
  subscriptionPaymentMethodTypes: ['card', 'link', 'klarna'], subscriptionPaymentMethodTypesByCurrency: { usd: ['card', 'link'] },
  lockCustomerEmail: true, lockCustomerCountry: true,
})

appendStripeProvider(context)                          // EVERY process that registers the gateway, before or after it
appendPaymentGatewayService(context, { owner: 'app-api', webhookService: 'app-hooks' })
```

- **Explicit registration**: `appendStripeProvider(ctx, opts?)` =
  `ensurePaymentProviders(ctx).register(makeStripeProvider(opts))`; importing the package registers
  nothing. Register it in unmanaged processes too: the webhook route resolves the paygate before it
  checks `managed` (an unregistered `stripe` is `UnknownPaygate`), and the boot compares its features
  with the declared policies.
- `makeStripeProvider({ client?, pricing? })`: `client` is a `Stripe` or a `(ctx) => Promise<Stripe>`
  (default: a client pinned to `STRIPE_PINNED_API_VERSION` on the `stripeSecrets` key — a missing
  key is `PaygateError('config:stripe')` at the first call); `pricing` wins over the
  `declareStripePricing` record. Tests pass the fake as `client`.
- Records, all unchanged from 0.1: `_external:stripe` (`STRIPE_PLUGIN_CONFIG`: `api`, `webhook?`),
  `_external:stripe-portal` (`STRIPE_PORTAL_PLUGIN_CONFIG`: branding, `returnUrl`),
  `_external:stripe-pricing` (`STRIPE_PRICING_PLUGIN_CONFIG`). A value that starts with `/` is read
  from that file at boot, and a missing file fails the boot — leave `webhook` out unless it exists.
- `declareStripePricing` normalizes and validates (`stripePricingHelper.normalize`): the settlement
  currency and every method list lowercased; a currency has three letters
  (`PaymentError('pricing-policy:settlement-currency' | '…-subscription-payment-methods-currency')`),
  a method list is nonempty and unique (`'…:subscription-payment-methods'`).
- `features` (`STRIPE_FEATURES`): every policy feature, `customTextMax` 1200, `sessionTtl`
  30 min – 24 h. `settlementCurrency()` is the declared `settlementCurrency`.
- The paygate a context binds (`StripePaygate`) exposes every capability plus `access` (client and
  settings) and `events.translate(event)` — what a verified delivery answers.

## Checkout Sessions (`checkout.paramsOf`, `createSession`)

- **Amount**: one inline `price_data` item (`product` = the product sku, the charge currency, the
  amount, `tax_behavior` = the policy's), quantity 1, no `currency`. **Quantity**: the reusable price
  with `adjustable_quantity`. **Subscription**: the reusable price, quantity 1, `subscription_data.metadata`.
  One-time sessions enable `invoice_creation` (the invoice a withdrawal's credit note corrects).
- Tax and currency options exactly as the host decided: `automatic_tax` with
  `billing_address_collection: 'required'` (`'auto'` when the saved address is kept), `tax_id_collection`,
  `customer_update.address` (`'auto'`, `'never'` when kept) and `.name: 'auto'`, `adaptive_pricing.enabled`
  always sent explicitly (an omitted flag inherits the Dashboard setting).
- `allow_promotion_codes`: amount sessions only under `amountPromotionCodes`; quantity and
  subscription sessions always. Discounts reduce payment, never the selected amount.
- `currency` is set (forcing a Price's currency option) only when the host forces it — the synced
  price carries that currency; a currency the Price lacks would be refused.
- `payment_method_types` (subscriptions): `subscriptionPaymentMethodTypesByCurrency[currency]`, else
  `subscriptionPaymentMethodTypes`, else Stripe's dynamic selection. A method the account cannot
  accept in that currency rejects the whole session (Klarna on an exact USD subscription of a
  EUR-settling account).
- The terms checkbox: `consent_collection.terms_of_service: 'required'` and
  `custom_text.terms_of_service_acceptance`; `custom_text.submit` / `after_submit` from the host's
  texts; `expires_at` from the host's lifetime; `success_url`, `cancel_url`, `locale`, the metadata.
- **A missing Dashboard terms URL never breaks a payment.** Stripe refuses the checkbox then
  (`invalid_request_error`, param `consent_collection[terms_of_service]`, "You cannot collect consent
  to your terms of service unless a URL is set in the Stripe Dashboard", `stripeSessionHelper.isMissingTermsUrl`):
  the session is created ONCE more without `consent_collection` and the terms text, metadata
  `termsCollected: 'false'` (session and subscription); a `checkout-terms-fallback` consumer event
  (`recordKind: 'checkout'`, the session in `externalId`, the Stripe message in `detail`) is appended
  and one `warn` per context tells the operator. Any other refusal is not retried; a failing retry
  records its error and propagates (the host releases the plugin holds).
- `snapshotOf(session)` gives the host a `CheckoutSnapshot`: `payment_status` `paid` /
  `no_payment_required` → `paid` / `not-required`, `allow_promotion_codes`, the totals, the buyer
  (`customer_details`; `business` when a tax id was given or the buyer is reverse-charged),
  `presentment_details` (untyped by the SDK — read narrowly), `consent.terms_of_service`.

## Customers (`customers`)

- `ensure`: the entity's stored customer (`payment-paygate-customer`, paygate `stripe`) retrieved
  and updated in one call when its `preferred_locales` or (given) e-mail differ; else a new customer
  (`metadata: { entityId, profileId?, service }`) and the row. A deleted one is replaced, its row kept.
- **`lockCustomerEmail`** — the host requires `CreateLinkParams.email` and passes it; it is written
  to the customer (case-insensitively different), never as `customer_email`: Checkout shows a
  customer's valid e-mail read-only. The customer carries the LAST payer's e-mail.
- **`lockCustomerCountry`** — the host pins the known country: `setCountry(id, country, { replace: true })`
  writes a country-only address (lines and postal code cleared); `{ replace: false }` only preselects
  `address.country` on an address-less customer.
- `taxLocatable` (`stripeSessionHelper.isTaxLocatable`, Stripe's customer-locations table): a country
  alone everywhere except US (a postal code) and CA / IN (a postal code or a state). A pinned
  customer that is not locatable is not kept — Checkout collects the address.

## Subscriptions, payments, events

- `subscriptionOf`: `stripeStatusHelper.mapStatus` (`active`→Active, `trialing`→Trial,
  `past_due`→PastDue, `unpaid`/`paused`→Suspended, `incomplete`→Created, `incomplete_expired`→Ended,
  `canceled`→Canceled; paused collection is Suspended), the plan from the price's `lookup_key`, else
  its `metadata.sku` (a price recreated by the sync loses its lookup key), `current_period_*`
  top-level on the pinned API version.
- `cancelNow`: `subscriptions.cancel(id, { prorate: false, invoice_now: false, cancellation_details: { comment } }, { idempotencyKey })`;
  an already-canceled or missing subscription answers `alreadyCanceled`. `scheduleCancel`:
  `cancel_at_period_end: true`, or `cancel_at` + `proration_behavior: 'none'`.
- `refund`: `refunds.create({ payment_intent, amount, reason: 'requested_by_customer', metadata: { owlmeans: 'payment', …host metadata } }, { idempotencyKey })`;
  `findRefund` / `creditNotes.find` adopt by metadata (not failed / canceled / void).
  Credit notes: `creditNotes.preview` / `create` with one `invoice_line_item` line, the refund named
  by `refund` (`PinnedCreditNoteParams` — the newer SDK types say `refunds`), the memo, the metadata.
  An idempotency key replays a stored failure for a day: the host's retries use `…:<attempt>`.
- `events.translate(event)`: `customer.created|updated|deleted`; `checkout.session.completed` and
  `async_payment_succeeded` → `completed`, `async_payment_failed` → `failed`, `expired`;
  `customer.subscription.*` (`deleted` → `deleted`, `trial_will_end` → `trialEnding`, `created` the
  event time); `invoice.paid|payment_failed|payment_action_required|marked_uncollectible|voided`
  (`billing_reason: 'subscription_cycle'` → a renewal); `charge.refunded` lists the charge's refunds
  (one host event each, with the charge); `refund.created|updated`; `charge.dispute.created|funds_withdrawn|funds_reinstated|closed`
  → `opened|funds-withdrawn|funds-reinstated|closed`. `invoice.upcoming` and `refund.failed` answer
  nothing (the endpoint still subscribes to them, so an application can observe them without a
  Dashboard change). `invoice.subscription`, `invoice.payment_intent` and `charge.invoice` are
  top-level on the pinned version.

## Webhook (`webhook`)

- `verify(delivery, { owner })`: the `stripe-signature` header against the configured override
  secret, then the newest stored `payment-webhook` row of the owner (field-decrypted), with
  `constructEventAsync` — Bun needs the async HMAC. No raw body or signature, or none verifies:
  `PaygateSignatureError` (400); no secret at all: `WebhookSetupError('secret')`.
- `ensureEndpoint({ owner, webhookUrl })` keeps exactly one endpoint at the deployment's URL,
  subscribed to `WEBHOOK_EVENTS` on the API version read back from the client: an unchanged
  `{ url, apiVersion, events }` hash makes no call; `force` first verifies the stored endpoint exists;
  changed events update in place; a changed API version (create-only) recreates it; an endpoint at
  this URL that no row names is replaced (its secret is unknown); the owner's rows at other URLs —
  URLs this deployment left — lose their endpoints, then the rows; replicas racing to persist: the
  endpoint created last is live. Created endpoints carry `{ owlmeans: 'payment', service: <owner> }`
  and the `owlmeans:<owner>` description. Several deployments may share one account: a deployment
  deletes only what its own rows name. The secret (create-only) is stored field-encrypted where the
  database has a key.

## Catalogue sync (`catalogue.syncProduct`)

- The product is created or updated under its sku (`name`, `description`, `tax_code`,
  `unit_label` for a consumable, `metadata.sku` / `services`); per plan an active price matching the
  lookup key, amount, currency, interval and options is kept, anything else deactivated and a new
  price created (`transfer_lookup_key`, `nickname` = plan sku, `currency_options` with the declared
  `tax_behavior`, `metadata.sku`). Options are never edited in place — a subscriber keeps the Price
  they accepted. Active prices are listed with `expand: ['data.currency_options']`. An amount plan
  has no reusable price: its stale ones are deactivated.
- The declared `tax.behavior` is applied to a matching `unspecified` price IN PLACE — after checking
  the account's tax-settings default (`inferred_by_currency`: exclusive for USD/CAD) and skipping, with
  a `log.error`, when that would change existing renewals, unless `migrateUnspecifiedPrices` opts in.
  A price carrying the OPPOSITE behavior is replaced.
- `price(productSku, lookupKey)` (checkout): `prices.list({ product, active: true, lookup_keys })`, else
  `ProductError('price:<lookup key>')`.

## Portal (`portal`)

- `ensureConfiguration({ owner, webhookUrl })`: customer update (tax id; email unless
  `lockCustomerEmail`; address unless the consumer-rights `countryLock` or `lockCustomerCountry`),
  invoice history, payment method update, cancellation at period end without proration, price
  switching between the active recurring prices of every product with recurring plans sold through
  Stripe. Tagged `{ owlmeans: 'payment', service: <owner>, deployment: <webhook URL> }`; fingerprinted
  under `portal:<owner>` (catalogue incl. `currencyPrices`, tax behavior, the lock flags, the region
  currencies, the branding, the deployment key). A configuration tagged for another deployment is
  never touched — a moved URL creates a new one; without a usable row only a configuration tagged with
  exactly this owner and deployment is adopted. Stripe cannot delete configurations.
- `createSession`: the configuration the row names (ensured first when none — a failure is logged and
  the account's default serves), `flow_data` per flow (`payment_method_update`,
  `subscription_cancel`, `subscription_update`, `subscription_update_confirm` of the item to the
  active price under the lookup key — `prices.list({ lookup_keys, active: true, limit: 1 })`), the
  redirect after completion, `return_url`.

## Tax and FX

- `tax.calculate`: one Tax Calculation — **$0.05 each**; the host caches per combination for 24 h.
  `percentage_decimal` is a STRING (parsed exactly); reverse charge → `reverse-charge`, tax →
  `taxed`, `not_supported` → `at-checkout`, else `none`; scalable unless a flat fee, a partial
  exemption or several inclusive rates. The customer's tax ids of the country and its exemption
  (`taxability_override` `customer_exempt` / `reverse_charge`). An invalid-request error (a location
  Stripe cannot place) answers `null` → `at-checkout`.
- `fx.quote(from, to)`: FX Quotes, a PREVIEW endpoint (`rawRequest('POST', '/v1/fx_quotes', { to_currency, 'from_currencies[]', lock_duration: 'none' }, { apiVersion })`,
  `STRIPE_FX_QUOTES_API_VERSION` unless `fxApiVersion`), free. `exchange_rate` is fee-inclusive
  (`base_rate × (1 − fx_fee_rate)`, 2%); `reference_rate` converts catalogue amounts; Checkout's
  Adaptive Pricing charges `base_rate × (1 + fee)` with its own 2–4% (declare it as the policy's
  `currency.adaptiveFeeRate`; test mode showed 4% for PLN). The fee Stripe really applies is not
  exposed by any API — read a test-mode Checkout page ("includes N% conversion fee").

## The pinned API version

**Do not move `STRIPE_PINNED_API_VERSION`** (`2025-02-24.acacia`) alone: `current_period_*`,
`invoice.subscription`, `invoice.payment_intent` and `charge.invoice` are top-level there and move
later; credit notes link a refund by `refund`; `presentment_details` is untyped. Read them through
the narrow accessors here. Moving it recreates the stored webhook endpoints.

## Dashboard prerequisites (test and live)

A terms-of-service URL in Settings → Public details before `checkoutTerms` is on (without it every
checkout falls back to no checkbox — watch `checkout-terms-fallback` events); Checkout's
return/refund policy off or pointing at the billing terms, never "no refunds"; business name, address
and support e-mail; the "successful payments" and "refunds" customer e-mails; Stripe Tax on.

## Testing

`tests/fake-stripe.ts`: a fake SDK recording every call and its request options, failing a method's
next calls (`state.failures`), and `makeFakeContext` — `@owlmeans/test-payment`'s context with this
provider registered on the fake (`client`), `stripeSecrets` / `portalBranding` /
`declareStripePricing` declared from `webhookSecret` / `portal` / `pricing.stripe`, and
`sharedStripe` for two deployments on one account; `deliverEvent(fake, event)` applies an event the
way a verified delivery does. `tests/golden.spec.ts` replays the golden records
(`GOLDEN_UPDATE=1` rewrites them — only ever on purpose).

## External docs

- https://docs.stripe.com/api/checkout/sessions/create — `customer` prefills a valid e-mail read-only; inline `price_data`; `consent_collection.terms_of_service` needs a Dashboard terms URL; `custom_text.*` ≤ 1200 characters; `currency` forces a Price's currency option; `expires_at` 30 min – 24 h; `adaptive_pricing.enabled` defaults to the Dashboard setting when omitted.
- https://docs.stripe.com/api/checkout/sessions/object — `amount_subtotal` precedes discounts and tax; `amount_total` follows them; a free payment can omit a PaymentIntent.
- https://docs.stripe.com/payments/checkout/no-cost-orders — fulfill zero-cost orders on completion, 100%-discounted ones included.
- https://docs.stripe.com/tax/customer-locations — minimal tax location: a country alone except US (postal code), CA and IN (postal code or province); https://docs.stripe.com/tax/checkout/page — a customer with `customer_update.address: 'never'` is taxed on its saved address.
- https://docs.stripe.com/payments/checkout/localize-prices/manual-currency-prices — `currency_options` on one reusable Price; manual options override Adaptive Pricing for that currency.
- https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing — Adaptive Pricing requires the price currency to be a settlement currency; the buyer pays a 2–4% conversion fee Stripe decides.
- https://docs.stripe.com/payments/klarna — Klarna eligibility depends on currency, customer location and use case.
- https://docs.stripe.com/invoicing/multi-currency-customers — a customer's subscriptions share one currency.
- https://docs.stripe.com/invoicing/integration/programmatic-credit-notes — preview a credit note on an invoice line; link a refund with `refund`; no custom lines with automatic tax.
- https://docs.stripe.com/invoicing/dashboard/credit-notes#credit-balances-and-discounts — invoice discounts apply proportionally to credit-note lines; keep the original line basis.
- https://docs.stripe.com/api/refunds/create — an idempotency key replays the stored answer (failures too) for 24 h.
- https://docs.stripe.com/api/subscriptions/cancel and /update — `cancel(prorate, invoice_now, cancellation_details)`; `update(cancel_at_period_end | cancel_at, proration_behavior)`.
- https://docs.stripe.com/payments/checkout/receipts — one-time Checkout needs `invoice_creation.enabled`; `preferred_locales` localizes Stripe mails.
- https://docs.stripe.com/api/webhook_endpoints/create — the signing `secret` is returned only by create; `api_version` is create-only.
- https://docs.stripe.com/api/customer_portal/configurations/create — configurations are never deletable.
- https://docs.stripe.com/api/tax/calculations/create — `percentage_decimal` is a STRING.
- https://docs.stripe.com/api/fx_quotes/create and https://docs.stripe.com/currencies/localize-prices/fx-quotes-api — a PREVIEW endpoint; `exchange_rate` is fee-inclusive; `reference_rate` for settlement conversion.

## Related

- [[server-payment]] — the host: stores, subscriptions, purchases, consumer rights, gates, the webhook route (common)
- [[payment]] — the contracts (common)
- [[test-payment]] — the harness these tests build on (common)
