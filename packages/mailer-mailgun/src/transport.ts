import type { BasicContext } from '@owlmeans/context'
import { appendMailerTransport, mailAttachmentHelper } from '@owlmeans/mailer'
import type { MailerTransport, MailMessage } from '@owlmeans/mailer'
import type { ServerConfig } from '@owlmeans/server-context'
import { MAILGUN_DEFAULT_BASE_URL, MAILGUN_MAILER } from './consts.js'
import type { MailgunMailerAppendOptions, MailgunMailerTransportOptions, MailgunSettings } from './types.js'

/**
 * The Mailgun transport: posts each message to Mailgun's HTTP API with the global `fetch` — no SDK
 * and no socket to keep. It reads `ctx.cfg.mailgun` when it initializes and on every send, so a
 * mounted value resolved before the context initializes is the one it uses.
 */
export const makeMailgunMailerTransport = <C extends ServerConfig>(
  ctx: BasicContext<C>, opts: MailgunMailerTransportOptions = {}
): MailerTransport => {
  const id = opts.id ?? MAILGUN_MAILER

  const settings = (): MailgunSettings => {
    const mailgun = ctx.cfg.mailgun
    const required = ['apiKey', 'domain', 'from'] as const
    const missing = required.filter(key => mailgun?.[key] == null || String(mailgun[key]).trim() === '')
    if (mailgun == null || missing.length > 0) {
      throw new SyntaxError(`${id}: cfg.mailgun.${missing.join(', cfg.mailgun.')} is not configured`)
    }

    return mailgun
  }

  /** The message's parameters under their Mailgun names, in the order they are sent. */
  const fieldsOf = (message: MailMessage, from: string): [string, string][] => {
    const fields: [string, string][] = [
      ['from', message.from ?? from],
      ['to', message.to],
      ['subject', message.subject],
    ]
    if (message.text) fields.push(['text', message.text])
    if (message.html) fields.push(['html', message.html])
    // Mailgun carries arbitrary headers under the `h:` prefix.
    if (message.replyTo) fields.push(['h:Reply-To', message.replyTo])
    for (const [name, value] of Object.entries(message.headers ?? {})) {
      fields.push([`h:${name}`, value])
    }

    return fields
  }

  /**
   * A form-encoded body for a plain message; `multipart/form-data` with one `attachment` part per
   * file when the message carries files — the only shape Mailgun accepts them in.
   */
  const bodyOf = (message: MailMessage, from: string): URLSearchParams | FormData => {
    const fields = fieldsOf(message, from)
    const attachments = message.attachments ?? []
    if (attachments.length === 0) {
      return new URLSearchParams(fields)
    }

    const form = new FormData()
    for (const [name, value] of fields) form.append(name, value)
    for (const attachment of attachments) {
      const bytes = mailAttachmentHelper.bytesOf(attachment)
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: attachment.contentType ?? 'application/octet-stream' })
      form.append('attachment', blob, attachment.filename)
    }

    return form
  }

  const send = async (message: MailMessage): Promise<void> => {
    const { apiKey, domain, from, baseUrl = MAILGUN_DEFAULT_BASE_URL } = settings()

    const res = await fetch(`${baseUrl}/${domain}/messages`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`api:${apiKey}`)}` },
      body: bodyOf(message, from),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Mailgun send failed [${res.status}]: ${detail}`)
    }
  }

  // A missing account fails the context's start instead of the first mail; nothing is sent here.
  const init = async (): Promise<void> => { settings() }

  return { id, send, init }
}

/** Register the Mailgun transport with the mailer host (`opts.alias`, `MAILER_SERVICE` by default). */
export const appendMailgunMailer = <C extends ServerConfig>(
  ctx: BasicContext<C>, opts: MailgunMailerAppendOptions = {}
): MailerTransport => {
  const { alias, ...transport } = opts

  return appendMailerTransport(ctx, makeMailgunMailerTransport(ctx, transport), alias != null ? { alias } : {})
}
