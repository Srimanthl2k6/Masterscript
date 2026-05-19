import { describe, expect, it } from 'vitest'
import { MASTER_SCRIPT_DOWNLOAD_URL } from './download'

describe('download links', () => {
  it('points users to the published Windows installer release asset', () => {
    expect(MASTER_SCRIPT_DOWNLOAD_URL).toBe(
      'https://github.com/Srimanthl2k6/Masterscript/releases/download/v0.1.0/MasterScript.Setup.0.1.0.exe',
    )
  })
})
