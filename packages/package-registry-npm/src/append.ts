import type { BasicConfig, BasicContext } from '@owlmeans/context'
import { appendPackageInspector } from '@owlmeans/package-inspector'
import { createNpmRegistry } from './registry.js'
import type { AppendNpmRegistryOptions } from './types.js'

/**
 * Register an inspector over the npm registry in the context's package inspector host, under the id
 * `NPM_REGISTRY`; `ensurePackageInspectorService(ctx).get(NPM_REGISTRY)` reaches it. The inspector's
 * own options (`thresholds`, `concurrency`, `now`) pass through.
 */
export const appendNpmRegistry = <C extends BasicConfig, T extends BasicContext<C>>(
  context: T, options: AppendNpmRegistryOptions = {}
): T => {
  const { thresholds, concurrency, now, ...registry } = options

  return appendPackageInspector(context, { registry: createNpmRegistry(registry), thresholds, concurrency, now })
}
