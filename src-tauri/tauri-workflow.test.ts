import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { legacySourceVersion } from '../src/lib/desktop/version'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')
const workflow = readFileSync('.github/workflows/tauri-pass1-proof.yml', 'utf8')
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8')

describe('Tauri release workflows', () => {
  it('keeps all migration version declarations synchronized', () => {
    const tauriConfig = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
    expect(legacySourceVersion).toBe('0.1.14')
    expect(tauriConfig.version).toBe(packageJson.version)
  })

  it('publishes signed Tauri artifacts only after verification', () => {
    expect(releaseWorkflow).toContain('tauri-apps/tauri-action@v0')
    expect(releaseWorkflow).toContain('TAURI_SIGNING_PRIVATE_KEY')
    expect(releaseWorkflow).toContain('latest.json')
    expect(releaseWorkflow).toContain('latest.yml')
    expect(releaseWorkflow).toContain('latest-mac.yml')
    expect(releaseWorkflow).toContain('latest-linux.yml')
    expect(releaseWorkflow).toContain('releaseDraft: true')
    expect(releaseWorkflow).toContain('needs: publish-tauri')
    expect(releaseWorkflow).toContain('--draft=false')
    expect(releaseWorkflow).toContain('universal-apple-darwin')
    expect(releaseWorkflow).toContain('appimage,deb,rpm')
    expect(releaseWorkflow).toContain('pkg.tar.zst')
    expect(releaseWorkflow).toContain('benchmark:tauri')
    expect(releaseWorkflow).not.toContain('electron-builder')
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
    expect(workflow.match(/gh release download v0\.1\.14/g)).toHaveLength(3)
    expect(workflow).toContain('GH_TOKEN: ${{ github.token }}')
    expect(workflow.match(/pass1-migration-sentinel\.json/g)?.length).toBeGreaterThanOrEqual(5)
    expect(workflow).toContain('Tauri installation removed Electron application data')
  })
})
