import { describe, expect, it } from 'vitest'
import { paginateProjectForPrint } from './pagination'
import { createBlock, createEmptyProject } from '../screenplay'

describe('paginateProjectForPrint', () => {
  it('creates title and script pages by default', () => {
    const project = createEmptyProject()

    const layout = paginateProjectForPrint(project)

    expect(layout.pages.length).toBeGreaterThanOrEqual(2)
    expect(layout.pages[0].kind).toBe('title')
    expect(layout.pages[1].kind).toBe('script')
  })

  it('removes footer page numbers when disabled', () => {
    const project = createEmptyProject()
    project.meta.showPageNumbers = false

    const layout = paginateProjectForPrint(project)
    const footerLines = layout.pages.flatMap((page) =>
      page.lines.filter((line) => line.role === 'footer'),
    )

    expect(footerLines).toHaveLength(0)
  })

  it('does not print the draft date in script page headers by default', () => {
    const project = createEmptyProject()
    project.meta.includeTitlePage = false
    project.meta.draftDate = '2026-05-19'
    project.blocks = [createBlock('scene-heading', 'INT. OFFICE - DAY')]

    const layout = paginateProjectForPrint(project)
    const scriptHeaderText = layout.pages
      .filter((page) => page.kind === 'script')
      .flatMap((page) =>
        page.lines.filter((line) => line.role === 'header').map((line) => line.text),
      )

    expect(scriptHeaderText).not.toContain('2026-05-19')
  })

  it('adds scene numbers when enabled', () => {
    const project = createEmptyProject()
    project.meta.includeTitlePage = false
    project.meta.showSceneNumbers = true
    project.blocks = [
      createBlock('scene-heading', 'INT. STATION - NIGHT'),
      createBlock('action', 'A train glides in through mist and sparks.'),
    ]

    const layout = paginateProjectForPrint(project)
    const sceneNumberLines = layout.pages.flatMap((page) =>
      page.lines.filter((line) => line.role === 'scene-number'),
    )

    expect(sceneNumberLines).toHaveLength(1)
    expect(sceneNumberLines[0].text).toBe('1')
  })

  it('wraps long text and paginates across multiple script pages', () => {
    const project = createEmptyProject()
    project.meta.includeTitlePage = false
    const longAction = Array.from({ length: 1800 }, (_, index) => `beat${index}`)
      .join(' ')
    project.blocks = [createBlock('action', longAction)]

    const layout = paginateProjectForPrint(project)
    const scriptPages = layout.pages.filter((page) => page.kind === 'script')

    expect(scriptPages.length).toBeGreaterThan(1)
    expect(scriptPages[0].lines.some((line) => line.role === 'body')).toBe(true)
    expect(
      scriptPages[scriptPages.length - 1].lines.some((line) => line.role === 'body'),
    ).toBe(true)
  })

  it('adds MORE and CONTINUED cues when dialogue splits across pages', () => {
    const project = createEmptyProject()
    project.meta.includeTitlePage = false
    project.blocks = [
      createBlock('scene-heading', 'INT. SUBWAY - NIGHT'),
      createBlock('character', 'MAYA'),
      createBlock(
        'dialogue',
        Array.from({ length: 120 }, (_, index) => `word${index}`).join(' '),
      ),
    ]

    const layout = paginateProjectForPrint(project, {
      pageHeight: 220,
      marginTop: 36,
      marginBottom: 36,
      lineHeight: 12,
    })

    const bodyText = layout.pages.flatMap((page) => page.lines.map((line) => line.text))

    expect(bodyText).toContain('(MORE)')
    expect(bodyText).toContain("MAYA (CONT'D)")
  })

  it('does not leave a character cue orphaned as the last body line on a page', () => {
    const project = createEmptyProject()
    project.meta.includeTitlePage = false
    project.blocks = [
      createBlock('scene-heading', 'INT. OFFICE - DAY'),
      createBlock('action', Array.from({ length: 45 }, (_, index) => `beat${index}`).join(' ')),
      createBlock('character', 'JON'),
      createBlock('dialogue', 'We still have time.'),
    ]

    const layout = paginateProjectForPrint(project, {
      pageHeight: 210,
      marginTop: 36,
      marginBottom: 36,
      lineHeight: 12,
    })

    for (const page of layout.pages) {
      const bodyLines = page.lines.filter((line) => line.role === 'body')
      expect(bodyLines.at(-1)?.text).not.toBe('JON')
    }
  })

  it('renders dual dialogue in side-by-side columns', () => {
    const project = createEmptyProject()
    project.meta.includeTitlePage = false
    const leftCharacter = createBlock('character', 'MAYA')
    const leftDialogue = createBlock('dialogue', 'Left side line.')
    const rightCharacter = createBlock('character', 'JON')
    const rightDialogue = createBlock('dialogue', 'Right side line.')

    for (const block of [leftCharacter, leftDialogue]) {
      block.dualDialogueId = 'dual-1'
      block.dualDialogueSide = 'left'
    }

    for (const block of [rightCharacter, rightDialogue]) {
      block.dualDialogueId = 'dual-1'
      block.dualDialogueSide = 'right'
    }

    project.blocks = [
      createBlock('scene-heading', 'INT. KITCHEN - DAY'),
      leftCharacter,
      leftDialogue,
      rightCharacter,
      rightDialogue,
    ]

    const layout = paginateProjectForPrint(project)
    const leftLine = layout.pages
      .flatMap((page) => page.lines)
      .find((line) => line.blockId === leftDialogue.id)
    const rightLine = layout.pages
      .flatMap((page) => page.lines)
      .find((line) => line.blockId === rightDialogue.id)

    expect(leftLine).toBeDefined()
    expect(rightLine).toBeDefined()
    expect(rightLine!.x).toBeGreaterThan(leftLine!.x + 160)
  })
})
