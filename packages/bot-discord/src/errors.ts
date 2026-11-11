import { BotErrorPlatform } from '@owlmeans/bot'
import { DISCORD_PLATFORM } from './consts.js'

/**
 * The REST API refused or failed — `bot:platform:discord:<status>:<json code>:<message>`.
 *
 * Declares no type name of its own: it travels as `BotErrorPlatform`, so a refusal is rebuilt (and
 * explained) wherever this package is not loaded.
 */
export class DiscordApiError extends BotErrorPlatform {
  /** The refusal as the API stated it: the HTTP status, Discord's JSON error code (0 when none). */
  public static override of(status: number | string, message: string, code: number = 0, retryAfter?: number): DiscordApiError {
    const error = new DiscordApiError(`${status}:${code}:${message}`)
    error.retryAfter = retryAfter
    return error
  }

  /** The HTTP status. */
  public status: number = 500
  /** Discord's JSON error code (`50013` missing permissions, `10008` unknown message…), 0 when none. */
  public code: number = 0
  /** Seconds to wait, when a rate limit refused the call. */
  public retryAfter?: number

  /** `message` is `<status>:<code>:<message>` — prefer {@link DiscordApiError.of}. */
  constructor(message: string = '500:0:error') {
    super(`${DISCORD_PLATFORM}:${message}`)
    this.finalizeUnmarshal()
  }

  /** Status and code are read back from the detail. */
  public override finalizeUnmarshal(): void {
    super.finalizeUnmarshal()
    const found = /^(\d+):(\d+):/.exec(this.detail)
    const status = Number(found?.[1])
    const code = Number(found?.[2])
    this.status = Number.isFinite(status) ? status : 500
    this.code = Number.isFinite(code) ? code : 0
  }
}

/**
 * The gateway ended in a way a reconnect cannot fix — `bot:platform:discord:gateway:<close code>:<reason>`
 * (4004 a wrong token, 4014 the MESSAGE CONTENT intent not enabled, …), or the receiver gave up.
 */
export class DiscordGatewayError extends BotErrorPlatform {
  public static override of(code: number | string, reason: string): DiscordGatewayError {
    return new DiscordGatewayError(`${code}:${reason}`)
  }

  /** The close code (0 when the gateway did not close with one). */
  public code: number = 0

  constructor(message: string = '0:error') {
    super(`${DISCORD_PLATFORM}:gateway:${message}`)
    this.finalizeUnmarshal()
  }

  public override finalizeUnmarshal(): void {
    super.finalizeUnmarshal()
    const code = Number(/^gateway:(\d+):/.exec(this.detail)?.[1])
    this.code = Number.isFinite(code) ? code : 0
  }
}
