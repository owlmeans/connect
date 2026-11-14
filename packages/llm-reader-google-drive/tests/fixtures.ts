/** One item the Drive stand-in serves. */
export interface StandInItem {
  id: string
  /** The folder it is listed in. */
  parent?: string
  kind: 'folder' | 'file' | 'document' | 'form'
  name: string
  mime?: string
  body?: string | Uint8Array
  /** Doc exports by format. */
  exports?: Record<string, { mime: string, body: string }>
  /** Shared privately: Google answers with its sign-in page. */
  private?: boolean
  /** Download quota exhausted. */
  quota?: boolean
  /** Served only after Drive's "can't scan for viruses" form (its `uuid`). */
  warn?: boolean
  /** The folder view never answers. */
  stall?: boolean
  /** A pre-2021 link: the item is reachable only with its resource key. */
  resourceKey?: string
}

/** Bytes that are not text. */
const pattern = (size: number): Uint8Array => Uint8Array.from({ length: size }, (_, index) => (index * 31 + 7) % 251)

export const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])

export const ROOT = 'rootFolder0001'
export const ASSETS = 'subAssets0001'
export const DEEP = 'subDeep000001'
export const WIDE = 'wideFolder001'
export const PRIVATE_FOLDER = 'privateFold01'
export const STALL_FOLDER = 'stallFolder01'
export const KEYED_FOLDER = 'keyedFolder01'
export const KEYED_RESOURCE = '0-keyedResKey'
export const LOGO = 'fileLogo00001'
export const BIG = 'fileBig000001'
export const SPEC = 'docSpec000001'
export const SECRET = 'fileSecret001'
export const QUOTA = 'fileQuota0001'
export const ACCENTED = 'fileAccent001'
export const MISSING = 'missingItem01'

export const BIG_BODY = pattern(64 * 1024)

export const ITEMS: StandInItem[] = [
  { id: ROOT, kind: 'folder', name: 'Project' },
  { id: 'fileNotes0001', parent: ROOT, kind: 'file', name: 'notes.md', mime: 'text/markdown', body: '# Notes\n\nPlain words.\n' },
  { id: LOGO, parent: ROOT, kind: 'file', name: 'logo.svg', mime: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' },
  { id: 'fileIndex0001', parent: ROOT, kind: 'file', name: 'index.html', mime: 'text/html', body: '<!doctype html><html><body><script>alert(1)</script>Kept as served</body></html>' },
  { id: BIG, parent: ROOT, kind: 'file', name: 'big.bin', mime: 'application/octet-stream', body: BIG_BODY, warn: true },
  {
    id: SPEC, parent: ROOT, kind: 'document', name: 'Spec',
    exports: {
      docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body: 'PK-docx-of-Spec' },
      md: { mime: 'text/markdown', body: '# Spec\n\nExported as Markdown.\n' },
    },
  },
  { id: 'formPoll00001', parent: ROOT, kind: 'form', name: 'Poll' },
  { id: SECRET, parent: ROOT, kind: 'file', name: 'secret.txt', mime: 'text/plain', body: 'secret', private: true },
  { id: ASSETS, parent: ROOT, kind: 'folder', name: 'assets' },
  { id: 'filePhoto0001', parent: ASSETS, kind: 'file', name: 'photo.png', mime: 'image/png', body: PNG },
  { id: DEEP, parent: ASSETS, kind: 'folder', name: 'deep' },
  { id: 'fileDeep00001', parent: DEEP, kind: 'file', name: 'deep.txt', mime: 'text/plain', body: 'deep\n' },

  { id: WIDE, kind: 'folder', name: 'Wide' },
  ...Array.from({ length: 12 }, (_, index): StandInItem => ({
    id: `fileWide${String(index).padStart(5, '0')}`, parent: WIDE, kind: 'file', name: `wide-${String(index).padStart(2, '0')}.txt`,
    mime: 'text/plain', body: `wide ${index}\n`,
  })),

  { id: KEYED_FOLDER, kind: 'folder', name: 'Keyed', resourceKey: KEYED_RESOURCE },
  { id: 'fileKeyed0001', parent: KEYED_FOLDER, kind: 'file', name: 'keyed.txt', mime: 'text/plain', body: 'keyed\n' },

  { id: PRIVATE_FOLDER, kind: 'folder', name: 'Hidden', private: true },
  { id: STALL_FOLDER, kind: 'folder', name: 'Slow', stall: true },
  { id: QUOTA, kind: 'file', name: 'popular.zip', mime: 'application/zip', body: 'zip', quota: true },
  { id: ACCENTED, kind: 'file', name: 'résumé 2026.txt', mime: 'text/plain', body: 'cv\n' },
]

/** The bytes of an item as served. */
export const bytesOf = (item: StandInItem): Uint8Array =>
  typeof item.body === 'string' ? new TextEncoder().encode(item.body) : item.body ?? new Uint8Array()

export const itemOf = (id: string): StandInItem | undefined => ITEMS.find(item => item.id === id)

export const childrenOf = (id: string): StandInItem[] => ITEMS.filter(item => item.parent === id)
