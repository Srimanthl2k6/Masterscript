import { describe, expect, it } from 'vitest'
import { paginateProjectForPrint } from './adapters/pagination'
import { paginateBlocksForEditor } from './editorPagination'
import { createBlock, createEmptyProject } from './screenplay'

describe('paginateBlocksForEditor', () => {
  it('keeps the initial empty block editable on the first script page', () => {
    const project = createEmptyProject()
    project.meta.includeTitlePage = false
    const layout = paginateProjectForPrint(project)

    const pages = paginateBlocksForEditor(project, layout)

    expect(pages).toHaveLength(1)
    expect(pages[0]).toMatchObject({
      scriptPageNumber: 1,
      showPageNumber: true,
    })
    expect(pages[0].blocks.map((block) => block.id)).toEqual([project.blocks[0].id])
  })

  it('groups printable blocks onto editor pages in screenplay order', () => {
    const project = createEmptyProject()
    project.meta.includeTitlePage = false
    project.blocks = [
      createBlock('scene-heading', 'INT. OFFICE - DAY'),
      createBlock('action', Array.from({ length: 260 }, (_, index) => `beat${index}`).join(' ')),
      createBlock('scene-heading', 'EXT. ROOFTOP - NIGHT'),
      createBlock('action', 'The city waits below.'),
    ]
    const layout = paginateProjectForPrint(project, {
      pageHeight: 210,
      marginTop: 36,
      marginBottom: 36,
      lineHeight: 12,
    })

    const pages = paginateBlocksForEditor(project, layout)
    const expectedSecondScenePage = layout.pages.find((page) =>
      page.lines.some((line) => line.blockId === project.blocks[2].id && line.role === 'body'),
    )?.scriptPageNumber

    expect(pages.length).toBeGreaterThan(1)
    expect(pages.flatMap((page) => page.blocks.map((block) => block.id))).toEqual(
      project.blocks.map((block) => block.id),
    )
    expect(pages.map((page) => page.scriptPageNumber)).toEqual([
      1,
      expectedSecondScenePage,
    ])
  })

  it('assigns non-printing empty blocks to the nearest previous editor page', () => {
    const project = createEmptyProject()
    project.meta.includeTitlePage = false
    const emptyAction = createBlock('action', '')
    const secondScene = createBlock('scene-heading', 'EXT. ALLEY - NIGHT')
    project.blocks = [
      createBlock('scene-heading', 'INT. OFFICE - DAY'),
      emptyAction,
      secondScene,
    ]
    const layout = paginateProjectForPrint(project)

    const pages = paginateBlocksForEditor(project, layout)

    expect(pages).toHaveLength(1)
    expect(pages[0].blocks.map((block) => block.id)).toEqual(
      project.blocks.map((block) => block.id),
    )
  })

  it('hides editor page labels when screenplay page numbers are disabled', () => {
    const project = createEmptyProject()
    project.meta.includeTitlePage = false
    project.meta.showPageNumbers = false
    project.blocks = [createBlock('scene-heading', 'INT. OFFICE - DAY')]
    const layout = paginateProjectForPrint(project)

    const pages = paginateBlocksForEditor(project, layout)

    expect(pages[0].scriptPageNumber).toBe(1)
    expect(pages[0].showPageNumber).toBe(false)
  })

  it('assigns a scene heading and its following action to the same editor page', () => {
    const project = createEmptyProject()
    project.meta.includeTitlePage = false
    const heading = createBlock('scene-heading', 'EXT. ROOFTOP - NIGHT')
    const action = createBlock('action', 'The city waits below.')
    project.blocks = [
      createBlock(
        'action',
        Array.from({ length: 9 }, (_, index) => `Setup beat ${index}.`).join('\n'),
      ),
      heading,
      action,
    ]
    const layout = paginateProjectForPrint(project, {
      pageHeight: 210,
      marginTop: 36,
      marginBottom: 36,
      lineHeight: 12,
    })

    const pages = paginateBlocksForEditor(project, layout)
    const headingPage = pages.find((page) =>
      page.blocks.some((block) => block.id === heading.id),
    )
    const actionPage = pages.find((page) =>
      page.blocks.some((block) => block.id === action.id),
    )

    expect(headingPage?.scriptPageNumber).toBe(2)
    expect(actionPage?.scriptPageNumber).toBe(headingPage?.scriptPageNumber)
  })
})
