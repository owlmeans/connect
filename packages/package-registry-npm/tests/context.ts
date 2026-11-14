import { AppType, makeBasicContext } from '@owlmeans/context'
import type { BasicConfig, BasicContext } from '@owlmeans/context'
import { makeGates } from '@owlmeans/test'
import type { NpmRegistryOptions } from '../src/index.js'
import { bigPackument, DOWNLOADS, LATEST, PACKUMENTS, REPOSITORY_FILES } from './fixtures.js'

export const gates = makeGates({ live: ['PACKAGE_REGISTRY_NPM_LIVE'] })

export interface StandIn {
  /** Options pointing a registry at the stand-in. */
  options: NpmRegistryOptions
  /** Every request served, as its decoded path. */
  calls: string[]
  stop: () => void
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

/**
 * A real local HTTP server answering like npm's registry (`/registry`), its download counts API
 * (`/api`) and the GitHub / GitLab raw hosts (`/github`, `/gitlab`) — from the fixtures, with npm's
 * own shapes: the bulk map with `null`s, the single-name shape, 404s, the 128-name bulk limit, no
 * scoped names in bulk. `flaky` answers 503, `slow` answers late, `garbage` is not JSON, `big-*` are
 * past a small cap (`big-stream` streamed without a length) and `throttled-once` is throttled once.
 */
export const startStandIn = (): StandIn => {
  const calls: string[] = []
  let throttled = false

  const registry = (rest: string): Response | Promise<Response> => {
    const latest = rest.endsWith('/latest')
    const name = latest ? rest.slice(0, -'/latest'.length) : rest
    if (latest) {
      return LATEST[name] != null ? json(LATEST[name]) : json({ error: 'not found' }, 404)
    }
    switch (name) {
      case 'flaky': return json({ error: 'unavailable' }, 503)
      case 'garbage': return new Response('<html>', { status: 200 })
      case 'slow': return new Promise(resolve => setTimeout(() => resolve(json(PACKUMENTS.lodash)), 1_000))
      case 'big-package': return json(bigPackument(name))
      case 'big-stream': {
        const text = JSON.stringify(bigPackument(name))
        const stream = new ReadableStream<Uint8Array>({
          start: controller => {
            for (let start = 0; start < text.length; start += 8_192) {
              controller.enqueue(new TextEncoder().encode(text.slice(start, start + 8_192)))
            }
            controller.close()
          },
        })
        return new Response(stream, { status: 200, headers: { 'content-type': 'application/json' } })
      }
    }

    return PACKUMENTS[name] != null ? json(PACKUMENTS[name]) : json({ error: 'Not found' }, 404)
  }

  const downloads = (rest: string): Response => {
    const names = rest.replace(/^downloads\/point\/last-week\//, '').split(',').map(decodeURIComponent)
    const point = (name: string) => DOWNLOADS[name] != null
      ? { downloads: DOWNLOADS[name], package: name, start: '2026-11-05', end: '2026-11-11' }
      : null
    if (names.length === 1) {
      if (names[0] === 'throttled-once' && !throttled) {
        throttled = true
        return json({ error: 'slow down' }, 429, { 'retry-after': '0' })
      }
      return point(names[0]) != null ? json(point(names[0])) : json({ error: `package ${names[0]} not found` }, 404)
    }
    if (names.length > 128) {
      return json({ error: 'exceeded max bulk size of 128' }, 400)
    }
    if (names.some(name => name.startsWith('@'))) {
      return json({ error: 'scoped packages are not currently supported in bulk lookups' }, 400)
    }

    return json(Object.fromEntries(names.map(name => [name, point(name)])))
  }

  const raw = (host: string, rest: string): Response => {
    const key = host === 'github' ? `github:${rest.replace(/^([^/]+\/[^/]+)\/HEAD\//, '$1/')}` : `gitlab:${rest.replace('/-/raw/HEAD/', '/')}`
    return REPOSITORY_FILES[key] != null ? new Response(REPOSITORY_FILES[key], { status: 200 }) : new Response('404: Not Found', { status: 404 })
  }

  const server = Bun.serve({
    port: 0,
    fetch: request => {
      const path = decodeURIComponent(new URL(request.url).pathname)
      calls.push(path)
      const [, area, ...parts] = path.split('/')
      const rest = parts.join('/')
      switch (area) {
        case 'registry': return registry(rest)
        case 'api': return downloads(rest)
        case 'github':
        case 'gitlab': return raw(area, rest)
      }
      return new Response('', { status: 404 })
    },
  })
  const base = `http://127.0.0.1:${server.port}`

  return {
    options: {
      registryUrl: `${base}/registry`,
      downloadsUrl: `${base}/api`,
      repositoryHosts: { githubRaw: `${base}/github`, gitlab: `${base}/gitlab` },
      timeoutMs: 2_000,
    },
    calls,
    stop: () => { void server.stop(true) },
  }
}

/** A backend context for the inspector host. */
export const makeTestCtx = (): BasicContext<BasicConfig> =>
  makeBasicContext<BasicConfig>({ ready: false, service: 'package-registry-npm-tests', type: AppType.Backend, services: {} })
