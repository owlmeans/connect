import { BotErrorPlatform } from '@owlmeans/bot'
import { SLACK_PLATFORM } from './consts.js'

/**
 * The Web API answered `ok: false` (or not at all) — `bot:platform:slack:<method>:<error>`.
 *
 * Declares no type name of its own: it travels as `BotErrorPlatform`, so a refusal is rebuilt (and
 * explained) wherever this package is not loaded.
 */
export class SlackApiError extends BotErrorPlatform {
  /** The refusal as the Web API stated it. */
  public static override of(method: string, error: string, retryAfter?: number): SlackApiError {
    const failure = new SlackApiError(`${method}:${error}`)
    failure.retryAfter = retryAfter
    return failure
  }

  /** The Web API method that was called (`chat.delete`). */
  public method: string = ''
  /** Slack's error code (`cant_delete_message`, `ratelimited`, `invalid_auth` …). */
  public code: string = 'error'
  /** Seconds to wait, when the call was rate limited. */
  public retryAfter?: number

  /** `message` is `<method>:<error>` — prefer {@link SlackApiError.of}. */
  constructor(message: string = 'unknown:error') {
    super(`${SLACK_PLATFORM}:${message}`)
    this.finalizeUnmarshal()
  }

  /** Method and code are read back from the detail. */
  public override finalizeUnmarshal(): void {
    super.finalizeUnmarshal()
    const found = /^([^:]+):([^:]+)/.exec(this.detail)
    this.method = found?.[1] ?? ''
    this.code = found?.[2] ?? 'error'
  }
}
