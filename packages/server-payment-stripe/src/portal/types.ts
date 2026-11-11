import type { PaygatePortal } from '@owlmeans/server-payment'

/** The Stripe customer portal of a deployment: its configuration and its sessions. */
export interface StripePortal extends PaygatePortal {
  /** The fingerprint sku of an owner's portal configuration: `portal:<owner>`. */
  portalFingerprintSku: (owner: string) => string
}
