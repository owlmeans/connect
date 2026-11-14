import { logger } from '@owlmeans/log'
import { PackageRegistryError } from '@owlmeans/package-inspector'
import { NPM_RETRY_BACKOFF, NPM_RETRY_MAX_WAIT, NPM_RETRY_STATUSES } from '../consts.js'
import type { NpmHttp, NpmHttpOptions } from './types.local.js'

const log = logger('package-registry-npm')

export const createNpmHttp = (options: NpmHttpOptions): NpmHttp => {
  const headers = { accept: 'application/json', 'user-agent': options.userAgent }

  const failure = (label: string, cause: string): PackageRegistryError => {
    log.debug('npm request failed', { label, cause })
    return new PackageRegistryError(`${label}:${cause}`)
  }

  const causeOf = (error: unknown): string =>
    error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError') ? 'timeout' : 'unreachable'

  /** The body as text, up to `maxBytes`; past them the rest is cancelled and `truncated` set. */
  const readCapped = async (response: Response, maxBytes: number): Promise<{ text: string, truncated: boolean }> => {
    const reader = response.body?.getReader()
    if (reader == null) {
      return { text: '', truncated: false }
    }
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (size + value.byteLength > maxBytes) {
        chunks.push(value.subarray(0, maxBytes - size))
        await reader.cancel().catch(() => undefined)
        return { text: Buffer.concat(chunks).toString('utf8'), truncated: true }
      }
      size += value.byteLength
      chunks.push(value)
    }

    return { text: Buffer.concat(chunks).toString('utf8'), truncated: false }
  }

  /** How long to wait before retry `attempt` (0-based): the server's `retry-after`, else a doubling backoff. */
  const waitOf = (response: Response, attempt: number): number => {
    const header = response.headers.get('retry-after')
    const seconds = header != null && header.trim() !== '' ? Number(header) : Number.NaN
    const dated = header != null && Number.isNaN(seconds) ? Date.parse(header) - Date.now() : Number.NaN
    const wait = !Number.isNaN(seconds) ? seconds * 1000 : !Number.isNaN(dated) ? dated : NPM_RETRY_BACKOFF * 2 ** attempt

    return Math.min(Math.max(wait, 0), NPM_RETRY_MAX_WAIT)
  }

  /** The response, retried while the server says it is throttling or briefly unavailable. */
  const request = async (url: string, label: string): Promise<Response> => {
    const send = options.fetch ?? fetch
    for (let attempt = 0; ; attempt++) {
      let response: Response
      try {
        response = await send(url, { headers, signal: AbortSignal.timeout(options.timeoutMs), redirect: 'follow' })
      } catch (error) {
        throw failure(label, causeOf(error))
      }
      if (!NPM_RETRY_STATUSES.includes(response.status) || attempt >= options.retries) {
        return response
      }
      await response.body?.cancel().catch(() => undefined)
      const wait = waitOf(response, attempt)
      log.debug('npm request throttled', { label, status: response.status, attempt, wait })
      await new Promise(resolve => setTimeout(resolve, wait))
    }
  }

  /** The body of a successful answer, capped; `null` for a 404. */
  const read = async (url: string, label: string, maxBytes: number, whole: boolean): Promise<{ text: string, truncated: boolean } | null> => {
    const response = await request(url, label)
    if (response.status === 404) {
      await response.body?.cancel().catch(() => undefined)
      return null
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      throw failure(label, String(response.status))
    }
    // A declared length past the cap (compressed or not) is past it decompressed too.
    const declared = Number(response.headers.get('content-length') ?? Number.NaN)
    if (whole && Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel().catch(() => undefined)
      return { text: '', truncated: true }
    }
    try {
      return await readCapped(response, maxBytes)
    } catch (error) {
      throw failure(label, causeOf(error))
    }
  }

  const json: NpmHttp['json'] = async <T>(url: string, label: string, maxBytes: number) => {
    const answer = await read(url, label, maxBytes, true)
    if (answer == null || answer.truncated) {
      return answer == null ? null : { body: null, truncated: true }
    }
    try {
      return { body: JSON.parse(answer.text) as T, truncated: false }
    } catch {
      throw failure(label, 'malformed')
    }
  }

  const text: NpmHttp['text'] = async (url, label, maxBytes) => {
    const answer = await read(url, label, maxBytes, false)

    return answer == null ? null : { body: answer.text, truncated: answer.truncated }
  }

  return { json, text }
}
