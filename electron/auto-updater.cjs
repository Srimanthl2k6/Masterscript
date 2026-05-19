const formatVersion = (info) => {
  if (!info || typeof info.version !== 'string' || info.version.length === 0) {
    return 'unknown version'
  }

  return info.version
}

const configureAutoUpdates = ({ autoUpdater, isDev, logger = console }) => {
  if (!autoUpdater) {
    return {
      checkForUpdates: async () => false,
    }
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    logger.info('[auto-update] Checking for updates')
  })

  autoUpdater.on('update-available', (info) => {
    logger.info(`[auto-update] Update available: ${formatVersion(info)}`)
  })

  autoUpdater.on('update-not-available', (info) => {
    logger.info(`[auto-update] No update available: ${formatVersion(info)}`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    logger.info(
      `[auto-update] Update downloaded: ${formatVersion(info)}. It will install after the app quits.`,
    )
  })

  autoUpdater.on('error', (error) => {
    logger.error('[auto-update] Update error', error)
  })

  return {
    checkForUpdates: async () => {
      if (isDev) {
        logger.info('[auto-update] Skipping update checks in development')
        return false
      }

      try {
        await autoUpdater.checkForUpdatesAndNotify()
        return true
      } catch (error) {
        logger.error('[auto-update] Update check failed', error)
        return false
      }
    },
  }
}

module.exports = { configureAutoUpdates }
