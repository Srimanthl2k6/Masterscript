import { describe, expect, it } from 'vitest'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { AUR_PUBLISHED, DESKTOP_DOWNLOAD_LINKS, MASTER_SCRIPT_DOWNLOAD_URL, detectDownloadPlatform, resolvePublicView } from './download'
import manifest from '../../release-assets.json'

describe('website and release download contract', () => {
  it('publishes stable aliases for every advertised artifact', () => {
    expect(MASTER_SCRIPT_DOWNLOAD_URL).toBe('https://github.com/Srimanthl2k6/Masterscript/releases/latest/download/MasterScript.Setup.exe')
    expect(DESKTOP_DOWNLOAD_LINKS.map(link => link.stable)).toEqual(manifest.artifacts.map(item => item.stable))
    expect(DESKTOP_DOWNLOAD_LINKS.filter(link => link.platform === 'Linux').map(link => link.format)).toEqual(['.AppImage', '.deb', '.rpm', '.pkg.tar.zst'])
    expect(DESKTOP_DOWNLOAD_LINKS.every(link => !/releases\/download\/v/.test(link.url))).toBe(true)
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8')
    for (const platform of ['Windows', 'macOS', 'Linux']) expect(workflow).toContain(`asset-contract.mjs release-assets ${platform}`)
    expect(workflow).toContain('verify-assets.mjs signed-assets')
    expect(AUR_PUBLISHED).toBe(false)
  })
  it('routes hosted visitors and desktop users appropriately', () => {
    expect(resolvePublicView(false, '')).toBe('landing')
    expect(resolvePublicView(false, '#/app')).toBe('app')
    expect(resolvePublicView(false, '#/download')).toBe('download')
    expect(resolvePublicView(true, '')).toBe('app')
    expect(resolvePublicView(true, '#/download')).toBe('app')
    const app = readFileSync('src/App.tsx', 'utf8')
    expect(app).not.toContain('DESKTOP_DOWNLOAD_LINKS')
    expect(app).toContain('Welcome to your writing workspace')
  })
  it.each([['Windows NT 10.0', 'Windows'], ['Macintosh; Intel Mac OS X', 'macOS'], ['X11; Linux x86_64', 'Linux'], ['Android Linux', null], ['iPhone', null], ['', null]])('only recommends based on %s', (agent, platform) => {
    expect(detectDownloadPlatform(agent)).toBe(platform)
  })
  it('generates real AUR checksums and matching metadata from an archive', () => {
    const directory = mkdtempSync(join(tmpdir(), 'masterscript-aur-'))
    try {
      const archive = join(directory, 'MasterScript.linux.0.7.0.x86_64.pkg.tar.zst')
      writeFileSync(archive, 'verified test archive bytes')
      execFileSync(process.execPath, ['scripts/release/generate-aur.mjs', '0.7.0', archive, directory])
      const pkgbuild = readFileSync(join(directory, 'PKGBUILD'), 'utf8')
      const srcinfo = readFileSync(join(directory, '.SRCINFO'), 'utf8')
      const checksum = pkgbuild.match(/sha256sums=\('([a-f0-9]{64})'\)/)![1]
      expect(srcinfo).toContain(`sha256sums = ${checksum}`)
      expect(srcinfo).toContain('provides = masterscript-tui')
      expect(pkgbuild).toContain('"$srcdir/usr" "$pkgdir/"')
    } finally { rmSync(directory, { recursive: true }) }
  })
})