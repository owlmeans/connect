import { BotErrorPlatform } from '@owlmeans/bot'
import { WHATSAPP_PLATFORM } from './consts.js'

/**
 * The Graph API refused a call — `bot:platform:whatsapp:<code>:<message>`, `code` being the Graph
 * error code (`error.code`: 190 an expired token, 100 a bad parameter, 131047 outside the 24-hour
 * window …), or the HTTP status when the answer carried none (503 unreachable, 504 timeout).
 *
 * Declares no type name of its own: it travels as `BotErrorPlatform`, so a refusal is rebuilt (and
 * explained) wherever this package is not loaded.
 */
export class WhatsAppApiError extends BotErrorPlatform {
  /** The refusal as the Graph API stated it. */
  public static override of(code: number | string, description: string, status?: number): WhatsAppApiError {
    const error = new WhatsAppApiError(`${code}:${description}`)
    error.status = status ?? (Number(code) || 500)
    return error
  }

  /** The Graph error code (or the HTTP status when there was none). */
  public code: number = 500
  /** The HTTP status of the answer — not carried across a hop (500 there; the code is carried). */
  public status: number = 500

  /** `message` is `<code>:<description>` — prefer {@link WhatsAppApiError.of}. */
  constructor(message: string = '500:error') {
    super(`${WHATSAPP_PLATFORM}:${message}`)
    this.finalizeUnmarshal()
  }

  /** The code is read back from the detail. */
  public override finalizeUnmarshal(): void {
    super.finalizeUnmarshal()
    const code = Number(/^(\d+):/.exec(this.detail)?.[1])
    this.code = Number.isFinite(code) ? code : 500
  }
}
