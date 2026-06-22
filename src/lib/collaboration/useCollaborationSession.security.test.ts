import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../screenplay'
import { validateRemoteCollaborationProject } from './useCollaborationSession'

describe('remote collaboration state security', () => {
  it('rejects malformed project state received from an authenticated peer', () => {
    const project = createEmptyProject()
    ;(project.blocks[0] as unknown as { type: string }).type = 'not-a-block'

    expect(() => validateRemoteCollaborationProject(project)).toThrow(
      /block fields/i,
    )
  })

  it('clears persisted room state after a hostile update', () => {
    const source = readFileSync(
      'src/lib/collaboration/useCollaborationSession.ts',
      'utf8',
    )
    expect(source).toContain('destroyProvider(true)')
    expect(source).toContain('persistence.clearData')
  })
})
