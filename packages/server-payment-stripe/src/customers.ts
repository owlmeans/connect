import type Stripe from 'stripe'
import type { Context as ApiContext } from '@owlmeans/server-api'
import { paymentAccessOf, paymentUtils, type CustomerInput, type CustomerLocks, type PaygateCustomer } from '@owlmeans/server-payment'
import { STRIPE_PAYGATE } from './consts.js'
import type { StripeAccess } from './client/types.js'
import type { StripeCustomers } from './customers/types.js'
import { stripeSessionHelper } from './session.js'
import { stripeUtils } from './utils.js'

/** A saved address holding only `country` — stale lines and a postal code of another country cleared. */
const countryOnlyAddress = (country: string): Stripe.AddressParam => ({
  country, line1: '', line2: '', city: '', state: '', postal_code: '',
})

export const makeStripeCustomers = (ctx: ApiContext, access: StripeAccess): StripeCustomers => {
  const customerOf = (customer: Stripe.Customer): PaygateCustomer => paymentUtils.compact({
    id: customer.id,
    email: customer.email ?? undefined,
    country: customer.address?.country ?? undefined,
    taxLocatable: stripeSessionHelper.isTaxLocatable(customer.address),
    taxIds: customer.tax_ids?.data?.map(taxId => paymentUtils.compact({
      type: taxId.type as string, value: taxId.value, country: taxId.country ?? undefined,
    })),
    taxExempt: customer.tax_exempt ?? undefined,
  }) as PaygateCustomer

  /**
   * The entity's Stripe customer, created on first use. Under `lockCustomerEmail` it carries the
   * buyer's e-mail (the host passes it only then) — written over any other one — because Checkout
   * shows a customer's valid e-mail read-only (and only asks for one, then saves it, while the
   * customer has none).
   */
  const ensure = async (input: CustomerInput): Promise<PaygateCustomer> => {
    const stripe = await access.stripe()
    const email = input.email
    const resource = paymentAccessOf(ctx).paygateCustomers()
    const existing = await resource.byEntity(input.entityId, STRIPE_PAYGATE)
    if (existing != null && existing.deletedAt == null) {
      const retrieved = await stripe.customers.retrieve(existing.externalId)
      if (!(retrieved as Stripe.DeletedCustomer).deleted) {
        const customer = retrieved as Stripe.Customer
        const update: Stripe.CustomerUpdateParams = {
          ...(input.locale != null && customer.preferred_locales?.[0] !== input.locale ? { preferred_locales: [input.locale] } : {}),
          ...(email != null && customer.email?.toLowerCase() !== email.toLowerCase() ? { email } : {}),
        }
        return customerOf(Object.keys(update).length > 0 ? await stripe.customers.update(customer.id, update) : customer)
      }
    }
    const created = await stripe.customers.create({
      metadata: {
        entityId: input.entityId, ...(input.profileId && { profileId: input.profileId }),
        service: input.service,
      },
      ...(input.locale != null ? { preferred_locales: [input.locale] } : {}),
      ...(email != null ? { email } : {}),
    })
    if (existing != null) {
      const { deletedAt: _deleted, ...kept } = existing
      await resource.update({ ...kept, externalId: created.id })
    } else {
      await resource.create({
        paygate: STRIPE_PAYGATE, externalId: created.id, entityId: input.entityId,
        ...(input.profileId != null ? { profileId: input.profileId } : {}),
      })
    }
    return customerOf(created)
  }

  const retrieve = async (customerId: string, opts: { taxIds?: boolean } = {}): Promise<PaygateCustomer | null> => {
    const stripe = await access.stripe()
    try {
      const retrieved = opts.taxIds === true
        ? await stripe.customers.retrieve(customerId, { expand: ['tax_ids'] })
        : await stripe.customers.retrieve(customerId)
      return (retrieved as Stripe.DeletedCustomer).deleted ? null : customerOf(retrieved as Stripe.Customer)
    } catch (error) {
      if (stripeUtils.isMissingObject(error)) return null
      throw error
    }
  }

  const setCountry = async (customerId: string, country: string, opts: { replace: boolean }): Promise<PaygateCustomer> => {
    const stripe = await access.stripe()

    return customerOf(await stripe.customers.update(customerId, {
      address: opts.replace ? countryOnlyAddress(country) : { country },
    }))
  }

  const locks = async (): Promise<CustomerLocks> => {
    const pricing = await access.pricing()

    return { email: pricing?.lockCustomerEmail === true, country: pricing?.lockCustomerCountry === true }
  }

  return { ensure, retrieve, setCountry, locks, customerOf }
}
