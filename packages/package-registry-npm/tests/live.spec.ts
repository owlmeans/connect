import { describe, expect, test } from 'bun:test'
import { isSkip } from '@owlmeans/test'
import { createPackageInspector, PackageReason, PackageVerdictKind } from '@owlmeans/package-inspector'
import { createNpmRegistry } from '../src/index.js'
import { gates } from './context.js'

const gate = gates.live
const it = isSkip(gate) ? test.skip : test
const skipped = isSkip(gate) ? ` (skipped: ${gate.reason})` : ''

/** The public npm registry, download counts API and GitHub raw host — `PACKAGE_REGISTRY_NPM_LIVE=1`. */
describe(`@owlmeans/package-registry-npm — live npm${skipped}`, () => {
  const inspector = createPackageInspector({ registry: createNpmRegistry() })

  it('dayjs is genuine', async () => {
    const verdict = await inspector.inspect('dayjs')
    expect(verdict.verdict).toBe(PackageVerdictKind.Genuine)
    expect(verdict.reasons).toContain(PackageReason.Popular)
    expect(verdict.docs.repository).toBe('https://github.com/iamkun/dayjs')
  }, 60_000)

  it('loadsh is a suspicious lookalike of lodash with a copied description', async () => {
    const verdict = await inspector.inspect('loadsh')
    expect(verdict.verdict).toBe(PackageVerdictKind.Suspicious)
    expect(verdict.lookalikeOf).toBe('lodash')
    expect(verdict.reasons).toEqual(expect.arrayContaining([PackageReason.Lookalike, PackageReason.CopiedDescription]))
  }, 60_000)

  it('momnet is a suspicious security holding package', async () => {
    const verdict = await inspector.inspect('momnet')
    expect(verdict.verdict).toBe(PackageVerdictKind.Suspicious)
    expect(verdict.reasons).toContain(PackageReason.Holding)
  }, 60_000)

  it('a name nobody published is unknown', async () => {
    const verdict = await inspector.inspect(`owlmeans-no-such-package-${Date.now().toString(36)}`)
    expect([verdict.verdict, verdict.reasons]).toEqual([PackageVerdictKind.Unknown, [PackageReason.NotFound]])
  }, 60_000)
})
