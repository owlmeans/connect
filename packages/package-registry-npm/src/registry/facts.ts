import type { PackageEntry, PackageExportsMap, PackageRepository } from '@owlmeans/package-inspector'
import { NPM_HOLDING_DESCRIPTION, NPM_HOLDING_VERSION, NPM_INSTALL_SCRIPTS, NPM_PACKAGE_PAGE_URL } from '../consts.js'
import type { NpmRepositoryField, NpmVersion } from '../types.local.js'
import type { NpmFactsMapper, NpmFactsOptions } from './types.local.js'

export const createNpmFactsMapper = (options: NpmFactsOptions): NpmFactsMapper => {
  const text = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

  const repositoryOf = (field: NpmRepositoryField | undefined): PackageRepository | undefined => {
    const url = text(typeof field === 'string' ? field : field?.url)
    if (url == null) {
      return undefined
    }
    const directory = typeof field === 'object' ? text(field.directory) : undefined
    const location = options.locator.locate(url, directory)

    return {
      url,
      ...(location?.directory != null ? { directory: location.directory } : directory != null ? { directory } : {}),
      ...(location != null ? { web: options.locator.webOf(location) } : {}),
    }
  }

  const licenseOf = (field: string | { type?: string } | undefined): string | undefined =>
    typeof field === 'string' ? text(field) : text(field?.type)

  /** The exports map as JSON allows it — strings, `null`, lists and objects; anything else dropped. */
  const exportsOf = (value: unknown): PackageExportsMap | undefined => {
    if (value === null || typeof value === 'string') return value
    if (Array.isArray(value)) return value.map(exportsOf).filter((item): item is PackageExportsMap => item !== undefined)
    if (typeof value !== 'object') return undefined
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, exportsOf(item)] as const)
      .filter((entry): entry is readonly [string, PackageExportsMap] => entry[1] !== undefined)

    return Object.fromEntries(entries)
  }

  /** How the version is imported, as its manifest declares it; absent when it declares nothing. */
  const entryOf = (version: NpmVersion | undefined): PackageEntry | undefined => {
    const type = text(version?.type)
    const main = text(version?.main)
    const module = text(version?.module)
    const types = text(version?.types) ?? text(version?.typings)
    const exports = exportsOf(version?.exports)
    const entry: PackageEntry = {
      ...(type != null ? { type } : {}), ...(main != null ? { main } : {}), ...(module != null ? { module } : {}),
      ...(types != null ? { types } : {}), ...(exports !== undefined ? { exports } : {}),
    }

    return Object.keys(entry).length > 0 ? entry : undefined
  }

  const factsOf: NpmFactsMapper['factsOf'] = (name, packument, latestDocument) => {
    const latest = text(packument?.['dist-tags']?.latest) ?? text(latestDocument?.version)
    const versions = packument?.versions ?? {}
    const version = latestDocument ?? (latest != null ? versions[latest] : undefined)
    const description = text(packument?.description) ?? text(version?.description)
    const scripts = version?.scripts ?? {}
    const installScripts = NPM_INSTALL_SCRIPTS.filter(script => text(scripts[script]) != null)
    // npm runs `node-gyp rebuild` as the install script of a package that ships a binding and names none.
    if (version?.gypfile === true && !installScripts.includes('install')) {
      installScripts.push('install')
    }
    const maintainers = packument?.maintainers ?? version?.maintainers
    const readme = text(packument?.readme)
    const repository = repositoryOf(packument?.repository ?? version?.repository)
    const homepage = text(packument?.homepage) ?? text(version?.homepage)
    const license = licenseOf(packument?.license ?? version?.license)
    const deprecated = typeof version?.deprecated === 'string' ? text(version.deprecated) : undefined
    const entry = entryOf(version)
    const created = text(packument?.time?.created)
    const modified = text(packument?.time?.modified)

    return {
      name: text(packument?.name) ?? text(version?.name) ?? name,
      ...(description != null ? { description } : {}),
      ...(latest != null ? { latest } : {}),
      ...(created != null ? { created } : {}),
      ...(modified != null ? { modified } : {}),
      ...(packument != null ? { versionCount: Object.keys(versions).length } : {}),
      ...(Array.isArray(maintainers) ? { maintainerCount: maintainers.length } : {}),
      ...(deprecated != null ? { deprecated } : {}),
      installScripts,
      ...(repository != null ? { repository } : {}),
      ...(homepage != null ? { homepage } : {}),
      ...(license != null ? { license } : {}),
      page: `${NPM_PACKAGE_PAGE_URL}/${name}`,
      provenance: version?.dist?.attestations?.provenance != null,
      holding: latest === NPM_HOLDING_VERSION || description?.toLowerCase() === NPM_HOLDING_DESCRIPTION,
      unpublished: packument?.time?.unpublished != null && Object.keys(versions).length === 0,
      ...(readme != null ? { readme: readme.slice(0, options.maxReadmeChars) } : {}),
      ...(readme != null && readme.length > options.maxReadmeChars ? { readmeTruncated: true } : {}),
      ...(entry != null ? { entry } : {}),
      ...(packument == null ? { partial: true } : {}),
    }
  }

  return { factsOf }
}
