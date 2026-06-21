import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  exportLegacyMigrationState,
  recoverAtomicJsonFile,
} from './migration-state.cjs'

const createPaths = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'masterscript-migration-'))
  return {
    directory,
    manifestPath: path.join(directory, 'migration-manifest-v1.json'),
    installStatePath: path.join(directory, 'install-state-v1.json'),
    autosavePath: path.join(directory, 'autosave.msproj.json'),
  }
}

const createManifest = (exportedAt: string) => ({
  schemaVersion: 1,
  sourceVersion: '0.1.14',
  exportedAt,
  legacyInstall: true,
  tutorialCompleted: true,
  theme: 'dark',
  recentProjects: [],
  recentProjectSnapshots: {},
  hostedLanRooms: [],
  autosavePath: null,
})

describe('Electron migration state export', () => {
  it('writes tutorial suppression before an atomic manifest handoff', async () => {
    const paths = await createPaths()

    const result = await exportLegacyMigrationState({
      manifest: createManifest('2026-06-21T13:00:00.000Z'),
      ...paths,
    })

    expect(result).toMatchObject({ ok: true, changed: true })
    expect(JSON.parse(await readFile(paths.installStatePath, 'utf8'))).toEqual({
      tutorialCompleted: true,
      legacyInstall: true,
      migrationVersion: 1,
    })
    expect(JSON.parse(await readFile(paths.manifestPath, 'utf8'))).toMatchObject({
      legacyInstall: true,
      tutorialCompleted: true,
      autosavePath: paths.autosavePath,
    })
    expect(await readdir(paths.directory)).not.toContain(
      'migration-manifest-v1.json.tmp',
    )
  })

  it('is idempotent when only exportedAt changes', async () => {
    const paths = await createPaths()
    await exportLegacyMigrationState({
      manifest: createManifest('2026-06-21T13:00:00.000Z'),
      ...paths,
    })

    const result = await exportLegacyMigrationState({
      manifest: createManifest('2026-06-21T14:00:00.000Z'),
      ...paths,
    })
    const persisted = JSON.parse(await readFile(paths.manifestPath, 'utf8'))

    expect(result).toMatchObject({ ok: true, changed: false })
    expect(persisted.exportedAt).toBe('2026-06-21T13:00:00.000Z')
  })

  it('backs up corrupt manifests before replacing them', async () => {
    const paths = await createPaths()
    await writeFile(paths.manifestPath, '{broken', 'utf8')

    await exportLegacyMigrationState({
      manifest: createManifest('2026-06-21T13:00:00.000Z'),
      ...paths,
      now: () => new Date('2026-06-21T15:00:00.000Z'),
    })

    const files = await readdir(paths.directory)
    expect(files).toContain(
      'migration-manifest-v1.corrupt-2026-06-21T15-00-00-000Z.json',
    )
    expect(JSON.parse(await readFile(paths.manifestPath, 'utf8')).schemaVersion).toBe(1)
  })

  it('promotes a valid incomplete atomic write when the target is missing', async () => {
    const paths = await createPaths()
    await writeFile(
      `${paths.manifestPath}.tmp`,
      JSON.stringify(createManifest('2026-06-21T13:00:00.000Z')),
      'utf8',
    )

    const recovered = await recoverAtomicJsonFile(paths.manifestPath)

    expect(recovered?.schemaVersion).toBe(1)
    expect(JSON.parse(await readFile(paths.manifestPath, 'utf8')).schemaVersion).toBe(1)
  })
})
