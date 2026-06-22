import { describe, expect, it } from 'vitest'
import {
  readRecentProjects,
  upsertRecentProject,
} from './recentProjects'

describe('recent project file references', () => {
  it('restores only structurally valid recent entries and file grants', () => {
    const storage = {
      getItem: () =>
        JSON.stringify([
          {
            label: 'Draft',
            source: 'project',
            projectId: 'project-1',
            fileGrantId: 'grant-1',
            updatedAt: '2026-06-22T00:00:00.000Z',
          },
          {
            label: 'Invalid',
            source: 'project',
            fileGrantId: 42,
            updatedAt: '2026-06-22T00:00:00.000Z',
          },
        ]),
    }

    expect(readRecentProjects(storage)).toEqual([
      {
        label: 'Draft',
        source: 'project',
        projectId: 'project-1',
        fileGrantId: 'grant-1',
        updatedAt: '2026-06-22T00:00:00.000Z',
      },
    ])
  })

  it('deduplicates secure recents by grant ID', () => {
    const previous = [
      {
        label: 'Old path',
        source: 'project' as const,
        projectId: 'project-1',
        fileGrantId: 'grant-1',
        updatedAt: '2026-06-21T00:00:00.000Z',
      },
    ]

    const next = upsertRecentProject(previous, {
      label: 'New path',
      source: 'project',
      projectId: 'project-1',
      fileRef: { grantId: 'grant-1', displayPath: 'New path' },
      updatedAt: '2026-06-22T00:00:00.000Z',
    })

    expect(next).toEqual([
      {
        label: 'New path',
        source: 'project',
        projectId: 'project-1',
        fileGrantId: 'grant-1',
        updatedAt: '2026-06-22T00:00:00.000Z',
      },
    ])
  })
})
