import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')

describe('security governance', () => {
  it('documents reporting, threats, updater recovery, and advisory exceptions', () => {
    expect(existsSync('SECURITY.md')).toBe(true)
    expect(existsSync('docs/security/THREAT_MODEL.md')).toBe(true)
    expect(existsSync('docs/security/UPDATER_KEY_RUNBOOK.md')).toBe(true)
    expect(existsSync('.security/advisory-exceptions.json')).toBe(true)

    expect(read('SECURITY.md')).toContain('/security/advisories/new')
    expect(read('docs/security/THREAT_MODEL.md')).toContain('Imported documents')
    expect(read('docs/security/THREAT_MODEL.md')).toContain('LAN collaboration')
    expect(read('docs/security/UPDATER_KEY_RUNBOOK.md')).toContain(
      'old-key-signed transition release',
    )
  })

  it('runs weekly dependency updates and no-secret security gates', () => {
    const dependabot = read('.github/dependabot.yml')
    const workflow = read('.github/workflows/security.yml')

    expect(dependabot).toContain('package-ecosystem: "npm"')
    expect(dependabot).toContain('package-ecosystem: "cargo"')
    expect(dependabot).toContain('package-ecosystem: "github-actions"')
    expect(workflow).toContain('schedule:')
    expect(workflow).toContain('npm run security:audit')
    expect(workflow).toContain('dependency-review-action@')
    expect(workflow).toContain('sbom-action@')
    expect(workflow).not.toContain('${{ secrets.')
  })

  it('pins every action in every workflow to a full commit SHA', () => {
    const workflowFiles = readdirSync('.github/workflows')
      .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))

    for (const file of workflowFiles) {
      const actionUses = read(`.github/workflows/${file}`)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('uses: '))

      for (const use of actionUses) {
        expect(use, file).toMatch(
          /^uses:\s+[^@\s]+@[0-9a-f]{40}(?:\s+#.*)?$/,
        )
      }
    }
  })

  it('provides executable repository settings and exception validators', () => {
    const packageJson = JSON.parse(read('package.json'))
    expect(existsSync('scripts/security/verify-repository-settings.mjs')).toBe(
      true,
    )
    expect(existsSync('scripts/security/validate-advisory-exceptions.mjs')).toBe(
      true,
    )
    expect(packageJson.scripts['security:audit']).toBeTruthy()
    expect(packageJson.scripts['security:settings']).toBeTruthy()
  })
})
