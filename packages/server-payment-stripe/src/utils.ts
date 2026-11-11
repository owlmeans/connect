import type Stripe from 'stripe'
import { WebhookSetupError } from '@owlmeans/payment'
import type { StripeUtils } from './utils/types.js'

export const createStripeUtils = (): StripeUtils => {
  const apiVersionOf = (stripe: Stripe): string => {
    const version = (stripe as unknown as { getApiField?: (key: string) => unknown }).getApiField?.('version')
    if (typeof version !== 'string' || version === '') {
      throw new WebhookSetupError('api-version')
    }

    return version
  }

  const isMissingObject = (error: unknown): boolean => {
    const typed = error as { code?: unknown; statusCode?: unknown; raw?: { code?: unknown } } | null
    return typed?.code === 'resource_missing' || typed?.raw?.code === 'resource_missing' || typed?.statusCode === 404
  }

  const isAlreadyCanceled = (error: unknown): boolean => isMissingObject(error)
    || /canceled subscription|already (been )?cancel/i.test((error as { message?: string } | null)?.message ?? '')

  const isInvalidRequest = (error: unknown): error is { code?: string } =>
    (error as { type?: unknown } | null)?.type === 'StripeInvalidRequestError'

  const metadataMatches = (metadata: Stripe.Metadata | null | undefined, match: Record<string, string>): boolean =>
    Object.entries(match).every(([key, value]) => metadata?.[key] === value)

  return { apiVersionOf, isMissingObject, isAlreadyCanceled, isInvalidRequest, metadataMatches }
}

export const stripeUtils = createStripeUtils()
