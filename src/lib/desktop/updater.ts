import { desktopBridge } from './desktopBridge'

export const checkForDesktopUpdate = async (): Promise<boolean> => {
  if (desktopBridge.runtime !== 'tauri') {
    return false
  }

  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (!update) {
      return false
    }

    await update.downloadAndInstall()
    if (
      window.confirm(
        `MasterScript ${update.version} is ready. Restart now to finish updating?`,
      )
    ) {
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    }
    return true
  } catch (error) {
    console.warn('Desktop update check failed', error)
    return false
  }
}
