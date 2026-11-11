import type Stripe from 'stripe'
import {
  paymentUtils, type CreditNoteInput, type CreditNoteLine, type PaygateCall, type PaygateCharge, type PaygateCreditNote,
  type PaygateInvoice, type PaygateRefund, type RefundInput,
} from '@owlmeans/server-payment'
import { STRIPE_OWNER_KEY, STRIPE_OWNER_VALUE } from './consts.js'
import type { PinnedCreditNoteParams } from './types.local.js'
import type { StripeAccess } from './client/types.js'
import type { StripePayments } from './payments/types.js'
import { stripeUtils } from './utils.js'

type Ref = string | { id?: string } | null | undefined

const linesOf = (line: CreditNoteLine): Stripe.CreditNoteCreateParams.Line[] =>
  [{ type: 'invoice_line_item', invoice_line_item: line.lineId, amount: line.amountMinor }]

export const makeStripePayments = (access: StripeAccess): StripePayments => {
  const chargeOf = (charge: Stripe.Charge): PaygateCharge => paymentUtils.compact({
    id: charge.id,
    paymentId: paymentUtils.idOf(charge.payment_intent),
    invoiceId: paymentUtils.idOf((charge as unknown as { invoice?: Ref }).invoice),
    amountMinor: charge.amount,
    refundedMinor: charge.amount_refunded,
  }) as PaygateCharge

  const invoiceOf = (invoice: Stripe.Invoice): PaygateInvoice => {
    const typed = invoice as unknown as { payment_intent?: Ref, subscription?: Ref, tax?: number | null }

    return paymentUtils.compact({
      id: invoice.id as string,
      number: invoice.number ?? undefined,
      firstLineId: invoice.lines?.data?.[0]?.id,
      paymentId: paymentUtils.idOf(typed.payment_intent),
      subscriptionId: paymentUtils.idOf(typed.subscription),
      country: invoice.customer_address?.country ?? undefined,
      subtotalMinor: invoice.subtotal ?? undefined,
      taxMinor: typed.tax ?? undefined,
      totalMinor: invoice.total ?? undefined,
      currency: invoice.currency ?? undefined,
    }) as PaygateInvoice
  }

  const refundOf = (refund: Stripe.Refund): PaygateRefund => paymentUtils.compact({
    id: refund.id,
    status: refund.status ?? '',
    succeeded: refund.status === 'succeeded',
    amountMinor: refund.amount,
    currency: refund.currency,
    paymentId: paymentUtils.idOf(refund.payment_intent),
    chargeId: paymentUtils.idOf(refund.charge),
    metadata: { ...(refund.metadata ?? {}) } as Record<string, string>,
  }) as PaygateRefund

  const noteOf = (note: Stripe.CreditNote): PaygateCreditNote => ({ id: note.id, totalMinor: note.total, currency: note.currency })

  const charge = async (chargeId: string): Promise<PaygateCharge | null> => {
    try {
      return chargeOf(await (await access.stripe()).charges.retrieve(chargeId))
    } catch (error) {
      if (stripeUtils.isMissingObject(error)) {
        return null
      }
      throw error
    }
  }

  const invoice = async (invoiceId: string): Promise<PaygateInvoice | null> => {
    try {
      return invoiceOf(await (await access.stripe()).invoices.retrieve(invoiceId))
    } catch (error) {
      if (stripeUtils.isMissingObject(error)) {
        return null
      }
      throw error
    }
  }

  const refund = async (input: RefundInput, call: PaygateCall): Promise<PaygateRefund> =>
    refundOf(await (await access.stripe()).refunds.create({
      payment_intent: input.paymentId, amount: input.amountMinor, reason: 'requested_by_customer',
      metadata: { [STRIPE_OWNER_KEY]: STRIPE_OWNER_VALUE, ...input.metadata },
    }, { idempotencyKey: call.idempotencyKey }))

  const findRefund = async (paymentId: string, metadata: Record<string, string>): Promise<PaygateRefund | null> => {
    const { data } = await (await access.stripe()).refunds.list({ payment_intent: paymentId, limit: 100 })
    const found = data.find(entry => stripeUtils.metadataMatches(entry.metadata, metadata) && entry.status !== 'failed'
      && entry.status !== 'canceled')

    return found != null ? refundOf(found) : null
  }

  const creditNotes = {
    preview: async (line: CreditNoteLine): Promise<{ totalMinor: number }> => {
      const preview = await (await access.stripe()).creditNotes.preview({ invoice: line.invoiceId, lines: linesOf(line) })
      return { totalMinor: preview.total }
    },
    create: async (input: CreditNoteInput, call: PaygateCall): Promise<PaygateCreditNote> =>
      noteOf(await (await access.stripe()).creditNotes.create({
        invoice: input.invoiceId, lines: linesOf(input), refund: input.refundId, memo: input.memo, metadata: input.metadata,
      } as PinnedCreditNoteParams, { idempotencyKey: call.idempotencyKey })),
    find: async (invoiceId: string, metadata: Record<string, string>): Promise<PaygateCreditNote | null> => {
      const { data } = await (await access.stripe()).creditNotes.list({ invoice: invoiceId, limit: 100 })
      const found = data.find(note => stripeUtils.metadataMatches(note.metadata, metadata) && note.status !== 'void')
      return found != null ? noteOf(found) : null
    },
  }

  return { charge, invoice, refund, findRefund, creditNotes, chargeOf, invoiceOf, refundOf }
}
