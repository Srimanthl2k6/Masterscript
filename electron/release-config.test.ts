import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')

describe('desktop release configuration', () => {
  const build = packageJson.build

  it('targets the next cross-platform release version', () => {
    expect(packageJson.version).toBe('0.1.9')
    expect(packageJson.description).toBe(
      'MasterScript desktop screenwriting suite',
    )
    expect(packageJson.author).toBe('Srimanthl2k6')
    expect(packageJson.license).toBe('UNLICENSED')
  })

  it('includes the built frontend, Electron files, and package metadata', () => {
    expect(build.files).toEqual(['dist/**/*', 'electron/**/*', 'package.json'])
  })

  it('keeps platform icons in build resources and allows Windows icon embedding', () => {
    expect(build.directories.buildResources).toBe('build')
    expect(build.icon).toBe('icon')
    expect(build.toolsets.winCodeSign).toBe('1.1.0')
    expect(build.win.icon).toBe('icon.ico')
    expect(build.win.signAndEditExecutable).toBeUndefined()
    expect(build.mac.icon).toBe('icon.png')
    expect(build.linux.icon).toBe('icon.png')
    for (const size of ['16', '32', '48', '64', '128', '256', '512']) {
      expect(existsSync(`build/icons/${size}x${size}.png`)).toBe(true)
    }
  })

  it('declares Windows, macOS, and Linux targets with platform-specific artifact names', () => {
    expect(build.win).toMatchObject({
      target: 'nsis',
      artifactName: 'MasterScript.Setup.${version}.${ext}',
    })

    expect(build.mac).toMatchObject({
      target: ['dmg', 'zip'],
      artifactName: 'MasterScript.mac.${version}.${arch}.${ext}',
    })

    expect(build.linux).toMatchObject({
      target: ['AppImage', 'deb', 'rpm', 'pacman'],
      artifactName: 'MasterScript.linux.${version}.${arch}.${ext}',
      category: 'Office',
      maintainer: 'Srimanthl2k6',
    })
  })
})
