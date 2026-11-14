import { ResilientError } from '@owlmeans/error'
import { ReaderFetchError } from '@owlmeans/llm-reader'
import { GOOGLE_DRIVE_SOURCE, GoogleDriveFailure } from './consts.js'

/**
 * A Drive link or entry that could not be expanded — `llm-reader:fetch:google-drive:<reason>[:<detail>]`.
 * A reader fetch error, so a collect reports it as the link's failed item with this message as the reason.
 */
export class GoogleDriveError extends ReaderFetchError {
  public static override typeName = `GoogleDrive${ReaderFetchError.typeName}`

  /** Why, read back from the message. */
  public reason: GoogleDriveFailure = GoogleDriveFailure.Unrecognized

  constructor(message: string = GoogleDriveFailure.Unrecognized) {
    super(`${GOOGLE_DRIVE_SOURCE}:${message}`)
    this.type = GoogleDriveError.typeName
    this.finalizeUnmarshal()
  }

  public override finalizeUnmarshal(): void {
    super.finalizeUnmarshal()
    const reason = new RegExp(`${GOOGLE_DRIVE_SOURCE}:([a-z-]+)`).exec(this.message)?.[1]
    this.reason = Object.values(GoogleDriveFailure).includes(reason as GoogleDriveFailure)
      ? reason as GoogleDriveFailure
      : GoogleDriveFailure.Unrecognized
  }
}

ResilientError.registerErrorClass(GoogleDriveError)
