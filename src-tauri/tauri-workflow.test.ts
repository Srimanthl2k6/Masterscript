import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { legacySourceVersion } from '../src/lib/desktop/version'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')
const workflow = readFileSync('.github/workflows/tauri-pass1-proof.yml', 'utf8')
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8')

describe('Tauri release workflows', () => {
  it('runs the cross-platform release gate for pull requests and main', () => {
    expect(workflow).toContain('pull_request:')
    expect(workflow).toContain('- main')
  })

  it('keeps all migration version declarations synchronized', () => {
    const tauriConfig = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
    expect(legacySourceVersion).toBe('0.1.14')
    expect(tauriConfig.version).toBe(packageJson.version)
  })

  it('publishes signed Tauri artifacts only after verification', () => {
    const signingJobStart = releaseWorkflow.indexOf('release-signing:')
    const publishJobStart = releaseWorkflow.indexOf('publish-release:')
    const signingJob = releaseWorkflow.slice(signingJobStart, publishJobStart)

    expect(releaseWorkflow).toContain('build-artifacts:')
    expect(releaseWorkflow).toContain('release-signing:')
    expect(releaseWorkflow).toContain('environment: release-signing')
    expect(releaseWorkflow).toContain('TAURI_SIGNING_PRIVATE_KEY')
    expect(signingJob).not.toContain('actions/checkout@')
    expect(signingJob).not.toContain('npm ')
    expect(signingJob).not.toContain('cargo ')
    expect(signingJob).toContain('sha256sum --check')
    expect(signingJob).toContain('cargo-tauri signer sign')
    expect(releaseWorkflow).toContain('latest.json')
    expect(releaseWorkflow).toContain('latest.yml')
    expect(releaseWorkflow).toContain('latest-mac.yml')
    expect(releaseWorkflow).toContain('latest-linux.yml')
    expect(releaseWorkflow).toContain('needs: release-signing')
    expect(releaseWorkflow).toContain('universal-apple-darwin')
    expect(releaseWorkflow).toContain('appimage,deb,rpm')
    expect(releaseWorkflow).toContain('pkg.tar.zst')
    expect(releaseWorkflow).toContain('MasterScript.Setup.exe')
    expect(releaseWorkflow).toContain('MasterScript.mac.universal.dmg')
    expect(releaseWorkflow).toContain('MasterScript.linux.x86_64.AppImage')
    expect(releaseWorkflow).toContain('benchmark:tauri')
    expect(releaseWorkflow).not.toContain('electron-builder')
  })

  it('builds internal artifacts on Windows, macOS, and Linux without publishing', () => {
    expect(workflow).toContain('windows-latest')
    expect(workflow).toContain('macos-latest')
    expect(workflow).toContain('ubuntu-22.04')
    expect(workflow).toContain('actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a')
    expect(workflow).not.toContain('TAURI_SIGNING_PRIVATE_KEY')
    expect(workflow).not.toContain('actions/upload-release-asset')
    expect(workflow).not.toContain('softprops/action-gh-release')
  })

  it('pins every third-party workflow action to a full commit SHA', () => {
    for (const source of [workflow, releaseWorkflow]) {
      const actionUses = source
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('uses: '))

      expect(actionUses.length).toBeGreaterThan(0)
      for (const use of actionUses) {
        expect(use).toMatch(/^uses:\s+[^@\s]+@[0-9a-f]{40}(?:\s+#.*)?$/)
      }
    }
  })

  it('tests replacement from the final Electron bridge baseline on every platform', () => {
    expect(workflow.match(/gh release download v0\.1\.14/g)).toHaveLength(3)
    expect(workflow).toContain('GH_TOKEN: ${{ github.token }}')
    expect(workflow.match(/pass1-migration-sentinel\.json/g)?.length).toBeGreaterThanOrEqual(5)
    expect(workflow).toContain('Tauri installation removed Electron application data')
  })
})
