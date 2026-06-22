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
})
