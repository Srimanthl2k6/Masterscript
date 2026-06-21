import type { DesktopNativeApi } from '../lib/desktop/types'

declare global {
  interface Window {
    masterscript?: DesktopNativeApi
    __TAURI_INTERNALS__?: unknown
  }
}

export {}
