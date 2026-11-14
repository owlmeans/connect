import { describe, expect, test } from 'bun:test'
import { createRepositoryLocator, repositoryLocator, RepositoryHost } from '../src/index.js'

describe('@owlmeans/package-registry-npm — repository locator', () => {
  test('locates every declared form on GitHub and GitLab', () => {
    const github = { host: RepositoryHost.GitHub, path: 'lodash/lodash' }
    for (const url of [
      'git+https://github.com/lodash/lodash.git', 'https://github.com/lodash/lodash', 'git://github.com/lodash/lodash.git',
      'git+ssh://git@github.com/lodash/lodash.git', 'git@github.com:lodash/lodash.git', 'github:lodash/lodash', 'lodash/lodash',
      'https://www.github.com/lodash/lodash/', 'github.com/lodash/lodash',
    ]) {
      expect(repositoryLocator.locate(url)).toEqual(github)
    }
    expect(repositoryLocator.locate('https://github.com/vitejs/vite/tree/main/packages/vite')).toEqual({
      host: RepositoryHost.GitHub, path: 'vitejs/vite', directory: 'packages/vite',
    })
    expect(repositoryLocator.locate('https://github.com/vitejs/vite/tree/main/packages/vite', './packages/other/')).toEqual({
      host: RepositoryHost.GitHub, path: 'vitejs/vite', directory: 'packages/other',
    })
    expect(repositoryLocator.locate('gitlab:group/sub/project')).toEqual({ host: RepositoryHost.GitLab, path: 'group/sub/project' })
    expect(repositoryLocator.locate('https://gitlab.com/group/sub/project.git')).toEqual({ host: RepositoryHost.GitLab, path: 'group/sub/project' })
    expect(repositoryLocator.locate('https://gitlab.com/group/project/-/tree/main/packages/x')).toEqual({
      host: RepositoryHost.GitLab, path: 'group/project', directory: 'packages/x',
    })
    for (const url of ['https://bitbucket.org/a/b', 'bitbucket:a/b', 'https://github.com/only-owner', 'not a url', '']) {
      expect(repositoryLocator.locate(url)).toBeNull()
    }
  })

  test('derives the browsable page on the public host and raw files on the configured one', () => {
    const locator = createRepositoryLocator({ githubRaw: 'http://127.0.0.1:1/github/', gitlab: 'http://127.0.0.1:1/gitlab' })
    const vite = { host: RepositoryHost.GitHub, path: 'vitejs/vite', directory: 'packages/vite' }
    const project = { host: RepositoryHost.GitLab, path: 'group/project' }

    expect(locator.webOf(vite)).toBe('https://github.com/vitejs/vite/tree/HEAD/packages/vite')
    expect(locator.rawUrlOf(vite, 'package.json')).toBe('http://127.0.0.1:1/github/vitejs/vite/HEAD/packages/vite/package.json')
    expect(locator.webOf(project)).toBe('https://gitlab.com/group/project')
    expect(locator.rawUrlOf(project, 'README.md')).toBe('http://127.0.0.1:1/gitlab/group/project/-/raw/HEAD/README.md')
    expect(repositoryLocator.rawUrlOf(project, 'package.json')).toBe('https://gitlab.com/group/project/-/raw/HEAD/package.json')
  })
})
