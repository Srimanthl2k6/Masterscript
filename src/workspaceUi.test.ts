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
      'Duplicate',
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

  it('replaces duplicate Writer hints with rich-text controls and a content-editable editor', () => {
    const formattingSource = readFileSync(
      'src/components/WriterFormattingControls.tsx',
      'utf8',
    )
    const shortcutSource = readFileSync('src/lib/editorShortcuts.ts', 'utf8')
    expect(appSource).toContain('<RichScriptBlockEditor')
    expect(appSource).toContain('<WriterFormattingControls')
    expect(formattingSource).toContain('className="text-formatting-panel"')
    expect(formattingSource).toContain('Clear formatting')
    expect(shortcutSource).toContain('format-bold')
    expect(shortcutSource).toContain('format-italic')
    expect(shortcutSource).toContain('format-underline')
    expect(appSource).not.toContain('<div className="keyboard-hint-list">')
    expect(appSource).not.toContain('<div className="shortcut-grid">')
    expect(stylesheet).toContain('.text-formatting-panel')
  })

  it('keeps the rich-text editing surface outside React child reconciliation', () => {
    const editorSource = readFileSync(
      'src/components/RichScriptBlockEditor.tsx',
      'utf8',
    )

    expect(editorSource).toContain('replaceChildren')
    expect(editorSource).not.toContain('{runs.map(')
  })

  it('labels shortcut settings clearly and exposes editable scene numbers', () => {
    const shortcutPanelSource = readFileSync(
      'src/components/ShortcutRemapPanel.tsx',
      'utf8',
    )
    const sceneOutlineSource = readFileSync(
      'src/components/SceneOutlineItem.tsx',
      'utf8',
    )
    const sceneNumberInputSource = readFileSync(
      'src/components/SceneNumberInlineInput.tsx',
      'utf8',
    )

    expect(shortcutPanelSource).toContain('<summary>Shortcuts</summary>')
    expect(shortcutPanelSource).not.toContain('Remap shortcuts')
    expect(appSource).toContain('<SceneOutlineItem')
    expect(appSource).toContain('<SceneNumberInlineInput')
    expect(sceneNumberInputSource).toContain('className="scene-number-inline-input"')
    expect(sceneOutlineSource).not.toContain('className="scene-number-input"')
    expect(appSource).not.toContain('Manual scene numbering')
    expect(appSource).not.toContain('manualMode')
    expect(appSource).toContain('updateSceneNumberLabel')
    expect(stylesheet).toContain('.scene-number-inline-input')
  })

  it('keeps tutorial instructions opaque and captures Enter before focused controls', () => {
    const tutorialSource = readFileSync(
      'src/components/GuidedTutorial.tsx',
      'utf8',
    )

    expect(stylesheet).toMatch(
      /\.tutorial-card\s*{[^}]*background:\s*var\(--bg-panel\);/s,
    )
    expect(stylesheet).not.toContain('background: var(--panel);')
    expect(tutorialSource).toContain(
      "window.addEventListener('keydown', onKeyDown, true)",
    )
    expect(tutorialSource).toContain('event.stopPropagation()')
  })

  it('renders relationship removal through the normal undoable commit path', () => {
    expect(appSource).toContain('const removeSelectedCharacterRelationship')
    expect(appSource).toContain('removeCharacterRelationship(draft, relationshipId)')
    expect(appSource).toContain('onClick={() => removeSelectedCharacterRelationship(edge.id)}')
    expect(appSource).toContain('Remove')
  })

  it('auto-reconnects only collaboration details previously approved on this device', () => {
    expect(appSource).toContain('await isTrustedCollaboration(localStorage, targetProject)')
    expect(appSource).toContain('await rememberTrustedCollaboration(localStorage, result.project)')
  })
})
