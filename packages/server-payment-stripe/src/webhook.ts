import { createHash } from 'node:crypto'
import type Stripe from 'stripe'
import { PaygateSignatureError, WebhookSetupError } from '@owlmeans/payment'
import type { Context as ApiContext } from '@owlmeans/server-api'
import {
  paymentAccessOf, paymentUtils, type PaygateDelivery, type PaygateDeployment, type PaygateEvent, type PaygateOwner,
  type PaymentWebhookRecord,
} from '@owlmeans/server-payment'
import { STRIPE_OWNER_KEY, STRIPE_OWNER_VALUE, STRIPE_PAYGATE, STRIPE_SIGNATURE, WEBHOOK_EVENTS } from './consts.js'
import type { StripeAccess } from './client/types.js'
import type { StripeEvents } from './events/types.js'
import type { StripeWebhook } from './webhook/types.js'
import { stripeUtils } from './utils.js'

/** An operator's label on an endpoint this package created — never evidence of which deployment owns it. */
const ownerMetadata = (owner: string): Record<string, string> =>
  ({ [STRIPE_OWNER_KEY]: STRIPE_OWNER_VALUE, service: owner })

const hashOf = (url: string, apiVersion: string, events: string[]): string =>
  createHash('sha256').update(JSON.stringify({ url, apiVersion, events })).digest('hex')

