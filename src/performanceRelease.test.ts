import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('release performance evidence', () => {
  it('reads the measured application version from package.json', () => {
    const source = readFileSync(
      'scripts/performance/capture-tauri-runtime.ts',
      'utf8',
    )

    expect(source).toContain("path.join(root, 'package.json')")
    expect(source).toContain('version: appVersion')
    expect(source).not.toContain("version: '0.2.0'")
  })

  it('uses an extended debug target timeout for Windows CI', () => {
    const source = readFileSync(
      'scripts/performance/capture-tauri-runtime.ts',
      'utf8',
    )

    expect(source).toContain('TAURI_DEBUG_TARGET_TIMEOUT_MS')
    expect(source).toContain('90_000')
  })
})
