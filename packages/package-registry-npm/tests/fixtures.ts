/**
 * Registry documents the stand-in serves. `lodash`, `loadsh`, `dayjs` and `momnet` are trimmed copies of
 * the public npm packuments of 2026-11-12 (maintainer e-mails dropped); the `acme*` packages are
 * invented to isolate one case each.
 */

const LODASH_REPOSITORY = { type: 'git', url: 'git+https://github.com/lodash/lodash.git' }
const TYPOSQUAT = 'This is a typosquat on the popular Lodash package. This is not maintained nor is the original Lodash package.'

const loadshVersion = (version: string): Record<string, unknown> => ({
  name: 'loadsh', version, description: 'Lodash modular utilities.', deprecated: TYPOSQUAT, license: 'MIT',
  scripts: { test: 'echo "See https://travis-ci.org/lodash-archive/lodash-cli for testing details."' },
  repository: LODASH_REPOSITORY, homepage: 'https://lodash.com/', dist: { signatures: [] }, maintainers: [{ name: 'atool' }],
})

export const PACKUMENTS: Record<string, Record<string, unknown>> = {
  loadsh: {
    _id: 'loadsh', name: 'loadsh', 'dist-tags': { latest: '0.0.4' },
    time: { created: '2018-09-13T06:41:39.649Z', modified: '2022-12-13T02:39:28.282Z' },
    versions: Object.fromEntries(['0.0.1', '0.0.2', '0.0.3', '0.0.4'].map(version => [version, loadshVersion(version)])),
    maintainers: [{ name: 'atool' }], description: 'Lodash modular utilities.', homepage: 'https://lodash.com/',
    repository: LODASH_REPOSITORY, license: 'MIT', readme: '# lodash v0.0.4\n\nThe [lodash](https://lodash.com/) library exported as modules.',
  },
  lodash: {
    _id: 'lodash', name: 'lodash', 'dist-tags': { latest: '4.18.1' },
    time: { created: '2012-04-23T16:37:11.912Z', modified: '2026-11-12T00:37:01.729Z' },
    versions: { '4.18.1': { name: 'lodash', version: '4.18.1', description: 'Lodash modular utilities.', repository: LODASH_REPOSITORY } },
    maintainers: [{ name: 'jdalton' }], description: 'Lodash modular utilities.', homepage: 'https://lodash.com/',
    repository: LODASH_REPOSITORY, license: 'MIT', readme: '# lodash',
  },
  dayjs: {
    _id: 'dayjs', name: 'dayjs', 'dist-tags': { latest: '1.11.23' },
    time: { created: '2018-04-10T01:31:28.265Z', modified: '2026-08-17T11:52:35.546Z' },
    versions: {
      '1.11.23': {
        name: 'dayjs', version: '1.11.23', scripts: { test: 'jest', build: 'node build' },
        main: 'dayjs.min.js', types: 'index.d.ts',
        dist: { attestations: { url: 'https://registry.npmjs.org/-/npm/v1/attestations/dayjs@1.11.23', provenance: { predicateType: 'https://slsa.dev/provenance/v1' } } },
      },
    },
    maintainers: [{ name: 'iamkun' }], description: '2KB immutable date time library alternative to Moment.js with the same modern API ',
    homepage: 'https://day.js.org', repository: { url: 'git+https://github.com/iamkun/dayjs.git', type: 'git' }, license: 'MIT', readme: '# Day.js',
  },
  momnet: {
    _id: 'momnet', name: 'momnet', 'dist-tags': { latest: '0.0.1-security' },
    time: { created: '2025-01-31T01:14:14.312Z', modified: '2025-01-31T01:14:16.511Z' },
    versions: { '0.0.1-security': { name: 'momnet', version: '0.0.1-security', description: 'security holding package', repository: 'npm/security-holder', maintainers: [] } },
    maintainers: [], description: 'security holding package', repository: 'npm/security-holder', readme: '',
  },
  'acme-scripts': {
    name: 'acme-scripts', 'dist-tags': { latest: '1.0.0' }, time: { created: '2026-11-09T10:00:00.000Z' },
    versions: { '1.0.0': { name: 'acme-scripts', version: '1.0.0', scripts: { postinstall: 'node setup.js', test: 'x' }, gypfile: true, license: { type: 'ISC' } } },
    description: 'Native helpers',
  },
  '@acme/widgets': {
    name: '@acme/widgets', 'dist-tags': { latest: '2.0.0' }, time: { created: '2024-01-01T00:00:00.000Z' },
    versions: {
      '2.0.0': {
        name: '@acme/widgets', version: '2.0.0', type: 'module', typings: './dist/index.d.ts',
        exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js', require: './dist/index.cjs' }, './button': './dist/button.js', './legacy': 7 },
      },
    },
    description: 'Widgets',
    repository: { type: 'git', url: 'https://gitlab.com/acme/platform.git', directory: 'packages/widgets' },
  },
  'acme-gone': { _id: 'acme-gone', name: 'acme-gone', time: { created: '2020-01-01T00:00:00.000Z', unpublished: { time: '2021-01-01T00:00:00.000Z' } } },
}

/** The latest version's documents of the packuments too large to read whole. */
export const LATEST: Record<string, Record<string, unknown>> = {
  'big-package': {
    name: 'big-package', version: '9.9.9', description: 'A big package', license: 'MIT',
    repository: { type: 'git', url: 'git+https://github.com/acme/big.git' }, maintainers: [{ name: 'a' }, { name: 'b' }],
    dist: { attestations: { provenance: { predicateType: 'https://slsa.dev/provenance/v1' } } },
  },
}
LATEST['big-stream'] = { ...LATEST['big-package'], name: 'big-stream' }

/** A packument of `versions` versions, padded — well past a small cap. */
export const bigPackument = (name: string, versions = 2_000): Record<string, unknown> => ({
  name,
  'dist-tags': { latest: '9.9.9' },
  versions: Object.fromEntries(Array.from({ length: versions }, (_, i) => [`0.0.${i}`, { name, version: `0.0.${i}`, description: 'x'.repeat(64) }])),
  readme: 'never reached',
})

export const DOWNLOADS: Record<string, number> = {
  lodash: 199_506_230, loadsh: 13_852, lodas: 64, ldash: 6, lodahs: 105, 'lodash.js': 171,
  dayjs: 107_776_160, moment: 49_425_807, momnet: 35, '@acme/widgets': 1_200, 'acme-scripts': 5, 'throttled-once': 7,
}

/** Raw repository files, by `<host>:<path>/<file>`. */
export const REPOSITORY_FILES: Record<string, string> = {
  'github:lodash/lodash/package.json': JSON.stringify({ name: 'lodash', version: '4.18.1', private: true }),
  'github:iamkun/dayjs/package.json': JSON.stringify({ name: 'dayjs', version: '0.0.0-development' }),
  'github:acme/big/README.md': '# Big package\n\nRead me from the repository.',
  'gitlab:acme/platform/package.json': JSON.stringify({ name: 'acme-platform', private: true, workspaces: ['packages/*'] }),
  'gitlab:acme/platform/packages/widgets/package.json': JSON.stringify({ name: '@acme/widgets', version: '2.0.0' }),
}
