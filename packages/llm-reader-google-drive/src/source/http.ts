import type { ReaderSourceContext } from '@owlmeans/llm-reader'
import { GoogleDriveFailure } from '../consts.js'
import { GoogleDriveError } from '../errors.js'
import type { GoogleDriveUrlHelper } from '../types.js'
import { API_KEY_PATTERN, NOT_PUBLIC_PATTERN, QUOTA_PATTERN, RESOLVER_PATTERN } from './consts.local.js'
import type { DriveHttp } from './types.local.js'

/** Google, asked through one collect's guarded fetch — its answers read as Drive refusals. */
export const makeDriveHttp = (context: ReaderSourceContext, urls: GoogleDriveUrlHelper): DriveHttp => {
  const fail = (reason: string): GoogleDriveError => new GoogleDriveError(reason)

  const messagesOf = (error: unknown): string => {
    const parts: string[] = []
    for (let current = error, depth = 0; current != null && depth < 4; current = (current as { cause?: unknown }).cause, depth++) {
      parts.push(String((current as { message?: unknown }).message ?? current))
    }
    return parts.join(' ')
  }

  const get: DriveHttp['get'] = async (url, init) => {
    try {
      return await context.fetch(url, init)
    } catch (error) {
      if (context.signal?.aborted !== true && RESOLVER_PATTERN.test(messagesOf(error))) {
        throw Object.assign(fail(GoogleDriveFailure.Resolver), { cause: error, url })
      }
      throw error
    }
  }

  const discard: DriveHttp['discard'] = async response => {
    await response.body?.cancel().catch(() => undefined)
  }

  const text: DriveHttp['text'] = async response => {
    try {
      return await response.text()
    } catch {
      return ''
    }
  }

  const pageFailure: DriveHttp['pageFailure'] = page => {
    if (QUOTA_PATTERN.test(page)) return fail(GoogleDriveFailure.Quota)
    if (NOT_PUBLIC_PATTERN.test(page)) return fail(GoogleDriveFailure.NotPublic)
    return undefined
  }

  const refusal: DriveHttp['refusal'] = async response => {
    if (response.url !== '' && urls.isSignIn(response.url)) {
      await discard(response)
      return fail(GoogleDriveFailure.NotPublic)
    }
    if (response.status < 400) return undefined
    const body = await text(response)
    const error = response.status === 429 || QUOTA_PATTERN.test(body) ? fail(GoogleDriveFailure.Quota)
      : API_KEY_PATTERN.test(body) ? fail(GoogleDriveFailure.ApiKey)
        : response.status === 404 ? fail(GoogleDriveFailure.NotFound)
          : response.status === 401 || response.status === 403 ? fail(GoogleDriveFailure.NotPublic)
            : fail(`${GoogleDriveFailure.Status}:${response.status}`)
    error.status = response.status
    return error
  }

  return { get, refusal, pageFailure, text, discard }
}