export const makeStripeWebhook = (ctx: ApiContext, access: StripeAccess, events: StripeEvents): StripeWebhook => {
  const resource = () => paymentAccessOf(ctx).paymentWebhooks()

  const listEndpoints = async (stripe: Stripe): Promise<Stripe.WebhookEndpoint[]> => {
    const endpoints: Stripe.WebhookEndpoint[] = []
    let startingAfter: string | undefined
    for (;;) {
      const page = await stripe.webhookEndpoints.list({
        limit: 100, ...(startingAfter != null ? { starting_after: startingAfter } : {}),
      })
      endpoints.push(...page.data)
      if (!page.has_more || page.data.length === 0) {
        return endpoints
      }
      startingAfter = page.data[page.data.length - 1].id
    }
  }

  const dropEndpoint = async (stripe: Stripe, id: string): Promise<void> => {
    try {
      await stripe.webhookEndpoints.del(id)
    } catch (error) {
      if (!stripeUtils.isMissingObject(error)) {
        throw error
      }
    }
  }

  /** Field-encrypt the secret where the database is configured for it; store it plain otherwise. */
  const sealed = async (row: Partial<PaymentWebhookRecord>): Promise<Partial<PaymentWebhookRecord>> => {
    const webhooks = resource()
    if (typeof webhooks.lock !== 'function') {
      return row
    }
    try {
      return await webhooks.lock(row, ['secret']) as Partial<PaymentWebhookRecord>
    } catch {
      return row
    }
  }

  const opened = async (row: PaymentWebhookRecord): Promise<string> => {
    const webhooks = resource()
    if (typeof webhooks.unlock !== 'function') {
      return row.secret
    }
    try {
      return (await webhooks.unlock(row, ['secret']) as PaymentWebhookRecord).secret
    } catch {
      return row.secret
    }
  }

  /**
   * Delete the endpoints this deployment created at URLs it has left: each `payment-webhook` row of
   * Stripe and the owner at another URL drops the endpoint it names (one already gone is fine), then
   * the row itself. `live` — the endpoint just put in place — is never dropped.
   */
  const pruneFormerUrls = async (stripe: Stripe, owner: string, url: string, live: string): Promise<void> => {
    const webhooks = resource()
    const { items } = await webhooks.list({ paygate: STRIPE_PAYGATE, service: owner, url: { $ne: url } }, { size: 0 })
    for (const row of items) {
      if (row.externalId !== live) {
        await dropEndpoint(stripe, row.externalId)
      }
      await webhooks.delete(row.id as string)
    }
  }

  /**
   * Keep exactly one Stripe webhook endpoint for this deployment at its own URL, subscribed to
   * `WEBHOOK_EVENTS` on the client's API version, and persist its signing secret — which Stripe
   * returns only when an endpoint is created. Several deployments may share a Stripe account, so a
   * deployment deletes only the endpoints its own `payment-webhook` rows name:
   *
   * - an unchanged `{ url, apiVersion, events }` fingerprint makes no Stripe call at all;
   * - `force` first verifies the stored endpoint still exists; one deleted from outside loses its row
   *   and is created again;
   * - changed events on the same API version update the endpoint in place; a changed API version
   *   (create-only on an endpoint) deletes and recreates it;
   * - an endpoint already at this exact URL that no row names is replaced: its secret is unknown here;
   * - a row of the owner at another URL is a URL this deployment has left: once the endpoint at the
   *   current URL is in place, the endpoint that row names is deleted, then the row;
   * - replicas racing to persist one row: the endpoint created last is the live one;
   * - a created endpoint carries `{ owlmeans: 'payment', service: <owner> }` metadata and the
   *   `owlmeans:<owner>` description for operators.
   */
  const ensureEndpoint = async (
    deployment: PaygateDeployment, opts: { force?: boolean } = {},
  ): Promise<PaymentWebhookRecord | null> => {
    const stripe = await access.stripe()
    const url = deployment.webhookUrl
    const owner = deployment.owner
    const apiVersion = stripeUtils.apiVersionOf(stripe)
    const enabled = [...WEBHOOK_EVENTS].sort()
    const hash = hashOf(url, apiVersion, enabled)
    const webhooks = resource()
    const description = `owlmeans:${owner}`
    const metadata = ownerMetadata(owner)
    const now = new Date()

    let stored = await webhooks.load({ paygate: STRIPE_PAYGATE, service: owner, url })
    if (stored != null && opts.force === true) {
      try {
        await stripe.webhookEndpoints.retrieve(stored.externalId)
      } catch (error) {
        if (!stripeUtils.isMissingObject(error)) {
          throw error
        }
        await webhooks.delete(stored.id as string)
        stored = null
      }
    }
    if (stored != null && stored.hash === hash && opts.force !== true) {
      return stored
    }

    let live: PaymentWebhookRecord | null = null
    if (stored != null && stored.apiVersion === apiVersion) {
      try {
        await stripe.webhookEndpoints.update(stored.externalId, {
          url, enabled_events: enabled as Stripe.WebhookEndpointUpdateParams.EnabledEvent[],
          description, metadata, disabled: false,
        })
        live = await webhooks.update({ ...stored, events: enabled, hash, updatedAt: now })
      } catch (error) {
        if (!stripeUtils.isMissingObject(error)) {
          throw error
        }
      }
    }

    if (live == null) {
      if (stored != null) {
        await dropEndpoint(stripe, stored.externalId)
      }
      for (const endpoint of await listEndpoints(stripe)) {
        if (endpoint.url === url) {
          await dropEndpoint(stripe, endpoint.id)
        }
      }

      const created = await stripe.webhookEndpoints.create({
        url, enabled_events: enabled as Stripe.WebhookEndpointCreateParams.EnabledEvent[],
        api_version: apiVersion as Stripe.WebhookEndpointCreateParams.ApiVersion, description, metadata,
      })
      if (created.secret == null || created.secret === '') {
        throw new WebhookSetupError('secret-missing')
      }

      const row = await sealed({
        paygate: STRIPE_PAYGATE, service: owner, url, externalId: created.id, secret: created.secret,
        apiVersion, events: enabled, hash, createdAt: stored?.createdAt ?? now, updatedAt: now,
      })
      try {
        live = stored != null
          ? await webhooks.update({ ...row, id: stored.id } as PaymentWebhookRecord)
          : await webhooks.create(row)
      } catch (error) {
        if (!paymentUtils.isDuplicateKey(error)) {
          throw error
        }
        // Another replica persisted its endpoint meanwhile; the one created last is the live one.
        const winner = await webhooks.load({ paygate: STRIPE_PAYGATE, service: owner, url })
        live = await webhooks.update({ ...row, id: winner?.id } as PaymentWebhookRecord)
      }
    }

    await pruneFormerUrls(stripe, owner, url, live.externalId)

    return live
  }

  const secrets = async (owner: PaygateOwner): Promise<string[]> => {
    const found: string[] = []
    const configured = (await access.secrets())?.webhook
    if (typeof configured === 'string' && configured.trim() !== '') {
      found.push(configured.trim())
    }
    const stored = await resource().load(
      { paygate: STRIPE_PAYGATE, service: owner.owner },
      { sort: [{ field: 'updatedAt', order: 'desc' }] },
    )
    if (stored != null) {
      const secret = await opened(stored)
      if (secret !== '' && !found.includes(secret)) {
        found.push(secret)
      }
    }

    return found
  }

  /**
   * Verify a Stripe delivery against the configured override secret, then the managed endpoint's
   * stored one (`constructEventAsync`: Bun needs the async HMAC), and translate it.
   *
   * @throws PaygateSignatureError | WebhookSetupError('secret')
   */
  const verify = async (delivery: PaygateDelivery, owner: PaygateOwner): Promise<PaygateEvent[]> => {
    const rawBody = delivery.rawBody
    const signature = delivery.headers[STRIPE_SIGNATURE.toLowerCase()]
    if (rawBody == null || typeof signature !== 'string') throw new PaygateSignatureError()

    const candidates = await secrets(owner)
    if (candidates.length === 0) {
      throw new WebhookSetupError('secret')
    }
    const stripe = await access.stripe()
    let event: Stripe.Event | null = null
    for (const secret of candidates) {
      try {
        event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret)
        break
      } catch {
        // Try the next secret; a signature none of them verifies is refused below.
      }
    }
    if (event == null) {
      throw new PaygateSignatureError()
    }

    return await events.translate(event)
  }

  return { verify, ensureEndpoint, secrets }
}
