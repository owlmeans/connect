import type { NameUtils } from './names/types.js'

export const createNameUtils = (): NameUtils => {
  const segment: NameUtils['segment'] = name => {
    // eslint-disable-next-line no-control-regex
    const clean = name.replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim()
    return clean === '' || clean === '.' || clean === '..' ? '_' : clean
  }

  const withExtension: NameUtils['withExtension'] = (name, extension) =>
    name.toLowerCase().endsWith(`.${extension.toLowerCase()}`) ? name : `${name}.${extension}`

  const lastPart = (name: string): string | undefined => {
    const last = name.split(/[/\\]/).pop()?.trim()
    return last == null || last === '' ? undefined : last
  }

  const fromDisposition: NameUtils['fromDisposition'] = header => {
    if (header == null || header === '') return undefined
    const extended = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header)
    if (extended != null) {
      try {
        return lastPart(decodeURIComponent(extended[2]!.trim().replace(/^"|"$/g, '')))
      } catch {
        // A malformed escape falls back to the plain filename.
      }
    }
    const plain = /filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]+))/i.exec(header)
    const value = plain?.[1]?.replace(/\\(.)/g, '$1') ?? plain?.[2]?.trim()
    return value != null ? lastPart(value) : undefined
  }

  return { segment, withExtension, fromDisposition }
}

export const nameUtils = createNameUtils()
