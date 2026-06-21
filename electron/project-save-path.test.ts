import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const mainProcess = readFileSync('electron/main.cjs', 'utf8')
const preload = readFileSync('electron/preload.cjs', 'utf8')
const electronTypes = readFileSync('src/types/electron.d.ts', 'utf8')
const desktopTypes = readFileSync('src/lib/desktop/types.ts', 'utf8')

describe('desktop project path persistence', () => {
  it('exposes a silent save-path IPC channel for known project files', () => {
    expect(mainProcess).toContain("ipcMain.handle('project:save-path'")
    expect(mainProcess).toContain('path.resolve(filePath)')
    expect(mainProcess).toContain("fs.writeFile(resolvedPath, JSON.stringify(project, null, 2), 'utf8')")
    expect(preload).toContain('saveProjectPath: (filePath, project)')
    expect(preload).toContain("ipcRenderer.invoke('project:save-path'")
    expect(electronTypes).toContain('DesktopNativeApi')
    expect(desktopTypes).toMatch(
      /saveProjectPath\(filePath: string, project: ScriptProject\): Promise<OperationResult>/,
    )
  })
})
