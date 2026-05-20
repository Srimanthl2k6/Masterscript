import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync('.github/workflows/release.yml', 'utf8')

describe('GitHub release workflow', () => {
  it('builds and publishes desktop artifacts when version tags are pushed', () => {
    expect(workflow).toContain('tags:')
    expect(workflow).toContain('v*')
    expect(workflow).toContain('contents: write')
    expect(workflow).toContain('windows-latest')
    expect(workflow).toContain('macos-latest')
    expect(workflow).toContain('ubuntu-latest')
    expect(workflow).toContain('Prepare Windows code signing helper cache')
    expect(workflow).toContain('winCodeSign-2.6.0')
    expect(workflow).toContain('CSC_IDENTITY_AUTO_DISCOVERY: "false"')
    expect(workflow).toContain('GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}')
    expect(workflow).toContain('--publish always')
  })
})
