import type Stripe from 'stripe'
import type { CheckoutSnapshot } from '@owlmeans/server-payment'

/** The parts of a Stripe Checkout Session read from an answer alone — pure. */
export interface StripeSessionHelper {
  /** A Checkout Session as the host reads it (`presentment_details` is untyped by the pinned SDK — read narrowly). */
  snapshotOf: (session: Stripe.Checkout.Session) => CheckoutSnapshot
  /**
   * Whether Stripe Tax can calculate on a saved address alone — Checkout refuses a session that keeps
   * the saved address (`customer_update.address: 'never'`) when it cannot: a country alone everywhere
   * except US (a postal code) and CA / IN (a postal code or a state).
   */
  isTaxLocatable: (address: Stripe.Address | null | undefined) => boolean
  /**
   * Stripe refuses `consent_collection.terms_of_service` while the account has no terms-of-service URL
   * in its Dashboard (Settings → Public details): an `invalid_request_error` on the param
   * `consent_collection[terms_of_service]` saying "You cannot collect consent to your terms of service
   * unless a URL is set in the Stripe Dashboard …". Matched on the param with a terms message, or on
   * the message alone; any other error type never matches.
   */
  isMissingTermsUrl: (error: unknown) => boolean
}
