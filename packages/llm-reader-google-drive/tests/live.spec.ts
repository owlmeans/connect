import { afterAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CollectKind, CollectStatus, createDirectoryCollectSink, createLlmReader } from '@owlmeans/llm-reader'
import { isSkip } from '@owlmeans/test'
import { createGoogleDriveSource, GOOGLE_DRIVE_SOURCE } from '../src/index.js'
import { gates } from './context.js'

const gate = gates.live
const it = isSkip(gate) ? test.skip : test
const skipped = isSkip(gate) ? ` (skipped: ${gate.reason})` : ''

const FOLDER = 'https://drive.google.com/drive/folders/1knWJ30Rs2f6R8QEdch2I9WMQ8xU7k7_G?usp=share_link'
const FILE = 'https://drive.google.com/file/d/14ensN8ZJqqoWdCJjtOB31bMOz39wy1N3/view?usp=drive_web'
const SHA256: Record<string, string> = {
  'crmore-benefits.md': '3e5a0af1e1c9b30883135ae4df70d63039e64687666c1227f7c5585cec0dfe2c',
  'crmore-logo.svg': 'f96de2f591701b9939799d3f3f2867737267b60fbd0088bc60bd49e70c34f72d',
  'index.html': '64cde9b44deeb37d28f7cbd0a1badee5c34af2c5d53617b45c4753fd489cb158',
}

const scratch = await mkdtemp(join(tmpdir(), 'llm-reader-google-drive-live-'))
afterAll(async () => {
  await rm(scratch, { recursive: true, force: true })
})

const digests = async (root: string): Promise<Record<string, string>> => {
  const names = (await readdir(root, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name).slice(root.length + 1))
  return Object.fromEntries(await Promise.all(names.map(async name =>
    [name, createHash('sha256').update(await readFile(join(root, name))).digest('hex')] as const)))
}

/** The public Drive, keyless, through a real reader with its default fetch — `LLM_READER_GDRIVE_LIVE=1`. */
describe(`@owlmeans/llm-reader-google-drive — live Google Drive${skipped}`, () => {
  const reader = createLlmReader({ sources: [createGoogleDriveSource()] })

  it('a shared folder is exactly its three files, byte for byte', async () => {
    const root = join(scratch, 'folder')
    const result = await reader.collect(FOLDER, { sink: createDirectoryCollectSink(root) })
    expect(result).toMatchObject({ kind: CollectKind.Source, source: GOOGLE_DRIVE_SOURCE, files: 3 })
    expect(result.items.every(item => item.status === CollectStatus.Written)).toBe(true)
    expect(await digests(root)).toEqual(SHA256)
  }, 120_000)

  it('a single shared file is that file, named as Drive names it', async () => {
    const root = join(scratch, 'file')
    const result = await reader.collect(FILE, { sink: createDirectoryCollectSink(root) })
    expect(result).toMatchObject({ kind: CollectKind.Source, entry: 'crmore-logo.svg', files: 1 })
    expect(await digests(root)).toEqual({ 'crmore-logo.svg': SHA256['crmore-logo.svg'] })
  }, 120_000)
})
