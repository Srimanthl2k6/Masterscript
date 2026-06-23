import { describe, expect, it } from 'vitest'
import { createEmptyProject } from './screenplay'
import { duplicateProject } from './projectDuplication'

describe('project duplication', () => {
  it('creates an independent project identity without collaboration credentials', () => {
    const source = createEmptyProject()
    source.id = 'source-project'
    source.meta.title = 'Draft'
    source.meta.createdAt = '2026-01-01T00:00:00.000Z'
    source.meta.updatedAt = '2026-01-02T00:00:00.000Z'
    source.meta.collaborationRoomId = 'room-1'
    source.meta.collaborationInviteKey = 'secret'
    source.meta.collaborationMode = 'lan'
    source.meta.collaborationLanServerUrl = 'ws://127.0.0.1:4000'
    source.meta.collaborationLanProtocolVersion = 2

    const copy = duplicateProject(source, {
      id: 'copy-project',
      now: '2026-06-23T12:00:00.000Z',
    })

    expect(copy.id).toBe('copy-project')
    expect(copy.id).not.toBe(source.id)
    expect(copy.meta.title).toBe('Draft Copy')
    expect(copy.meta.createdAt).toBe('2026-06-23T12:00:00.000Z')
    expect(copy.meta.updatedAt).toBe('2026-06-23T12:00:00.000Z')
    expect(copy.blocks).toEqual(source.blocks)
    expect(copy.blocks).not.toBe(source.blocks)
    expect(copy.meta.collaborationRoomId).toBeUndefined()
    expect(copy.meta.collaborationInviteKey).toBeUndefined()
    expect(copy.meta.collaborationMode).toBeUndefined()
    expect(copy.meta.collaborationLanServerUrl).toBeUndefined()
    expect(copy.meta.collaborationLanProtocolVersion).toBeUndefined()
    expect(source.meta.title).toBe('Draft')
    expect(source.meta.collaborationRoomId).toBe('room-1')
  })

  it('does not repeatedly append the Copy suffix', () => {
    const source = createEmptyProject()
    source.meta.title = 'Draft Copy'

    expect(
      duplicateProject(source, {
        id: 'copy-project',
        now: '2026-06-23T12:00:00.000Z',
      }).meta.title,
    ).toBe('Draft Copy')
  })
})
