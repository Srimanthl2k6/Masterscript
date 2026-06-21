import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { workspaceFileMenuGroups } from './workspaceFileMenu'

const stylesheet = readFileSync('src/index.css', 'utf8')
const appSource = readFileSync('src/App.tsx', 'utf8')

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
      'Tutorial',
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

  it('keeps draft formatter labels on one line', () => {
    expect(stylesheet).toContain('height: 44px;')
    expect(stylesheet).toContain('width: 84px;')
    expect(stylesheet).toContain('white-space: nowrap;')
  })

  it('renders Find and Replace as a non-modal widget inside the editor shell', () => {
    const findReplaceStart = appSource.indexOf('{isFindReplaceOpen && (')
    const formatterToolbarStart = appSource.indexOf(
      "{activeTab === 'draft' && !useContinuousDraftEditor && (",
      findReplaceStart,
    )
    const editorShellStart = appSource.lastIndexOf(
      '<main className="editor-shell">',
      findReplaceStart,
    )
    const editorShellEnd = appSource.indexOf('</main>', findReplaceStart)
    const findReplaceMarkup = appSource.slice(findReplaceStart, formatterToolbarStart)

    expect(findReplaceStart).toBeGreaterThan(-1)
    expect(formatterToolbarStart).toBeGreaterThan(findReplaceStart)
    expect(editorShellStart).toBeGreaterThan(-1)
    expect(editorShellEnd).toBeGreaterThan(findReplaceStart)
    expect(findReplaceMarkup).toContain(
      'className="find-replace-panel find-replace-widget"',
    )
    expect(findReplaceMarkup).not.toContain('className="palette-overlay"')
    expect(stylesheet).toMatch(
      /\.find-replace-widget\s*{[^}]*position:\s*absolute;[^}]*top:[^}]*right:[^}]*z-index:/s,
    )
  })

  it('runs Find Next from Enter in the Find input', () => {
    expect(appSource).toContain('handleFindInputKeyDown(event, jumpToNextFindMatch)')
  })

  it('renders relationship removal through the normal undoable commit path', () => {
    expect(appSource).toContain('const removeSelectedCharacterRelationship')
    expect(appSource).toContain('removeCharacterRelationship(draft, relationshipId)')
    expect(appSource).toContain('onClick={() => removeSelectedCharacterRelationship(edge.id)}')
    expect(appSource).toContain('Remove')
  })
})
