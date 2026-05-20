import { describe, expect, it } from 'vitest'
import {
  DESKTOP_DOWNLOAD_LINKS,
  MASTER_SCRIPT_DOWNLOAD_URL,
  shouldShowDownloadButton,
} from './download'

describe('download links', () => {
  it('points users to the published Windows installer release asset', () => {
    expect(MASTER_SCRIPT_DOWNLOAD_URL).toBe(
      'https://github.com/Srimanthl2k6/Masterscript/releases/download/v0.1.6/MasterScript.Setup.0.1.6.exe',
    )
  })

  it('offers web visitors desktop downloads for Windows, macOS, and Linux', () => {
    expect(DESKTOP_DOWNLOAD_LINKS).toEqual([
      {
        label: 'Windows',
        url: 'https://github.com/Srimanthl2k6/Masterscript/releases/download/v0.1.6/MasterScript.Setup.0.1.6.exe',
      },
      {
        label: 'macOS',
        url: 'https://github.com/Srimanthl2k6/Masterscript/releases/download/v0.1.6/MasterScript.mac.0.1.6.universal.dmg',
      },
      {
        label: 'Linux AppImage',
        url: 'https://github.com/Srimanthl2k6/Masterscript/releases/download/v0.1.6/MasterScript.linux.0.1.6.x86_64.AppImage',
      },
    ])
  })

  it('shows the installer download only outside the Electron desktop app', () => {
    expect(shouldShowDownloadButton(false)).toBe(true)
    expect(shouldShowDownloadButton(true)).toBe(false)
  })
})
