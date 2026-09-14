import { desktopBridge } from './desktopBridge'
import { createUpdateController, type UpdateSafety } from './updateController'

export const startDesktopUpdater = (safety: UpdateSafety, status: (message: string) => void): (() => void) => {
  if (desktopBridge.runtime !== 'tauri') return () => {}
  const controller = createUpdateController({
    safety, status,
    check: async () => { const { check } = await import('@tauri-apps/plugin-updater'); return check({ timeout: 30_000 }) },
    managed: async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      return (await invoke<{ managed: boolean }>('installation_update_policy')).managed
    },
    relaunch: async () => { const { relaunch } = await import('@tauri-apps/plugin-process'); await relaunch() },
  })
  let stopped = false
  let timer: ReturnType<typeof setTimeout>
  const tick = async () => {
    await controller.tick()
    if (!stopped) { clearTimeout(timer); timer = setTimeout(() => void tick(), controller.retryDelay) }
  }
  const online = () => { clearTimeout(timer); void tick() }
  timer = setTimeout(() => void tick(), 5_000)
  window.addEventListener('online', online)
  return () => { stopped = true; clearTimeout(timer); controller.stop(); window.removeEventListener('online', online) }
}
