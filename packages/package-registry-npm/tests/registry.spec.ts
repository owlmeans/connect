import { afterAll, describe, expect, test } from 'bun:test'
import { PackageRegistryError } from '@owlmeans/package-inspector'
import { createNpmRegistry, NPM_REGISTRY } from '../src/index.js'
import type { NpmRegistryOptions } from '../src/index.js'
import { startStandIn } from './context.js'
import { DOWNLOADS } from './fixtures.js'

const standIn = startStandIn()
afterAll(() => standIn.stop())

const registryOf = (extra: NpmRegistryOptions = {}) => createNpmRegistry({ ...standIn.options, ...extra })
const callsAfter = (mark: number): string[] => standIn.calls.slice(mark)

describe('@owlmeans/package-registry-npm — manifest', () => {
  test('maps a packument onto neutral facts', async () => {
    const registry = registryOf()

    expect(registry.id).toBe(NPM_REGISTRY)
    expect(await registry.manifest('loadsh')).toEqual({
      name: 'loadsh', description: 'Lodash modular utilities.', latest: '0.0.4',
      created: '2018-09-13T06:41:39.649Z', modified: '2022-12-13T02:39:28.282Z', versionCount: 4, maintainerCount: 1,
      deprecated: 'This is a typosquat on the popular Lodash package. This is not maintained nor is the original Lodash package.',
      installScripts: [],
      repository: { url: 'git+https://github.com/lodash/lodash.git', web: 'https://github.com/lodash/lodash' },
      homepage: 'https://lodash.com/', license: 'MIT', page: 'https://www.npmjs.com/package/loadsh',
      provenance: false, holding: false, unpublished: false,
      readme: '# lodash v0.0.4\n\nThe [lodash](https://lodash.com/) library exported as modules.',
    })
    expect(await registry.manifest('dayjs')).toMatchObject({ provenance: true, entry: { main: 'dayjs.min.js', types: 'index.d.ts' } })
    expect(await registry.manifest('momnet')).toMatchObject({ holding: true, latest: '0.0.1-security', maintainerCount: 0 })
    expect(await registry.manifest('acme-scripts')).toMatchObject({ installScripts: ['postinstall', 'install'], license: 'ISC' })
    expect(await registry.manifest('acme-gone')).toMatchObject({ unpublished: true, versionCount: 0, holding: false })
  })

  test('encodes a scoped name as one path segment; an unknown name is null', async () => {
    const registry = registryOf()
    const mark = standIn.calls.length

    expect(await registry.manifest('@acme/widgets')).toMatchObject({
      name: '@acme/widgets',
      // The manifest's entry points, `typings` read as `types`, a non-JSON-path value dropped.
      entry: {
        type: 'module', types: './dist/index.d.ts',
        exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js', require: './dist/index.cjs' }, './button': './dist/button.js' },
      },
      repository: {
        url: 'https://gitlab.com/acme/platform.git', directory: 'packages/widgets',
        web: 'https://gitlab.com/acme/platform/-/tree/HEAD/packages/widgets',
      },
    })
    expect(await registry.manifest('no-such-package-here')).toBeNull()
    expect(callsAfter(mark)).toEqual(['/registry/@acme/widgets', '/registry/no-such-package-here'])
  })

  test('a packument past the cap is read through its latest version, the readme from the repository', async () => {
    const registry = registryOf({ maxDocumentBytes: 64 * 1024 })

    for (const name of ['big-package', 'big-stream']) {
      const mark = standIn.calls.length
      expect(await registry.manifest(name)).toEqual({
        name, description: 'A big package', latest: '9.9.9', maintainerCount: 2, installScripts: [],
        repository: { url: 'git+https://github.com/acme/big.git', web: 'https://github.com/acme/big' },
        license: 'MIT', page: `https://www.npmjs.com/package/${name}`, provenance: true, holding: false, unpublished: false,
        readme: '# Big package\n\nRead me from the repository.', partial: true,
      })
      expect(callsAfter(mark)).toEqual([`/registry/${name}`, `/registry/${name}/latest`, '/github/acme/big/HEAD/README.md'])
    }
  })

  test('a failing, slow or unreadable registry is a PackageRegistryError naming the cause', async () => {
    const cases: Array<[string, string]> = [['flaky', 'npm:packument:flaky:503'], ['slow', 'npm:packument:slow:timeout'], ['garbage', 'npm:packument:garbage:malformed']]
    for (const [name, cause] of cases) {
      const error = await registryOf({ timeoutMs: 100, retries: 0 }).manifest(name).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(PackageRegistryError)
      expect((error as Error).message).toBe(`package-inspector:registry:${cause}`)
    }
  })
})

