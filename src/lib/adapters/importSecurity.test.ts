import { describe, expect, it, vi } from 'vitest'
import { createBlock, createEmptyProject } from '../screenplay'
import {
  MAX_GENERATED_TEXT_BYTES,
  MAX_IMPORTED_BLOCKS,
  MAX_PROJECT_JSON_NODES,
  validateImportedProjectResult,
  validateProjectCandidate,
} from './importLimits'
import { runImportConversion } from './importWorkerClient'

describe('bounded import conversion', () => {
  it('rejects generated text above twenty MiB', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('action', 'a'.repeat(MAX_GENERATED_TEXT_BYTES + 1)),
    ]

    expect(() =>
      validateImportedProjectResult({ data: project, warnings: [] }),
    ).toThrow(/20 MiB/i)
  })

  it('rejects imported screenplay output above fifty thousand blocks', () => {
    const project = createEmptyProject()
    project.blocks = Array.from(
      { length: MAX_IMPORTED_BLOCKS + 1 },
      (_, index) => createBlock('action', `line ${index}`),
    )

    expect(() =>
      validateImportedProjectResult({ data: project, warnings: [] }),
    ).toThrow(/50,000 blocks/i)
  })

  it('terminates an import worker after the fifteen-second policy timeout', async () => {
    const terminate = vi.fn()
    const worker = {
      onmessage: null,
      onerror: null,
      postMessage: vi.fn(),
      terminate,
    }

    await expect(
      runImportConversion(
        { kind: 'fountain', content: 'INT. ROOM - DAY' },
        {
          timeoutMs: 5,
          workerFactory: () => worker,
        },
      ),
    ).rejects.toThrow(/timed out/i)

    expect(terminate).toHaveBeenCalledOnce()
  })

  it('rejects malformed and oversized project JSON before hydration', () => {
    expect(() => validateProjectCandidate({ schemaVersion: 1 })).toThrow(
      /required project fields/i,
    )

    const project = createEmptyProject()
    project.blocks = Array.from(
      { length: MAX_IMPORTED_BLOCKS + 1 },
      (_, index) => createBlock('action', `line ${index}`),
    )
    expect(() => validateProjectCandidate(project)).toThrow(/50,000 blocks/i)

    const malformedBlockProject = createEmptyProject()
    ;(malformedBlockProject.blocks[0] as unknown as { text: unknown }).text = {
      injected: true,
    }
    expect(() => validateProjectCandidate(malformedBlockProject)).toThrow(
      /block fields/i,
    )
  })

  it('rejects project structures with excessive non-text values', () => {
    const project = createEmptyProject() as ReturnType<typeof createEmptyProject> & {
      excessive?: null[]
    }
    project.excessive = Array.from(
      { length: MAX_PROJECT_JSON_NODES + 1 },
      () => null,
    )

    expect(() => validateProjectCandidate(project)).toThrow(/too many values/i)
  })
})
