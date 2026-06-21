import { useEffect } from 'react'
import type { DesktopRuntime } from './types'

export const useTauriCloseFlush = (
  runtime: DesktopRuntime,
  flush: (force?: boolean) => Promise<void>,
) => {
  useEffect(() => {
    if (runtime !== 'tauri') {
      return
    }

    let active = true
    let closingAfterFlush = false
    let removeListener: (() => void) | null = null
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      if (!active) {
        return
      }
      const appWindow = getCurrentWindow()
      removeListener = await appWindow.onCloseRequested(async (event) => {
        if (closingAfterFlush) {
          return
        }
        event.preventDefault()
        await flush(true)
        closingAfterFlush = true
        await appWindow.destroy()
      })
    })

    return () => {
      active = false
      removeListener?.()
    }
  }, [flush, runtime])
}
