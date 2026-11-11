import type Stripe from 'stripe'

/** The package's pure Stripe primitives. */
export interface StripeUtils {
  /**
   * The API version a client was built with — read back from the client, never written as a literal,
   * so a webhook endpoint always receives the payload shapes the client itself parses.
   *
   * @throws WebhookSetupError('api-version')
   */
  apiVersionOf: (stripe: Stripe) => string
  /** A Stripe answer meaning the object does not exist (deleted, or never did). */
  isMissingObject: (error: unknown) => boolean
  /** A Stripe error that says the subscription is already gone. */
  isAlreadyCanceled: (error: unknown) => boolean
  /** A Stripe invalid-request error (duck-typed: the installed SDK's own error class name). */
  isInvalidRequest: (error: unknown) => error is { code?: string }
  /** Whether an object's metadata carries every entry of `match`. */
  metadataMatches: (metadata: Stripe.Metadata | null | undefined, match: Record<string, string>) => boolean
}
