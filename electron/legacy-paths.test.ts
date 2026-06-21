import { describe, expect, it } from 'vitest'
import { getLegacyDataCandidates } from './legacy-paths.cjs'

describe('getLegacyDataCandidates', () => {
  it('covers Windows roaming and local application-data locations', () => {
    expect(
      getLegacyDataCandidates('win32', {
        APPDATA: 'C:\\Users\\writer\\AppData\\Roaming',
        LOCALAPPDATA: 'C:\\Users\\writer\\AppData\\Local',
        HOME: 'C:\\Users\\writer',
      }),
    ).toEqual([
      'C:\\Users\\writer\\AppData\\Roaming\\MasterScript',
      'C:\\Users\\writer\\AppData\\Roaming\\masterscript',
      'C:\\Users\\writer\\AppData\\Local\\MasterScript',
      'C:\\Users\\writer\\AppData\\Local\\masterscript',
    ])
  })

  it('covers macOS Application Support locations', () => {
    expect(
      getLegacyDataCandidates('darwin', {
        HOME: '/Users/writer',
      }),
    ).toEqual([
      '/Users/writer/Library/Application Support/MasterScript',
      '/Users/writer/Library/Application Support/masterscript',
    ])
  })

  it('covers Linux XDG and default config locations without duplicates', () => {
    expect(
      getLegacyDataCandidates('linux', {
        HOME: '/home/writer',
        XDG_CONFIG_HOME: '/home/writer/.config',
      }),
    ).toEqual([
      '/home/writer/.config/MasterScript',
      '/home/writer/.config/masterscript',
    ])
  })
})
