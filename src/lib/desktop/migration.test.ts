import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../screenplay'
import {
  hostedLanRoomsKey,
  recentProjectSnapshotsKey,
  recentProjectsKey,
  themeKey,
} from './storageKeys'
import { buildMigrationManifestV1 } from './migration'

class MemoryStorage implements Pick<Storage, 'getItem'> {
  private readonly values: Record<string, string>

  constructor(values: Record<string, string>) {
    this.values = values
  }

  getItem(key: string): string | null {
    return this.values[key] ?? null
  }
}

describe('buildMigrationManifestV1', () => {
  it('exports the Electron-owned state and permanently suppresses first-run onboarding', () => {
    const project = createEmptyProject()
    const recentProjects = [
      {
        label: 'C:\\Scripts\\feature.msproj.json',
        source: 'project' as const,
        updatedAt: '2026-06-21T10:00:00.000Z',
        projectId: project.id,
      },
    ]
    const storage = new MemoryStorage({
      [themeKey]: 'light',
      [recentProjectsKey]: JSON.stringify(recentProjects),
      [recentProjectSnapshotsKey]: JSON.stringify({ [project.id]: project }),
      [hostedLanRoomsKey]: JSON.stringify(['room-a', 'room-b']),
    })

    const manifest = buildMigrationManifestV1({
      storage,
      sourceVersion: '0.1.13',
      exportedAt: '2026-06-21T11:00:00.000Z',
      autosavePath: 'C:\\Users\\Example\\AppData\\Roaming\\MasterScript\\autosave.msproj.json',
    })

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      sourceVersion: '0.1.13',
      exportedAt: '2026-06-21T11:00:00.000Z',
      legacyInstall: true,
      tutorialCompleted: true,
      theme: 'light',
      recentProjects,
      hostedLanRooms: ['room-a', 'room-b'],
      autosavePath: 'C:\\Users\\Example\\AppData\\Roaming\\MasterScript\\autosave.msproj.json',
    })
    expect(manifest.recentProjectSnapshots[project.id]).toEqual(project)
  })

  it('rejects malformed or incorrectly shaped browser state without failing export', () => {
    const storage = new MemoryStorage({
      [themeKey]: 'purple',
      [recentProjectsKey]: '{broken',
      [recentProjectSnapshotsKey]: JSON.stringify({ unsafe: { id: 42 } }),
      [hostedLanRoomsKey]: JSON.stringify(['valid', 12, null]),
    })

    const manifest = buildMigrationManifestV1({
      storage,
      sourceVersion: '0.1.13',
      exportedAt: '2026-06-21T11:00:00.000Z',
      autosavePath: null,
    })

    expect(manifest.theme).toBe('dark')
    expect(manifest.recentProjects).toEqual([])
    expect(manifest.recentProjectSnapshots).toEqual({})
    expect(manifest.hostedLanRooms).toEqual(['valid'])
  })
})
