import type { PaygateOwner, PaygateWebhook } from '@owlmeans/server-payment'

/** The Stripe webhook of a context: the managed endpoint, its secrets and the verification of a delivery. */
export interface StripeWebhook extends PaygateWebhook {
  /**
   * The secrets a Stripe signature may be verified with, in order: the configured file secret (an
   * override), then the one stored for the managed endpoint — the newest row of the owner, so a
   * process receiving the webhook finds the secret whichever process of the owner stored it.
   */
  secrets: (owner: PaygateOwner) => Promise<string[]>
}
