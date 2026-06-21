export const autosaveKey = 'masterscript-autosave-v1'
export const themeKey = 'masterscript-theme-v1'
export const recentProjectsKey = 'masterscript-recent-v1'
export const recentProjectSnapshotsKey = 'masterscript-recent-project-snapshots-v1'
export const hostedLanRoomsKey = 'masterscript-hosted-lan-rooms-v1'
export const legacyMigrationStateChangedEvent =
  'masterscript:migration-state-changed'

export const notifyLegacyMigrationStateChanged = (): void => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(legacyMigrationStateChangedEvent))
  }
}
