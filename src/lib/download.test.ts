import { describe, expect, it } from 'vitest'
import { MASTER_SCRIPT_DOWNLOAD_URL, shouldShowDownloadButton } from './download'

describe('download links', () => {
  it('points users to the published Windows installer release asset', () => {
    expect(MASTER_SCRIPT_DOWNLOAD_URL).toBe(
      'https://github.com/Srimanthl2k6/Masterscript/releases/download/v0.1.1/MasterScript.Setup.0.1.1.exe',
    )
  })

  it('shows the installer download only outside the Electron desktop app', () => {
    expect(shouldShowDownloadButton(false)).toBe(true)
    expect(shouldShowDownloadButton(true)).toBe(false)
  })
})
