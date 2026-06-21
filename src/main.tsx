import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeDesktopRuntime } from './lib/desktop/desktopBootstrap'
import { desktopBridge } from './lib/desktop/desktopBridge'

try {
  await initializeDesktopRuntime(desktopBridge, localStorage)
} catch {
  // A failed native bootstrap must not prevent access to local project files.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
