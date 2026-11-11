import type { DataLayerWindow } from './types.js'

/** The window Consent Mode writes to: the queue, and the setup flag by name. */
export interface ConsentModeWindow extends DataLayerWindow {
  [flag: string]: unknown
}
