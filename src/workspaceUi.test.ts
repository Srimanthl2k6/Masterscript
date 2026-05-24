import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { workspaceFileMenuGroups } from './workspaceFileMenu'

const stylesheet = readFileSync('src/index.css', 'utf8')

describe('workspace chrome UI', () => {
  it('moves project, import, export, view, theme, snapshot, and edit actions into File', () => {
    const fileMenuLabels = workspaceFileMenuGroups.flatMap((group) =>
      group.items.map((item) => item.label),
    )

    expect(fileMenuLabels).toEqual([
      'Home',
      'New',
      'Open',
      'Import FDX',
      'Import Fountain',
      'Import DOCX',
      'Export FDX',
      'Export DOCX',
      'Export PDF',
      'Print Preview',
      'Theme',
      'Snapshots',
      'Undo',
      'Redo',
    ])
  })

  it('defines layout hooks for the File menu and collapsible right sidebar', () => {
    expect(stylesheet).toContain('.file-menu-wrap')
    expect(stylesheet).toContain('.file-menu-panel')
    expect(stylesheet).toContain('.right-outline.collapsed')
    expect(stylesheet).toContain('.right-outline-tab')
  })

  it('keeps the draft formatter toolbar compact', () => {
    expect(stylesheet).toContain('height: 44px;')
    expect(stylesheet).toContain('width: 68px;')
  })
})
