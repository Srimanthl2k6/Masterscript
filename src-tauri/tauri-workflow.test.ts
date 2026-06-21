import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { legacySourceVersion } from '../src/lib/desktop/version'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')
const workflow = readFileSync('.github/workflows/tauri-pass1-proof.yml', 'utf8')

describe('Tauri Pass 1 proof workflow', () => {
  it('keeps all migration version declarations synchronized', () => {
    const tauriConfig = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
    expect(legacySourceVersion).toBe(packageJson.version)
    expect(tauriConfig.version).toBe(packageJson.version)
  })

  it('builds internal artifacts on Windows, macOS, and Linux without publishing', () => {
    expect(workflow).toContain('windows-latest')
    expect(workflow).toContain('macos-latest')
    expect(workflow).toContain('ubuntu-22.04')
    expect(workflow).toContain('actions/upload-artifact@v4')
    expect(workflow).not.toContain('actions/upload-release-asset')
    expect(workflow).not.toContain('softprops/action-gh-release')
  })

  it('tests replacement from the final Electron bridge baseline on every platform', () => {
    expect(workflow.match(/gh release download v0\.1\.13/g)).toHaveLength(3)
    expect(workflow.match(/pass1-migration-sentinel\.json/g)?.length).toBeGreaterThanOrEqual(5)
    expect(workflow).toContain('Tauri installation removed Electron application data')
  })
})
