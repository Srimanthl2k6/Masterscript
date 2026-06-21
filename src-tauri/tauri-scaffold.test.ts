import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tauriConfig = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
const cargoManifest = readFileSync('src-tauri/Cargo.toml', 'utf8')
const rustLibrary = readFileSync('src-tauri/src/lib.rs', 'utf8')

describe('Pass 1 Tauri shell', () => {
  it('reuses the unchanged Vite frontend and desktop identity', () => {
    expect(tauriConfig.productName).toBe('MasterScript')
    expect(tauriConfig.version).toBe('0.1.13')
    expect(tauriConfig.identifier).toBe('com.masterscript.desktop')
    expect(tauriConfig.build.frontendDist).toBe('../dist')
    expect(tauriConfig.build.devUrl).toBe('http://localhost:5173')
    expect(tauriConfig.build.beforeBuildCommand).toBe('npm run build:web')
  })

  it('is explicitly marked as a non-release compatibility shell', () => {
    expect(tauriConfig.bundle.active).toBe(false)
    expect(tauriConfig.app.windows[0]).toMatchObject({
      width: 1600,
      height: 980,
      minWidth: 1100,
      minHeight: 700,
    })
  })

  it('references icon assets that are tracked in the repository', () => {
    expect(tauriConfig.bundle.icon).toEqual([
      '../build/icon.png',
      '../build/icon.ico',
    ])
    for (const iconPath of tauriConfig.bundle.icon) {
      expect(existsSync(`src-tauri/${iconPath}`)).toBe(true)
    }
  })

  it('uses Tauri 2 and exposes only Pass 1 compatibility commands', () => {
    expect(cargoManifest).toContain('tauri = { version = "2.11.3"')
    expect(rustLibrary).toContain('legacy_data_candidates')
    expect(rustLibrary).toContain('classify_installation')
  })
})
