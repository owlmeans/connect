import type Stripe from 'stripe'
import { CheckoutPricingMode, ProductError, ProductType, TaxBehavior } from '@owlmeans/payment'
import type {
  CataloguePlan, CatalogueSync, PaygatePrice, PaymentPlan, PaymentProduct, SyncedPriceOption,
} from '@owlmeans/server-payment'
import type { StripeAccess } from './client/types.js'
import type { StripeCatalogue } from './catalogue/types.js'
import { log } from './log.js'

/** A price's `currency_options` besides its default currency (read only once expanded). */
const priceOptionsOf = (price: Stripe.Price): Record<string, { unit_amount?: number | null, tax_behavior?: string | null }> =>
  Object.fromEntries(Object.entries(price.currency_options ?? {}).filter(([code]) => code !== price.currency))

/** Whether a price carries exactly these options (and, with a declared behavior, with that behavior). */
const optionsMatch = (price: Stripe.Price, options: SyncedPriceOption[], behavior: TaxBehavior | null): boolean => {
  const current = priceOptionsOf(price)
  if (Object.keys(current).length !== options.length) {
    return false
  }

  return options.every(option => current[option.currency]?.unit_amount === option.unitAmount
    && (behavior == null || current[option.currency]?.tax_behavior == null
      || current[option.currency]?.tax_behavior === 'unspecified' || current[option.currency]?.tax_behavior === behavior))
}

/** Whether `price` already carries the OPPOSITE of `behavior` — never `unspecified`, which is not a conflict. */
const opposesBehavior = (price: Stripe.Price, behavior: TaxBehavior | null): boolean =>
  behavior != null && price.tax_behavior !== 'unspecified' && price.tax_behavior !== behavior

