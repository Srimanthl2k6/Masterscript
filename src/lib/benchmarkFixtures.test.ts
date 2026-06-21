import { describe, expect, it } from 'vitest'
import { paginateProjectForPrint } from './adapters/pagination'
import { createBenchmarkProject } from './benchmarkFixtures'

describe('createBenchmarkProject', () => {
  it.each([
    ['small', 5],
    ['medium', 50],
    ['large', 200],
  ] as const)('creates a deterministic %s fixture with exactly %i script pages', (_, pages) => {
    const project = createBenchmarkProject(pages)
    const layout = paginateProjectForPrint(project)
    const scriptPages = layout.pages.filter((page) => page.kind === 'script')

    expect(project.meta.includeTitlePage).toBe(false)
    expect(scriptPages).toHaveLength(pages)
    expect(project.blocks[0].id).toBe('benchmark-scene-1')
    expect(project.meta.title).toBe(`MasterScript ${pages}-Page Benchmark`)
  })
})
