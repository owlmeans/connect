import type { MailerAppendOptions } from '@owlmeans/mailer'
import type { ServerConfig } from '@owlmeans/server-context'

/** The `cfg.mailgun` block the transport reads at init and on every send. */
export interface MailgunSettings {
  /** Mailgun API key (starts with key-...) */
  apiKey: string
  /** Mailgun sending domain (e.g. mg.example.com) */
  domain: string
  /** Sender address (e.g. "OwlMeans Platform <noreply@mg.example.com>") */
  from: string
  /** Override the Mailgun API base URL. Defaults to `MAILGUN_DEFAULT_BASE_URL` (US region). */
  baseUrl?: string
}

declare module '@owlmeans/server-context' {
  interface ServerConfig {
    /** The Mailgun account `@owlmeans/mailer-mailgun`'s transport sends through. */
    mailgun?: MailgunSettings
  }
}

export interface MailgunConfig extends ServerConfig {
  mailgun: MailgunSettings
}

export interface MailgunMailerTransportOptions {
  /** The transport's id — `MAILGUN_MAILER` by default; also the prefix of its configuration errors. */
  id?: string
}

export interface MailgunMailerAppendOptions extends MailgunMailerTransportOptions, MailerAppendOptions {}
