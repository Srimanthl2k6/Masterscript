import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  applyProjectToYDoc,
  applyTextDiff,
  findBlockMap,
  scriptProjectToYDoc,
  yDocToScriptProject,
} from './projectYjs'
import { createBlock, createEmptyProject, createRevisionSnapshot } from '../screenplay'

describe('project Yjs conversion', () => {
  it('round-trips an empty project through a structured Yjs document', () => {
    const project = createEmptyProject()
    const ydoc = scriptProjectToYDoc(project)

    expect(yDocToScriptProject(ydoc)).toEqual(project)
  })

  it('preserves screenplay blocks, metadata, revision snapshots, and nested project data', () => {
    const project = createEmptyProject()
    project.meta.title = 'Collaborative Draft'
    project.meta.revisionMode = true
    project.blocks = [
      {
        ...createBlock('scene-heading', 'INT. OFFICE - DAY'),
        locked: true,
        lockedPageLabel: '12A',
      },
      {
        ...createBlock('dialogue', 'We should both see this.'),
        revision: 'blue',
        revisionMark: true,
      },
    ]
    project.revisionSnapshots = [createRevisionSnapshot(project, 'Before session')]
    project.dialogueStash = [
      {
        id: 'stash-1',
        label: 'Alt',
        sourceBlockId: project.blocks[1].id,
        text: 'Alternate line.',
        createdAt: '2026-05-21T00:00:00.000Z',
      },
    ]
    project.production.schedule = [
      {
        id: 'schedule-1',
        day: 1,
        sceneId: project.blocks[0].id,
        location: 'Office',
        notes: 'Morning',
      },
    ]

    const roundTripped = yDocToScriptProject(scriptProjectToYDoc(project))

    expect(roundTripped).toEqual(project)
  })

  it('updates existing block Y.Text instances with minimal text diffs', () => {
    const project = createEmptyProject()
    project.blocks = [createBlock('action', 'A short line.')]
    const ydoc = scriptProjectToYDoc(project)
    const blockMap = findBlockMap(ydoc, project.blocks[0].id)
    const originalText = blockMap?.get('text')

    project.blocks[0].text = 'A longer line.'
    applyProjectToYDoc(ydoc, project)

    const updatedBlockMap = findBlockMap(ydoc, project.blocks[0].id)
    expect(updatedBlockMap?.get('text')).toBe(originalText)
    expect(yDocToScriptProject(ydoc).blocks[0].text).toBe('A longer line.')
  })

  it('applies prefix/suffix text diffs to a Y.Text value', () => {
    const ydoc = new Y.Doc()
    const text = ydoc.getText('body')
    text.insert(0, 'The first draft.')

    applyTextDiff(text, 'The final draft.')

    expect(text.toString()).toBe('The final draft.')
  })

  it('reorders, inserts, and removes blocks by project state', () => {
    const scene = createBlock('scene-heading', 'INT. ROOM - DAY')
    const action = createBlock('action', 'A lamp buzzes.')
    const dialogue = createBlock('dialogue', 'Listen.')
    const project = createEmptyProject()
    project.blocks = [scene, action]
    const ydoc = scriptProjectToYDoc(project)

    project.blocks = [dialogue, scene]
    applyProjectToYDoc(ydoc, project)

    expect(yDocToScriptProject(ydoc).blocks.map((block) => block.id)).toEqual([
      dialogue.id,
      scene.id,
    ])
  })
})
