import { GITHUB_RAW_URL, GITHUB_URL, GITLAB_URL, RepositoryHost } from './consts.js'
import type { RepositoryLocator } from './repository/types.js'
import type { NpmRepositoryHosts } from './types.js'

export const createRepositoryLocator = (hosts: NpmRepositoryHosts = {}): RepositoryLocator => {
  const githubRaw = (hosts.githubRaw ?? GITHUB_RAW_URL).replace(/\/+$/, '')
  const gitlab = (hosts.gitlab ?? GITLAB_URL).replace(/\/+$/, '')

  const tidy = (directory: string | undefined): string | undefined => {
    const text = (directory ?? '').trim().replace(/^\.?\/+/, '').replace(/\/+$/, '')
    return text !== '' && text !== '.' ? text : undefined
  }

  const bare = (name: string): string => name.replace(/\.git$/i, '')

  /** The host and the path segments of a declared address. */
  const partsOf = (url: string): { host: RepositoryHost, segments: string[] } | null => {
    const text = url.trim()
    const shorthand = /^(github|gitlab|bitbucket|gist):(.+)$/i.exec(text)
    if (shorthand != null) {
      const kind = shorthand[1].toLowerCase()
      const host = kind === 'github' ? RepositoryHost.GitHub : kind === 'gitlab' ? RepositoryHost.GitLab : null
      return host != null ? { host, segments: shorthand[2].split('/').filter(Boolean) } : null
    }
    if (/^[\w.-]+\/[\w.-]+$/.test(text)) {
      return { host: RepositoryHost.GitHub, segments: text.split('/') }
    }
    // `git@github.com:o/r.git` (scp form) → an https address; then strip `git+`.
    const scp = /^(?:[\w.-]+@)?([\w.-]+\.[a-z]+):(?!\/\/)(.+)$/i.exec(text.replace(/^git\+/, ''))
    const plain = text.replace(/^git\+/, '')
    const address = scp != null ? `https://${scp[1]}/${scp[2]}` : /^[a-z][a-z+]*:\/\//i.test(plain) ? plain : `https://${plain}`
    let parsed: URL
    try {
      parsed = new URL(address)
    } catch {
      return null
    }
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const host = hostname === 'github.com' ? RepositoryHost.GitHub : hostname === 'gitlab.com' ? RepositoryHost.GitLab : null

    return host != null ? { host, segments: parsed.pathname.split('/').filter(Boolean) } : null
  }

  const locate: RepositoryLocator['locate'] = (url, directory) => {
    const parts = partsOf(url)
    if (parts == null) {
      return null
    }
    const { host, segments } = parts
    let browsed: string | undefined
    let path: string
    if (host === RepositoryHost.GitHub) {
      if (segments.length < 2) {
        return null
      }
      const [owner, name, kind, , ...rest] = segments
      browsed = (kind === 'tree' || kind === 'blob') && rest.length > 0 ? rest.join('/') : undefined
      path = `${owner}/${bare(name)}`
    } else {
      const marker = segments.indexOf('-')
      const project = marker >= 0 ? segments.slice(0, marker) : segments
      if (project.length < 2) {
        return null
      }
      browsed = marker >= 0 && segments[marker + 1] === 'tree' && segments.length > marker + 3
        ? segments.slice(marker + 3).join('/')
        : undefined
      path = [...project.slice(0, -1), bare(project[project.length - 1])].join('/')
    }
    const resolved = tidy(directory) ?? tidy(browsed)

    return { host, path, ...(resolved != null ? { directory: resolved } : {}) }
  }

  const webOf: RepositoryLocator['webOf'] = location => location.host === RepositoryHost.GitHub
    ? `${GITHUB_URL}/${location.path}${location.directory != null ? `/tree/HEAD/${location.directory}` : ''}`
    : `${GITLAB_URL}/${location.path}${location.directory != null ? `/-/tree/HEAD/${location.directory}` : ''}`

  const rawUrlOf: RepositoryLocator['rawUrlOf'] = (location, file) => {
    const path = `${location.directory != null ? `${location.directory}/` : ''}${file}`

    return location.host === RepositoryHost.GitHub
      ? `${githubRaw}/${location.path}/HEAD/${path}`
      : `${gitlab}/${location.path}/-/raw/HEAD/${path}`
  }

  return { locate, webOf, rawUrlOf }
}

export const repositoryLocator = createRepositoryLocator()
