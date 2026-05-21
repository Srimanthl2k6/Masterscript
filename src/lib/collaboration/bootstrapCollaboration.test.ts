import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { waitForRenderableProject } from './bootstrapCollaboration'

describe('collaboration bootstrap helpers', () => {
  it('resolves after a detached Y.Doc receives a renderable project', async () => {
    const ydoc = new Y.Doc()
    const wait = waitForRenderableProject(ydoc, { timeoutMs: 250 })

    ydoc.transact(() => {
      const projectMap = ydoc.getMap('project')
      projectMap.set('id', 'project-1')
      projectMap.set('schemaVersion', 1)
      projectMap.set('meta', new Y.Map())
      projectMap.set('blocks', new Y.Array())
    })

    await expect(wait).resolves.toBeUndefined()
  })

  it('rejects when bootstrap is cancelled', async () => {
    const ydoc = new Y.Doc()
    const controller = new AbortController()
    const wait = waitForRenderableProject(ydoc, {
      signal: controller.signal,
      timeoutMs: 250,
    })

    controller.abort()

    await expect(wait).rejects.toThrow('Collaboration join cancelled')
  })

  it('rejects when no peer provides a document before timeout', async () => {
    const ydoc = new Y.Doc()

    await expect(waitForRenderableProject(ydoc, { timeoutMs: 5 })).rejects.toThrow(
      'No collaborator is currently online for this room',
    )
  })
})
