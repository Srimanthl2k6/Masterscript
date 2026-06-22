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

const sanitizeRecentProjects = (
  manifest: MigrationManifestV1,
): MigrationManifestV1['recentProjects'] =>
  manifest.recentProjects
    .filter(
      (entry) =>
        typeof entry.label === 'string' &&
        entry.label.trim().length > 0 &&
        (entry.source === 'project' || entry.source === 'import') &&
        typeof entry.updatedAt === 'string' &&
        entry.updatedAt.trim().length > 0 &&
        (entry.projectId === undefined || typeof entry.projectId === 'string') &&
        (entry.fileGrantId === undefined ||
          typeof entry.fileGrantId === 'string'),
    )
    .slice(0, 100)

const sanitizeHostedRooms = (rooms: string[]): string[] =>
  [...new Set(rooms.filter((room) => room.trim().length > 0))].slice(0, 100)

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
  storage.setItem(
    recentProjectsKey,
    JSON.stringify(sanitizeRecentProjects(manifest)),
  )
  storage.setItem(
    hostedLanRoomsKey,
    JSON.stringify(sanitizeHostedRooms(manifest.hostedLanRooms)),
  )
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
