import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appSource = readFileSync('src/App.tsx', 'utf8')

describe('lazy workspace module architecture', () => {
  it('loads heavy workspaces through React lazy boundaries', () => {
    for (const workspace of [
      'ProductionWorkspace',
      'BreakdownWorkspace',
      'ReportsWorkspace',
      'AdvancedWorkspace',
    ]) {
      expect(existsSync(`src/workspaces/${workspace}.tsx`)).toBe(true)
      expect(appSource).toMatch(
        new RegExp(
          `const ${workspace} = lazy\\(\\(\\) => import\\('./workspaces/${workspace}'\\)\\)`,
        ),
      )
      expect(appSource).toContain(`<${workspace}`)
    }
  })

  it('keeps heavy workspace calculations out of the application shell', () => {
    for (const calculation of [
      'buildAnalyticsDashboard(project)',
      'buildScriptCheck(project)',
      'buildTimingReport(project)',
      'buildAdvancedNavigatorRows(project)',
      'buildAccessibilityExports(project)',
      'buildStripboard(project)',
      'autoTagScript(project)',
    ]) {
      expect(appSource).not.toContain(`useMemo(() => ${calculation}`)
    }
  })

  it('provides one shared workspace loading fallback without changing workspace chrome', () => {
    expect(existsSync('src/workspaces/WorkspaceFallback.tsx')).toBe(true)
    expect(appSource).toContain('<Suspense fallback={<WorkspaceFallback />}>')
    expect(appSource).toContain('<main className="editor-shell">')
  })

  it('removes at least five hundred lines from the application shell', () => {
    expect(appSource.split(/\r?\n/).length).toBeLessThan(7_600)
  })
})