export const makeStripeCatalogue = (access: StripeAccess): StripeCatalogue => {
  const priceOf = (price: Stripe.Price): PaygatePrice => ({
    id: price.id,
    currency: price.currency,
    ...(price.unit_amount != null ? { unitAmountMinor: price.unit_amount } : {}),
    options: Object.fromEntries(Object.entries(
      (price as unknown as { currency_options?: Record<string, { unit_amount?: number | null }> }).currency_options ?? {},
    ).map(([code, option]) => [code, option?.unit_amount != null ? { unitAmountMinor: option.unit_amount } : {}])),
  })

  const price = async (productSku: string, lookupKey: string): Promise<PaygatePrice> => {
    const prices = await (await access.stripe()).prices.list({ product: productSku, active: true, lookup_keys: [lookupKey] })
    if (prices.data.length === 0) throw new ProductError(`price:${lookupKey}`)
    return priceOf(prices.data[0])
  }

  const ensureStripeProduct = async (stripe: Stripe, product: PaymentProduct): Promise<Stripe.Product> => {
    const params: Stripe.ProductCreateParams = {
      name: product.title, description: product.description || undefined, tax_code: product.taxCode,
      active: true,
      metadata: { sku: product.sku, ...(product.services && { services: product.services.join(',') }) },
    }
    if (product.type === ProductType.Consumable && product.unitLabel != null) params.unit_label = product.unitLabel
    try {
      await stripe.products.retrieve(product.sku)
      return await stripe.products.update(product.sku, params)
    } catch {
      return await stripe.products.create({ id: product.sku, ...params })
    }
  }

  const activePrices = async (stripe: Stripe, product: PaymentProduct): Promise<Stripe.Price[]> =>
    (await stripe.prices.list({ product: product.sku, active: true, limit: 100, expand: ['data.currency_options'] })).data

  const deactivateAmountPrice = async (stripe: Stripe, product: PaymentProduct, lookupKey: string): Promise<void> => {
    for (const entry of (await activePrices(stripe, product)).filter(item => item.lookup_key === lookupKey)) {
      await stripe.prices.update(entry.id, { active: false })
    }
  }

  /**
   * The behavior the Stripe account's own Tax Settings resolve to for `currency`, or `null` when no
   * default is configured yet (nothing established to disrupt). `inferred_by_currency` follows
   * Stripe's own rule: exclusive for USD/CAD, inclusive otherwise.
   */
  const accountDefaultBehavior = async (stripe: Stripe, currency: string): Promise<TaxBehavior | null> => {
    const { defaults } = await stripe.tax.settings.retrieve()
    if (defaults.tax_behavior === 'inferred_by_currency') {
      return ['usd', 'cad'].includes(currency.toLowerCase()) ? TaxBehavior.Exclusive : TaxBehavior.Inclusive
    }
    if (defaults.tax_behavior === 'exclusive') return TaxBehavior.Exclusive
    if (defaults.tax_behavior === 'inclusive') return TaxBehavior.Inclusive
    return null
  }

  /**
   * Give `price` the declared `behavior` while it is still `unspecified` (the only state Stripe lets
   * an existing price's `tax_behavior` be set from). Skipped, with a `log.error`, when the account's
   * own default resolves to the opposite behavior — applying ours would then change what an existing
   * renewal actually charges — unless `migrateUnspecifiedPrices` opts into that migration.
   */
  const applyUnspecifiedBehavior = async (
    stripe: Stripe, entry: Stripe.Price, lookupKey: string, behavior: TaxBehavior, migrateUnspecifiedPrices: boolean,
  ): Promise<void> => {
    if (!migrateUnspecifiedPrices) {
      const resolved = await accountDefaultBehavior(stripe, entry.currency)
      if (resolved != null && resolved !== behavior) {
        log.error(
          'Price left unspecified: the Stripe account\'s default tax behavior differs from the declared one — '
          + 'applying it would change existing renewal amounts; set `migrateUnspecifiedPrices` to override',
          { lookupKey, currency: entry.currency, accountBehavior: resolved, declaredBehavior: behavior },
        )
        return
      }
    }
    await stripe.prices.update(entry.id, { tax_behavior: behavior })
  }

  const ensureStripePrice = async (
    stripe: Stripe, product: PaymentProduct, resolved: CataloguePlan,
    behavior: TaxBehavior | null, migrateUnspecifiedPrices: boolean,
  ): Promise<Stripe.Price | null> => {
    const { plan, unitAmountMinor: unitAmount, currency, options, lookupKey } = resolved
    if (plan.pricingMode === CheckoutPricingMode.Amount) {
      await deactivateAmountPrice(stripe, product, lookupKey)
      return null
    }
    const recurring = plan.recurring != null
      ? { interval: plan.recurring.interval } as Stripe.PriceCreateParams.Recurring : undefined
    const existing = await activePrices(stripe, product)
    const candidate = existing.find(entry => entry.lookup_key === lookupKey && entry.unit_amount === unitAmount
      && entry.currency === currency
      && ((entry.recurring?.interval ?? null) === (recurring?.interval ?? null))
      && optionsMatch(entry, options, behavior))
    if (candidate != null && !opposesBehavior(candidate, behavior)) {
      if (behavior != null && candidate.tax_behavior === 'unspecified') {
        await applyUnspecifiedBehavior(stripe, candidate, lookupKey, behavior, migrateUnspecifiedPrices)
      }
      return candidate
    }
    // A changed option replaces the Price like any other change — options are never edited in place,
    // so a subscriber keeps exactly the Price (and currency amounts) they accepted.
    for (const entry of existing.filter(item => item.lookup_key === lookupKey)) {
      await stripe.prices.update(entry.id, { active: false })
    }

    return await stripe.prices.create({
      product: product.sku, currency, unit_amount: unitAmount, lookup_key: lookupKey,
      transfer_lookup_key: true, nickname: plan.sku,
      ...(recurring != null ? { recurring } : { billing_scheme: 'per_unit' }),
      ...(behavior != null ? { tax_behavior: behavior } : {}),
      ...(options.length > 0 ? {
        currency_options: Object.fromEntries(options.map(option => [option.currency, {
          unit_amount: option.unitAmount, ...(behavior != null ? { tax_behavior: behavior } : {}),
        }])),
      } : {}),
      metadata: { sku: plan.sku, ...(product.services && { services: product.services.join(',') }) },
    })
  }

  /**
   * Bring one product and its plans' reusable prices to the declaration: the product created or
   * updated (id = the product sku); per plan a matching active price kept (an `unspecified` one given
   * the declared behavior in place, see `applyUnspecifiedBehavior`), anything else deactivated and a
   * fresh price created with `transfer_lookup_key` and the plan's further currencies as
   * `currency_options` — options are never edited in place. An amount plan's stale prices are
   * deactivated and it gets none.
   */
  const syncProduct = async (
    product: PaymentProduct, plans: CataloguePlan[], opts: { behavior: TaxBehavior | null },
  ): Promise<CatalogueSync> => {
    const stripe = await access.stripe()
    const migrateUnspecifiedPrices = (await access.pricing())?.migrateUnspecifiedPrices ?? false
    const stripeProduct = await ensureStripeProduct(stripe, product)
    const prices: CatalogueSync['prices'] = []
    for (const resolved of plans) {
      const entry = await ensureStripePrice(stripe, product, resolved, opts.behavior, migrateUnspecifiedPrices)
      if (entry != null) {
        prices.push({
          planSku: (resolved.plan as PaymentPlan).sku, priceId: entry.id,
          ...(entry.tax_behavior != null ? { taxBehavior: entry.tax_behavior } : {}),
        })
      }
    }

    return { productId: stripeProduct.id, prices }
  }

  return { price, syncProduct, priceOf }
}
