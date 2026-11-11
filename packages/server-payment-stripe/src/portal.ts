import { createHash } from 'node:crypto'
import type Stripe from 'stripe'
import { PortalFlow, PortalUnavailable, ProductError } from '@owlmeans/payment'
import type { Context as ApiContext } from '@owlmeans/server-api'
import {
  catalogueOf, paymentAccessOf, planHelper, type PaygateDeployment, type PaymentProduct, type PortalSessionInput,
} from '@owlmeans/server-payment'
import {
  FINGERPRINT_PORTAL, STRIPE_DEPLOYMENT_KEY, STRIPE_OWNER_KEY, STRIPE_OWNER_VALUE, STRIPE_PAYGATE,
} from './consts.js'
import type { Claim, ConfigurationParams } from './types.local.js'
import type { StripeAccess } from './client/types.js'
import type { StripePortal } from './portal/types.js'
import { log } from './log.js'
import { stripeUtils } from './utils.js'

/** The fingerprint sku of an owner's portal configuration: `portal:<owner>`. */
const portalFingerprintSku = (owner: string): string => `${FINGERPRINT_PORTAL}:${owner}`

/**
 * Whose a configuration is by its metadata: `ours` carries this owner AND this deployment's key;
 * `foreign` is tagged for another deployment or another owner; `unclaimed` names no deployment.
 */
const claimOf = (metadata: Stripe.Metadata | null | undefined, owner: string, deployment: string): Claim => {
  const owned = metadata?.[STRIPE_OWNER_KEY] === STRIPE_OWNER_VALUE
  const tagged = metadata?.[STRIPE_DEPLOYMENT_KEY]
  if (owned && metadata?.service === owner && tagged === deployment) {
    return 'ours'
  }
  if ((owned && metadata?.service !== owner) || (tagged != null && tagged !== '')) {
    return 'foreign'
  }

  return 'unclaimed'
}

