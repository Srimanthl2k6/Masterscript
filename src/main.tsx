import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PublicWebsite from './PublicWebsite'
import { initializeDesktopRuntime } from './lib/desktop/desktopBootstrap'
import { desktopBridge } from './lib/desktop/desktopBridge'
import type { InstallState } from './lib/desktop/types'

let initialInstallState: InstallState | null = null
try {
  initialInstallState = (
    await initializeDesktopRuntime(desktopBridge, localStorage)
  )?.installState ?? null
} catch {
  // A failed native bootstrap must not prevent access to local project files.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicWebsite initialInstallState={initialInstallState} />
  </StrictMode>,
)
