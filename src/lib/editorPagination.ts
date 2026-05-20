import type { PrintLayoutResult } from './adapters/pagination'
import type { ScriptBlock, ScriptProject } from '../types/screenplay'

export interface EditorPage {
  scriptPageNumber: number
  showPageNumber: boolean
  blocks: ScriptBlock[]
}

export const paginateBlocksForEditor = (
  project: ScriptProject,
  printLayout: PrintLayoutResult,
): EditorPage[] => {
  const scriptPages = printLayout.pages.filter(
    (page) => page.kind === 'script' && page.scriptPageNumber !== null,
  )

  if (scriptPages.length === 0) {
    return [
      {
        scriptPageNumber: 1,
        showPageNumber: printLayout.config.showPageNumbers,
        blocks: project.blocks,
      },
    ]
  }

  const pages = scriptPages.map<EditorPage>((page) => ({
    scriptPageNumber: page.scriptPageNumber ?? 1,
    showPageNumber: printLayout.config.showPageNumbers,
    blocks: [],
  }))
  const pageByNumber = new Map(pages.map((page) => [page.scriptPageNumber, page]))
  const firstPageNumberByBlockId = new Map<string, number>()

  for (const page of scriptPages) {
    const scriptPageNumber = page.scriptPageNumber ?? 1
    for (const line of page.lines) {
      if (line.role !== 'body' || !line.blockId || firstPageNumberByBlockId.has(line.blockId)) {
        continue
      }

      firstPageNumberByBlockId.set(line.blockId, scriptPageNumber)
    }
  }

  let currentPageNumber = pages[0].scriptPageNumber
  for (const block of project.blocks) {
    currentPageNumber = firstPageNumberByBlockId.get(block.id) ?? currentPageNumber
    const page = pageByNumber.get(currentPageNumber) ?? pages[0]
    page.blocks.push(block)
  }

  return pages.filter((page, index) => index === 0 || page.blocks.length > 0)
}
