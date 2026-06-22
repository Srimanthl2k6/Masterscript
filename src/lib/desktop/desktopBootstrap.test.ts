import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../screenplay'
import {
  applyMigrationManifestToStorage,
  initializeDesktopRuntime,
  tauriMigrationAppliedKey,
} from './desktopBootstrap'
import {
  hostedLanRoomsKey,
  recentProjectsKey,
  themeKey,
} from './storageKeys'
import type { DesktopBridge, MigrationManifestV1 } from './types'

class MemoryStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const createManifest = (): MigrationManifestV1 => {
  const project = createEmptyProject()
  return {
    schemaVersion: 1,
    sourceVersion: '0.1.14',
    exportedAt: '2026-06-21T13:00:00.000Z',
    legacyInstall: true,
    tutorialCompleted: true,
    theme: 'light',
    recentProjects: [
      {
        label: 'feature.msproj.json',
        source: 'project',
        updatedAt: '2026-06-21T13:00:00.000Z',
        projectId: project.id,
      },
    ],
    recentProjectSnapshots: { [project.id]: project },
    hostedLanRooms: ['room-a'],
    autosavePath: '/legacy/autosave.msproj.json',
  }
}

describe('desktop bootstrap migration', () => {
  it('hydrates Electron browser state exactly once before React mounts', () => {
    const storage = new MemoryStorage()
    const manifest = createManifest()

    expect(applyMigrationManifestToStorage(storage, manifest)).toBe(true)
    expect(storage.getItem(themeKey)).toBe('light')
    expect(JSON.parse(storage.getItem(recentProjectsKey) ?? '[]')).toEqual(
      manifest.recentProjects,
    )
    expect(JSON.parse(storage.getItem(hostedLanRoomsKey) ?? '[]')).toEqual([
      'room-a',
    ])
    expect(storage.getItem(tauriMigrationAppliedKey)).toBe('1')
    expect(applyMigrationManifestToStorage(storage, manifest)).toBe(false)
  })

  it('requests native bootstrap only in Tauri and applies a valid legacy manifest', async () => {
    const storage = new MemoryStorage()
    const manifest = createManifest()
    const bootstrapInstallation = vi.fn().mockResolvedValue({
      installState: {
        kind: 'legacy-migrated',
        tutorialCompleted: true,
        migrationVersion: 1,
      },
      migrationManifest: manifest,
    })
    const bridge = {
      runtime: 'tauri',
      bootstrapInstallation,
    } as unknown as DesktopBridge

    await initializeDesktopRuntime(bridge, storage)

    expect(bootstrapInstallation).toHaveBeenCalledOnce()
    expect(storage.getItem(themeKey)).toBe('light')
  })

  it('restores the imported manifest for an existing Tauri install after webview storage loss', async () => {
    const storage = new MemoryStorage()
    const manifest = createManifest()
    const bridge = {
      runtime: 'tauri',
      bootstrapInstallation: vi.fn().mockResolvedValue({
        installState: {
          kind: 'existing-tauri',
          tutorialCompleted: true,
          migrationVersion: 1,
        },
        migrationManifest: manifest,
      }),
    } as unknown as DesktopBridge

    await initializeDesktopRuntime(bridge, storage)

    expect(storage.getItem(themeKey)).toBe('light')
    expect(storage.getItem(tauriMigrationAppliedKey)).toBe('1')
  })

  it('filters malformed migration collections before writing webview storage', () => {
    const storage = new MemoryStorage()
    const manifest = createManifest()
    manifest.recentProjects.push({
      label: '',
      source: 'project',
      updatedAt: '',
    })
    manifest.hostedLanRooms.push('', 'room-a')

    expect(applyMigrationManifestToStorage(storage, manifest)).toBe(true)
    expect(JSON.parse(storage.getItem(recentProjectsKey) ?? '[]')).toHaveLength(1)
    expect(JSON.parse(storage.getItem(hostedLanRoomsKey) ?? '[]')).toEqual([
      'room-a',
    ])
  })
})
