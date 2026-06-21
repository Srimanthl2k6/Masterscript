import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const mainProcess = readFileSync('electron/main.cjs', 'utf8')
const preload = readFileSync('electron/preload.cjs', 'utf8')

describe('Electron migration bridge', () => {
  it('writes a versioned migration manifest inside Electron user data', () => {
    expect(mainProcess).toContain("ipcMain.handle('migration:export-v1'")
    expect(mainProcess).toContain("'migration-manifest-v1.json'")
    expect(mainProcess).toContain('legacyInstall: true')
    expect(mainProcess).toContain('tutorialCompleted: true')
    expect(mainProcess).toContain('autosavePath: getAutosavePath()')
  })

  it('exposes migration and install-state operations through the preload boundary', () => {
    expect(preload).toContain('exportMigrationManifest: (manifest)')
    expect(preload).toContain("ipcRenderer.invoke('migration:export-v1'")
    expect(preload).toContain('getInstallState:')
    expect(preload).toContain('setTutorialCompleted:')
  })
})