describe('@owlmeans/package-registry-npm — downloads and neighbours', () => {
  test('prices unscoped names in bulk calls of at most 128, scoped names one by one, unknown as null', async () => {
    const registry = registryOf()
    const filler = Array.from({ length: 200 }, (_, i) => `filler-${i}`)
    const mark = standIn.calls.length

    const counts = await registry.downloads(['lodash', 'loadsh', 'nothing-here', '@acme/widgets', '@acme/nothing', ...filler])
    expect([counts.lodash, counts.loadsh, counts['nothing-here'], counts['@acme/widgets'], counts['@acme/nothing'], counts['filler-7']])
      .toEqual([DOWNLOADS.lodash, DOWNLOADS.loadsh, null, 1_200, null, null])
    const calls = callsAfter(mark)
    expect(calls.filter(call => call.startsWith('/api/downloads/point/last-week/') && call.includes(','))).toHaveLength(2)
    expect(calls).toEqual(expect.arrayContaining(['/api/downloads/point/last-week/@acme/widgets', '/api/downloads/point/last-week/@acme/nothing']))

    // Counts are reused; a single name takes npm's single-package answer.
    const again = standIn.calls.length
    expect(await registry.downloads(['loadsh', 'nothing-here'])).toEqual({ loadsh: DOWNLOADS.loadsh, 'nothing-here': null })
    expect(await registry.downloads(['dayjs'])).toEqual({ dayjs: DOWNLOADS.dayjs })
    expect(callsAfter(again)).toEqual(['/api/downloads/point/last-week/dayjs'])
  })

  test('retries a throttled call after the server\'s retry-after', async () => {
    const mark = standIn.calls.length

    expect(await registryOf({ cacheTtlMs: 0 }).downloads(['throttled-once'])).toEqual({ 'throttled-once': 7 })
    expect(callsAfter(mark)).toEqual(['/api/downloads/point/last-week/throttled-once', '/api/downloads/point/last-week/throttled-once'])
  })

  test('neighbours are the existing variants, most downloaded first, bounded', async () => {
    const mark = standIn.calls.length

    expect(await registryOf().neighbours('loadsh')).toEqual(['lodash'])
    const calls = callsAfter(mark)
    expect(calls.length).toBeGreaterThanOrEqual(4)
    expect(calls.every(call => call.startsWith('/api/downloads/point/last-week/') && call.split(',').length <= 128)).toBe(true)

    expect(await registryOf().neighbours('lodas')).toEqual(['lodash', 'lodahs'])
    expect(await registryOf({ maxNeighbours: 1 }).neighbours('lodas')).toEqual(['lodash'])
    // Only the four affix variants are priced: `moment`, a transposition, is past the bound.
    const bounded = standIn.calls.length
    expect(await registryOf({ maxVariants: 4 }).neighbours('momnet')).toEqual([])
    expect(callsAfter(bounded)).toHaveLength(1)
    expect(await registryOf({ maxVariants: 9 }).neighbours('momnet')).toEqual(['moment'])
  })
})

describe('@owlmeans/package-registry-npm — repository manifests', () => {
  test('reads the repository\'s own package.json at the declared directory; a root is marked', async () => {
    const registry = registryOf()

    expect(await registry.repositoryManifest({ url: 'git+https://github.com/lodash/lodash.git' })).toEqual({ name: 'lodash', root: true })
    expect(await registry.repositoryManifest({ url: 'github:iamkun/dayjs' })).toEqual({ name: 'dayjs', root: false })
    expect(await registry.repositoryManifest({ url: 'https://gitlab.com/acme/platform.git', directory: 'packages/widgets' }))
      .toEqual({ name: '@acme/widgets', root: false })
    expect(await registry.repositoryManifest({ url: 'https://gitlab.com/acme/platform' })).toEqual({ name: 'acme-platform', root: true })
    expect(await registry.repositoryManifest({ url: 'git+https://github.com/acme/missing.git' })).toBeNull()
    expect(await registry.repositoryManifest({ url: 'https://bitbucket.org/acme/x' })).toBeNull()
  })
})
