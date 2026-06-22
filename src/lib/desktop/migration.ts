import type { ScriptProject } from '../../types/screenplay'
import {
  hostedLanRoomsKey,
  recentProjectSnapshotsKey,
  recentProjectsKey,
  themeKey,
} from './storageKeys'
import type { MigrationManifestV1, RecentProjectEntry } from './types'

interface MigrationStorage {
  getItem(key: string): string | null
}

interface BuildMigrationManifestOptions {
  storage: MigrationStorage
  sourceVersion: string
  exportedAt?: string
  autosavePath: string | null
}

const readJson = (storage: MigrationStorage, key: string): unknown => {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const isRecentProjectEntry = (value: unknown): value is RecentProjectEntry => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const entry = value as Partial<RecentProjectEntry>
  return (
    typeof entry.label === 'string' &&
    (entry.source === 'project' || entry.source === 'import') &&
    typeof entry.updatedAt === 'string' &&
    (entry.projectId === undefined || typeof entry.projectId === 'string') &&
    (entry.fileGrantId === undefined || typeof entry.fileGrantId === 'string')
  )
}

const isScriptProject = (value: unknown): value is ScriptProject => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const project = value as Partial<ScriptProject>
  return (
    typeof project.id === 'string' &&
    typeof project.schemaVersion === 'number' &&
    Array.isArray(project.blocks) &&
    Boolean(project.meta && typeof project.meta === 'object')
  )
}

const readSnapshots = (storage: MigrationStorage): Record<string, ScriptProject> => {
  const value = readJson(storage, recentProjectSnapshotsKey)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, ScriptProject] => isScriptProject(entry[1]),
    ),
  )
}

export const buildMigrationManifestV1 = ({
  storage,
  sourceVersion,
  exportedAt = new Date().toISOString(),
  autosavePath,
}: BuildMigrationManifestOptions): MigrationManifestV1 => {
  const recentProjectsValue = readJson(storage, recentProjectsKey)
  const hostedRoomsValue = readJson(storage, hostedLanRoomsKey)

  return {
    schemaVersion: 1,
    sourceVersion,
    exportedAt,
    legacyInstall: true,
    tutorialCompleted: true,
    theme: storage.getItem(themeKey) === 'light' ? 'light' : 'dark',
    recentProjects: Array.isArray(recentProjectsValue)
      ? recentProjectsValue.filter(isRecentProjectEntry)
      : [],
    recentProjectSnapshots: readSnapshots(storage),
    hostedLanRooms: Array.isArray(hostedRoomsValue)
      ? hostedRoomsValue.filter((value): value is string => typeof value === 'string')
      : [],
    autosavePath,
  }
}
