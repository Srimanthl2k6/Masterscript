import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')
const tauriConfig = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
const cargoManifest = readFileSync('src-tauri/Cargo.toml', 'utf8')
const rustLibrary = readFileSync('src-tauri/src/lib.rs', 'utf8')
const installerHooks = readFileSync(
  'src-tauri/windows/migration-hooks.nsh',
  'utf8',
)

describe('Pass 1 Tauri shell', () => {
  it('reuses the unchanged Vite frontend and desktop identity', () => {
    expect(tauriConfig.productName).toBe('MasterScript')
    expect(tauriConfig.version).toBe(packageJson.version)
    expect(tauriConfig.identifier).toBe('com.masterscript.desktop')
    expect(tauriConfig.build.frontendDist).toBe('../dist')
    expect(tauriConfig.build.devUrl).toBe('http://localhost:5173')
    expect(tauriConfig.build.beforeBuildCommand).toBe('npm run build:web')
  })

  it('is configured as the release desktop shell', () => {
    expect(tauriConfig.bundle.active).toBe(true)
    expect(tauriConfig.bundle.createUpdaterArtifacts).toBe(true)
    expect(tauriConfig.plugins.updater.endpoints).toEqual([
      'https://github.com/Srimanthl2k6/Masterscript/releases/latest/download/latest.json',
    ])
    expect(tauriConfig.plugins.updater.pubkey).toBeTruthy()
    expect(tauriConfig.bundle.windows.nsis.installerHooks).toBe(
      './windows/migration-hooks.nsh',
    )
    expect(tauriConfig.app.windows[0]).toMatchObject({
      width: 1600,
      height: 980,
      minWidth: 1100,
      minHeight: 700,
    })
  })

  it('references icon assets that are tracked in the repository', () => {
    expect(tauriConfig.bundle.icon).toEqual([
      'icons/32x32.png',
      'icons/128x128.png',
      'icons/128x128@2x.png',
      'icons/icon.icns',
      'icons/icon.ico',
    ])
    for (const iconPath of tauriConfig.bundle.icon) {
      expect(existsSync(`src-tauri/${iconPath}`)).toBe(true)
    }
  })

  it('repairs Windows desktop and Start Menu shortcuts after installation', () => {
    expect(installerHooks).toContain('$SMPROGRAMS\\MasterScript.lnk')
    expect(installerHooks).toContain('$DESKTOP\\MasterScript.lnk')
    expect(installerHooks.match(/CreateShortCut/g)).toHaveLength(2)
  })

  it('uses Tauri 2 and exposes the complete desktop command surface', () => {
    expect(cargoManifest).toContain('tauri = { version = "2.11.3"')
    for (const command of [
      'project_autosave',
      'project_read_autosave',
      'project_read_recent_snapshots',
      'project_write_recent_snapshot',
      'project_save_file',
      'project_save_ref',
      'project_open_file',
      'project_open_ref',
      'project_export_fountain',
      'project_import_fountain',
      'project_import_fdx',
      'project_export_fdx',
      'project_import_docx',
      'project_export_docx',
      'project_export_pdf',
      'collaboration_lan_host',
      'collaboration_lan_join',
      'collaboration_lan_transport_open',
      'collaboration_lan_transport_send',
      'collaboration_lan_transport_close',
      'collaboration_lan_stop',
      'collaboration_lan_status',
      'bootstrap_installation',
      'installation_get_state',
      'installation_set_tutorial_completed',
    ]) {
      expect(rustLibrary).toContain(command)
    }
  })
})