export const makeStripePortal = (ctx: ApiContext, access: StripeAccess): StripePortal => {
  const payments = paymentAccessOf(ctx)

  /** The recurring plans sold through Stripe, per product — what the portal may switch between. */
  const recurringCatalog = async (): Promise<Array<{ product: PaymentProduct, lookupKeys: string[], hashable: unknown[] }>> => {
    // The declared tax behavior decides which Stripe price id the catalogue sync keeps for a plan (an
    // in-place `unspecified` update keeps it, an opposite behavior replaces it) — hashed here too,
    // so a behavior change refreshes this configuration's `products[].prices` to the new ids.
    const behavior = (await payments.payment().pricingPolicy()).tax.behavior ?? null
    const result: Array<{ product: PaymentProduct, lookupKeys: string[], hashable: unknown[] }> = []
    for (const { product, plans } of await catalogueOf(ctx).plansSoldThrough(STRIPE_PAYGATE)) {
      const recurring = plans.filter(plan => plan.recurring != null)
      if (recurring.length === 0) {
        continue
      }
      result.push({
        product,
        lookupKeys: recurring.map(plan => planHelper.planLookupKey(product, plan)),
        hashable: recurring.map(plan => ({
          sku: plan.sku, price: plan.price, currency: plan.currency ?? 'usd', interval: plan.recurring?.interval,
          rank: planHelper.planRank(plan), behavior,
          // A changed currency option replaces the Price — the portal's price list must follow it.
          ...(plan.currencyPrices != null ? { currencyPrices: plan.currencyPrices } : {}),
        })).sort((a, b) => a.sku.localeCompare(b.sku)),
      })
    }

    return result.sort((a, b) => a.product.sku.localeCompare(b.product.sku))
  }

  const activeRecurringPrices = async (stripe: Stripe, productSku: string): Promise<Stripe.Price[]> =>
    (await stripe.prices.list({ product: productSku, active: true, limit: 100 })).data
      .filter(price => price.recurring != null)

  const listActiveConfigurations = async (stripe: Stripe): Promise<Stripe.BillingPortal.Configuration[]> => {
    const configurations: Stripe.BillingPortal.Configuration[] = []
    let startingAfter: string | undefined
    for (;;) {
      const page = await stripe.billingPortal.configurations.list({
        active: true, limit: 100, ...(startingAfter != null ? { starting_after: startingAfter } : {}),
      })
      configurations.push(...page.data)
      if (!page.has_more || page.data.length === 0) {
        return configurations
      }
      startingAfter = page.data[page.data.length - 1].id
    }
  }

  /**
   * Keep this deployment's own Stripe customer-portal configuration: customer, invoice and payment
   * method self-service, cancellation at period end, and switching between the active recurring
   * prices of every product sold through Stripe (both subscription features off when there are none).
   * The customer may edit their tax id always, their e-mail unless `lockCustomerEmail`, their address
   * unless the consumer-rights `countryLock` or `lockCustomerCountry`.
   *
   * A deployment's identity is its webhook URL — also when that URL is undeliverable, as on a local
   * run; its fingerprint row and label carry the owner. Several deployments of one application may
   * share a Stripe account, so each owns a configuration of its own, tagged
   * `{ owlmeans: 'payment', service: <owner>, deployment: <webhook URL> }`:
   *
   * - an unchanged declaration (catalogue, branding, locks, region currencies, deployment key) makes
   *   no Stripe call;
   * - the configuration the `portal:<owner>` fingerprint row names is updated in place — unless its
   *   metadata tags it for another deployment, which is never overwritten;
   * - without a usable row, an active configuration tagged with exactly this owner and deployment key
   *   is adopted; nothing else is;
   * - otherwise a new configuration is created (Stripe cannot delete one).
   */
  const ensureConfiguration = async (
    deployment: PaygateDeployment, opts: { force?: boolean } = {},
  ): Promise<string | null> => {
    const stripe = await access.stripe()
    const owner = deployment.owner
    const url = deployment.webhookUrl
    const sku = portalFingerprintSku(owner)
    const branding = await access.branding()
    const catalog = await recurringCatalog()
    const rights = await payments.payment().consumerRightsPolicy()
    // A locked billing country is never edited in the portal: tax follows the saved address.
    const pricing = await access.pricing()
    const countryLock = rights?.mechanisms.countryLock === true
    // A pinned country and a locked customer e-mail are the application's: never edited in the portal.
    const countryPin = pricing?.lockCustomerCountry === true
    const emailLock = pricing?.lockCustomerEmail === true
    const regionCurrencies = Object.values(rights?.currencies ?? {}).filter(code => code != null).sort()
    const hash = createHash('sha256').update(JSON.stringify({
      service: owner,
      deployment: url,
      ...(countryLock ? { countryLock } : {}),
      ...(countryPin ? { countryPin } : {}),
      ...(emailLock ? { emailLock } : {}),
      ...(regionCurrencies.length > 0 ? { regionCurrencies } : {}),
      branding: branding != null ? {
        headline: branding.headline ?? null, privacyPolicyUrl: branding.privacyPolicyUrl ?? null,
        termsOfServiceUrl: branding.termsOfServiceUrl ?? null, returnUrl: branding.returnUrl ?? null,
      } : null,
      products: catalog.map(entry => ({ product: entry.product.sku, plans: entry.hashable })),
    })).digest('hex')

    const stored = await payments.fingerprints().bySku(sku)
    if (stored != null && stored.hash === hash && stored.externalId != null && opts.force !== true) {
      return stored.externalId
    }

    const products: Array<{ product: string, prices: string[] }> = []
    for (const entry of catalog) {
      const prices = (await activeRecurringPrices(stripe, entry.product.sku)).map(price => price.id)
      if (prices.length > 0) {
        products.push({ product: entry.product.sku, prices })
      }
    }
    const cancelable = catalog.length > 0
    const switchable = products.length > 0
    const metadata = { [STRIPE_OWNER_KEY]: STRIPE_OWNER_VALUE, service: owner, [STRIPE_DEPLOYMENT_KEY]: url }
    const allowedUpdates: Stripe.BillingPortal.ConfigurationCreateParams.Features.CustomerUpdate.AllowedUpdate[] = [
      ...(emailLock ? [] : ['email' as const]), ...(countryLock || countryPin ? [] : ['address' as const]), 'tax_id',
    ]
    const params: ConfigurationParams = {
      features: {
        customer_update: { enabled: true, allowed_updates: allowedUpdates },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: cancelable
          ? { enabled: true, mode: 'at_period_end', proration_behavior: 'none' }
          : { enabled: false },
        subscription_update: switchable
          ? {
            enabled: true, default_allowed_updates: ['price'], products,
            proration_behavior: 'create_prorations',
          }
          : { enabled: false },
      },
      ...(branding != null ? {
        business_profile: {
          ...(branding.headline != null ? { headline: branding.headline } : {}),
          ...(branding.privacyPolicyUrl != null ? { privacy_policy_url: branding.privacyPolicyUrl } : {}),
          ...(branding.termsOfServiceUrl != null ? { terms_of_service_url: branding.termsOfServiceUrl } : {}),
        },
        default_return_url: branding.returnUrl,
      } : {}),
      metadata,
    }

    let configurationId: string | null = null
    if (stored?.externalId != null) {
      try {
        const current = await stripe.billingPortal.configurations.retrieve(stored.externalId)
        if (claimOf(current.metadata, owner, url) !== 'foreign') {
          await stripe.billingPortal.configurations.update(current.id, params)
          configurationId = current.id
        }
      } catch (error) {
        if (!stripeUtils.isMissingObject(error)) {
          throw error
        }
      }
    }
    if (configurationId == null) {
      const existing = (await listActiveConfigurations(stripe))
        .find(configuration => claimOf(configuration.metadata, owner, url) === 'ours')
      if (existing != null) {
        await stripe.billingPortal.configurations.update(existing.id, params)
        configurationId = existing.id
      } else {
        configurationId = (await stripe.billingPortal.configurations.create(params)).id
      }
    }

    const now = new Date()
    if (stored != null) {
      await payments.fingerprints().update({ ...stored, hash, externalId: configurationId, updatedAt: now })
    } else {
      await payments.fingerprints().create({ sku, hash, externalId: configurationId, updatedAt: now })
    }

    return configurationId
  }

  /**
   * A Stripe customer-portal session: the deployment's configuration (ensured first when no row names
   * one; a failure is logged and the account's default configuration serves), and the flow — `Manage`
   * the portal home, `PaymentMethod` the payment method form, `Cancel` / `Update` the subscription,
   * `Change` a confirmed switch of its item to the active price under `lookupKey`.
   *
   * @throws ProductError('price:<lookup key>') | PortalUnavailable('item')
   */
  const createSession = async (input: PortalSessionInput): Promise<string> => {
    const stripe = await access.stripe()
    const sku = portalFingerprintSku(input.owner)
    let configuration = (await payments.fingerprints().bySku(sku))?.externalId ?? null
    if (configuration == null) {
      await (async () => await ensureConfiguration(input.deployment()))().catch(error => {
        log.error('Portal configuration unavailable', error)
      })
      configuration = (await payments.fingerprints().bySku(sku))?.externalId ?? null
    }

    let flowData: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined
    switch (input.flow) {
      case PortalFlow.Manage:
        break
      case PortalFlow.PaymentMethod:
        flowData = { type: 'payment_method_update' }
        break
      case PortalFlow.Cancel:
        flowData = { type: 'subscription_cancel', subscription_cancel: { subscription: input.subscriptionId as string } }
        break
      case PortalFlow.Update:
        flowData = { type: 'subscription_update', subscription_update: { subscription: input.subscriptionId as string } }
        break
      case PortalFlow.Change: {
        if (input.itemId == null || input.lookupKey == null) {
          throw new PortalUnavailable('item')
        }
        const [price] = (await stripe.prices.list({ lookup_keys: [input.lookupKey], active: true, limit: 1 })).data
        if (price == null) {
          throw new ProductError(`price:${input.lookupKey}`)
        }
        flowData = {
          type: 'subscription_update_confirm',
          subscription_update_confirm: {
            subscription: input.subscriptionId as string,
            items: [{ id: input.itemId, price: price.id, quantity: 1 }],
          },
        }
        break
      }
      default:
        throw new PortalUnavailable(`flow:${String(input.flow)}`)
    }
    if (flowData != null) {
      flowData.after_completion = { type: 'redirect', redirect: { return_url: input.returnUrl } }
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
      ...(configuration != null ? { configuration } : {}),
      ...(flowData != null ? { flow_data: flowData } : {}),
    })

    return session.url
  }

  return { ensureConfiguration, createSession, portalFingerprintSku }
}
