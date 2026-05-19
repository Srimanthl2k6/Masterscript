import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { configureAutoUpdates } = require('./auto-updater.cjs')

const createUpdater = () => {
  const listeners = new Map<string, (...args: unknown[]) => void>()
  const updater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdatesAndNotify: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.set(event, listener)
      return updater
    }),
  }

  return { listeners, updater }
}

describe('auto update coordinator', () => {
  it('skips update checks in development', async () => {
    const { updater } = createUpdater()
    const logger = { info: vi.fn(), error: vi.fn() }

    const updates = configureAutoUpdates({ autoUpdater: updater, isDev: true, logger })
    const checked = await updates.checkForUpdates()

    expect(checked).toBe(false)
    expect(updater.checkForUpdatesAndNotify).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('[auto-update] Skipping update checks in development')
  })

  it('enables automatic downloads and checks releases in production', async () => {
    const { listeners, updater } = createUpdater()
    const logger = { info: vi.fn(), error: vi.fn() }

    const updates = configureAutoUpdates({ autoUpdater: updater, isDev: false, logger })
    const checked = await updates.checkForUpdates()

    expect(checked).toBe(true)
    expect(updater.autoDownload).toBe(true)
    expect(updater.autoInstallOnAppQuit).toBe(true)
    expect(updater.checkForUpdatesAndNotify).toHaveBeenCalledOnce()

    listeners.get('update-available')?.({ version: '0.2.0' })
    listeners.get('update-downloaded')?.({ version: '0.2.0' })

    expect(logger.info).toHaveBeenCalledWith('[auto-update] Update available: 0.2.0')
    expect(logger.info).toHaveBeenCalledWith(
      '[auto-update] Update downloaded: 0.2.0. It will install after the app quits.',
    )
  })

  it('logs and reports failed production update checks', async () => {
    const { updater } = createUpdater()
    const logger = { info: vi.fn(), error: vi.fn() }
    const error = new Error('network unavailable')
    updater.checkForUpdatesAndNotify.mockRejectedValueOnce(error)

    const updates = configureAutoUpdates({ autoUpdater: updater, isDev: false, logger })
    const checked = await updates.checkForUpdates()

    expect(checked).toBe(false)
    expect(logger.error).toHaveBeenCalledWith('[auto-update] Update check failed', error)
  })
})
