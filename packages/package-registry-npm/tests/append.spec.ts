import { afterAll, describe, expect, test } from 'bun:test'
import { ensurePackageInspectorService, PackageReason, PackageVerdictKind } from '@owlmeans/package-inspector'
import { appendNpmRegistry, NPM_REGISTRY } from '../src/index.js'
import { makeTestCtx, startStandIn } from './context.js'

const standIn = startStandIn()
afterAll(() => standIn.stop())

describe('@owlmeans/package-registry-npm — appendNpmRegistry', () => {
  test('registers an npm inspector in the context\'s host; its verdicts come from the registry', async () => {
    const context = appendNpmRegistry(makeTestCtx(), { ...standIn.options, concurrency: 2, now: () => Date.parse('2026-11-12T12:00:00Z') })
    const inspector = ensurePackageInspectorService(context).get(NPM_REGISTRY)
    expect(inspector?.registry).toBe(NPM_REGISTRY)

    const [dayjs, loadsh, momnet, scripts, missing] = await inspector!.inspectAll(['dayjs', 'loadsh', 'momnet', 'acme-scripts', 'lodsah'])
    expect([dayjs.verdict, dayjs.reasons]).toEqual([PackageVerdictKind.Genuine, [PackageReason.Provenance, PackageReason.Popular]])
    expect(dayjs.docs).toEqual({ homepage: 'https://day.js.org', repository: 'https://github.com/iamkun/dayjs', page: 'https://www.npmjs.com/package/dayjs', readme: true })
    expect([loadsh.verdict, loadsh.lookalikeOf]).toEqual([PackageVerdictKind.Suspicious, 'lodash'])
    expect(loadsh.reasons.slice(0, 3)).toEqual([PackageReason.Lookalike, PackageReason.CopiedDescription, PackageReason.RepositoryMismatch])
    expect([momnet.verdict, momnet.reasons[0]]).toEqual([PackageVerdictKind.Suspicious, PackageReason.Holding])
    expect([scripts.verdict, scripts.reasons]).toEqual([
      PackageVerdictKind.Suspicious, [PackageReason.Young, PackageReason.LowDownloads, PackageReason.InstallScripts, PackageReason.NoRepository],
    ])
    expect([missing.verdict, missing.reasons, missing.lookalikeOf]).toEqual([PackageVerdictKind.Unknown, [PackageReason.NotFound], 'lodash'])
  })
})
