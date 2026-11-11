import type { LogPlugin } from '@owlmeans/log'
import { consentedAnalyticsPlugin } from '@owlmeans/web-log'
import type { ConsentedAnalyticsOptions } from '@owlmeans/web-log'
import type { DataLayerWindow } from './types.js'

/**
 * The tag-manager sink for `@owlmeans/log`: pushes `{ event, ...data }` onto `window.dataLayer`,
 * consent permitting — `@owlmeans/web-log`'s `consentedAnalyticsPlugin` gate (analytics by default,
 * an event without consent dropped, never queued). Named `'gtm'` unless `options.name` says
 * otherwise; a no-op outside a browser.
 *
 * ```ts
 * addLogPlugin(gtmAnalyticsPlugin({ allow: ['project.created'] }))
 * logger('projects').info('Created', { kind: 'web' }, { analytics: 'project.created' })
 * ```
 */
export const gtmAnalyticsPlugin = (options: ConsentedAnalyticsOptions = {}): LogPlugin =>
  consentedAnalyticsPlugin(payload => {
    if (typeof window === 'undefined') {
      return
    }
    const win = window as unknown as DataLayerWindow
    win.dataLayer = win.dataLayer ?? []
    win.dataLayer.push(payload)
  }, { name: 'gtm', ...options })
