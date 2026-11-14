import { parseHTML } from 'linkedom'
import { GoogleDriveFailure } from '../consts.js'
import { GoogleDriveError } from '../errors.js'
import type { GoogleDriveUrlHelper } from '../types.js'
import { nameUtils } from '../utils/names.js'
import { DRIVE_PAGE_BYTES, DRIVE_PROBE_STEPS } from './consts.local.js'
import type { DriveHttp, DriveProbe, ProbedFile } from './types.local.js'

/**
 * Downloads asked before the collector takes them: one ranged GET (`bytes=0-0`) tells the name
 * (`Content-Disposition`) and size (`Content-Range`) of a file Drive serves as an attachment; an HTML
 * answer is Drive's "can't scan for viruses" form — followed by its action and hidden inputs, like a
 * browser would — or a refusal (sign-in, quota).
 */
export const makeDriveProbe = (http: DriveHttp, urls: GoogleDriveUrlHelper): DriveProbe => {
  const isAttachment = (response: Response): boolean =>
    /attachment/i.test(response.headers.get('content-disposition') ?? '') || !/text\/html/i.test(response.headers.get('content-type') ?? '')

  const sizeOf = (response: Response): number | undefined => {
    const total = Number(/\/(\d+)\s*$/.exec(response.headers.get('content-range') ?? '')?.[1] ?? NaN)
    if (Number.isFinite(total)) return total
    const length = Number(response.headers.get('content-length') ?? NaN)
    return response.status === 200 && Number.isFinite(length) ? length : undefined
  }

  const described = (url: string, response: Response, size = true): ProbedFile => {
    const name = nameUtils.fromDisposition(response.headers.get('content-disposition'))
    const bytes = size ? sizeOf(response) : undefined
    return { url, ...(name != null ? { name } : {}), ...(bytes != null ? { size: bytes } : {}) }
  }

  /** The URL Drive's warning page sends a browser on to — its form with the hidden inputs, or the legacy confirm link. */
  const followUp = (page: string, base: string): string | undefined => {
    const { document } = parseHTML(page)
    const form = document.querySelector('form#download-form') ?? document.querySelector('form[action*="download"]')
    const action = form?.getAttribute('action')
    if (form != null && action != null && action !== '') {
      const next = new URL(action, base)
      for (const input of form.querySelectorAll('input[type="hidden"][name]')) {
        next.searchParams.set(input.getAttribute('name')!, input.getAttribute('value') ?? '')
      }
      if (!urls.owns(next.href)) throw new GoogleDriveError(`${GoogleDriveFailure.Unrecognized}:foreign-form`)
      return next.href
    }
    const legacy = document.querySelector('a[href*="export=download"][href*="confirm="]')?.getAttribute('href')
    if (legacy != null) {
      const next = new URL(legacy, base)
      return urls.owns(next.href) ? next.href : undefined
    }
    return undefined
  }

  const file: DriveProbe['file'] = async (id, resourceKey) => {
    let url = urls.downloadUrl(id, resourceKey)
    for (let step = 0; step < DRIVE_PROBE_STEPS; step++) {
      const response = await http.get(url, { headers: { range: 'bytes=0-0' }, maxBytes: DRIVE_PAGE_BYTES })
      const refused = await http.refusal(response)
      if (refused != null) throw refused
      if (isAttachment(response)) {
        await http.discard(response)
        return described(url, response)
      }
      const page = await http.text(response)
      const next = followUp(page, response.url !== '' ? response.url : url)
      if (next == null) throw http.pageFailure(page) ?? new GoogleDriveError(GoogleDriveFailure.Unrecognized)
      url = next
    }
    throw new GoogleDriveError(`${GoogleDriveFailure.Unrecognized}:steps`)
  }

  const exported: DriveProbe['exported'] = async url => {
    const response = await http.get(url, { maxBytes: DRIVE_PAGE_BYTES })
    const refused = await http.refusal(response)
    if (refused != null) throw refused
    if (isAttachment(response)) {
      await http.discard(response)
      // An export is generated on the fly: its length (if any) is not worth admitting it by.
      return described(url, response, false)
    }
    throw http.pageFailure(await http.text(response)) ?? new GoogleDriveError(GoogleDriveFailure.Unrecognized)
  }

  return { file, exported }
}
