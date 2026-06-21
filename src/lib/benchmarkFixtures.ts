import type { ScriptBlock, ScriptProject } from '../types/screenplay'
import { paginateProjectForPrint } from './adapters/pagination'
import { createBlock, createEmptyProject } from './screenplay'

const sceneAction = Array.from(
  { length: 24 },
  (_, index) =>
    `Benchmark action line ${index + 1}. The cast crosses the room while production details remain visible.`,
).join('\n')

const createSceneBlocks = (sceneNumber: number): ScriptBlock[] => {
  const heading = createBlock(
    'scene-heading',
    `INT. BENCHMARK LOCATION ${sceneNumber} - DAY`,
  )
  heading.id = `benchmark-scene-${sceneNumber}`

  const action = createBlock('action', sceneAction)
  action.id = `benchmark-action-${sceneNumber}`

  return [heading, action]
}

export const createBenchmarkProject = (minimumScriptPages: number): ScriptProject => {
  if (!Number.isInteger(minimumScriptPages) || minimumScriptPages < 1) {
    throw new Error('minimumScriptPages must be a positive integer')
  }

  const project = createEmptyProject()
  project.meta.title = `MasterScript ${minimumScriptPages}-Page Benchmark`
  project.meta.includeTitlePage = false
  project.blocks = []

  let sceneNumber = 1
  let scriptPageCount = 0

  while (scriptPageCount < minimumScriptPages) {
    project.blocks.push(...createSceneBlocks(sceneNumber))
    sceneNumber += 1
    scriptPageCount = paginateProjectForPrint(project).pages.filter(
      (page) => page.kind === 'script',
    ).length
  }

  return project
}
