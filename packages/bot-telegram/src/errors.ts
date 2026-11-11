import { BotErrorPlatform } from '@owlmeans/bot'
import { TELEGRAM_PLATFORM } from './consts.js'

/**
 * The Bot API answered `ok: false` — `bot:platform:telegram:<error_code>:<description>`.
 *
 * Declares no type name of its own: it travels as `BotErrorPlatform`, so a refusal is rebuilt (and
 * explained) wherever this package is not loaded.
 */
export class TelegramApiError extends BotErrorPlatform {
  /** The refusal as the Bot API stated it. */
  public static override of(code: number | string, description: string, retryAfter?: number): TelegramApiError {
    const error = new TelegramApiError(`${code}:${description}`)
    error.retryAfter = retryAfter
    return error
  }

  /** The Bot API's `error_code` (an HTTP-like status). */
  public code: number = 500
  /** Seconds to wait, when flood control refused the call. */
  public retryAfter?: number

  /** `message` is `<error_code>:<description>` — prefer {@link TelegramApiError.of}. */
  constructor(message: string = '500:error') {
    super(`${TELEGRAM_PLATFORM}:${message}`)
    this.finalizeUnmarshal()
  }

  /** The code is read back from the detail. */
  public override finalizeUnmarshal(): void {
    super.finalizeUnmarshal()
    const code = Number(/^(\d+):/.exec(this.detail)?.[1])
    this.code = Number.isFinite(code) ? code : 500
  }
}
