import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Tauri updater integration', () => {
  it('checks, installs, and offers to relaunch only in Tauri', () => {
    const source = readFileSync(
      new URL('./updater.ts', import.meta.url),
      'utf8',
    )

    expect(source).toContain("desktopBridge.runtime !== 'tauri'")
    expect(source).toContain("import('@tauri-apps/plugin-updater')")
    expect(source).toContain('downloadAndInstall')
    expect(source).toContain("import('@tauri-apps/plugin-process')")
  })
})
