import type Stripe from 'stripe'
import type { PaygateCatalogue, PaygatePrice } from '@owlmeans/server-payment'

/** The catalogue of a context as Stripe products and prices. */
export interface StripeCatalogue extends PaygateCatalogue {
  /** A Stripe price as the host reads it (its `currency_options`, when expanded or held, as further currencies). */
  priceOf: (price: Stripe.Price) => PaygatePrice
}
