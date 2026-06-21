import {
  hostedLanRoomsKey,
  recentProjectsKey,
  themeKey,
} from './storageKeys'
import type {
  BootstrapInstallationResult,
  DesktopBridge,
  MigrationManifestV1,
} from './types'

interface MigrationStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const tauriMigrationAppliedKey =
  'masterscript-tauri-migration-v1-applied'

export const applyMigrationManifestToStorage = (
  storage: MigrationStorage,
  manifest: MigrationManifestV1,
): boolean => {
  if (
    storage.getItem(tauriMigrationAppliedKey) === '1' ||
    manifest.schemaVersion !== 1 ||
    manifest.legacyInstall !== true
  ) {
    return false
  }

  storage.setItem(themeKey, manifest.theme)
  storage.setItem(recentProjectsKey, JSON.stringify(manifest.recentProjects))
  storage.setItem(hostedLanRoomsKey, JSON.stringify(manifest.hostedLanRooms))
  storage.setItem(tauriMigrationAppliedKey, '1')
  return true
}

export const initializeDesktopRuntime = async (
  bridge: DesktopBridge,
  storage: MigrationStorage,
): Promise<BootstrapInstallationResult | null> => {
  if (bridge.runtime !== 'tauri') {
    return null
  }

  const result = await bridge.bootstrapInstallation()
  if (result.migrationManifest) {
    applyMigrationManifestToStorage(storage, result.migrationManifest)
  }
  return result
}
