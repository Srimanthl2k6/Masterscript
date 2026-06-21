import { describe, expect, it } from 'vitest'
import { createEmptyProject } from './screenplay'
import {
  commitProjectHistory,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
} from './projectHistory'

describe('project patch history', () => {
  it('stores forward and inverse patches instead of complete projects', () => {
    const project = createEmptyProject()
    const history = commitProjectHistory(
      createProjectHistory(project),
      (draft) => {
        draft.meta.title = 'Patch-based'
      },
      'Rename project',
    )

    expect(history.past).toHaveLength(1)
    expect(history.past[0].forward).toContainEqual({
      path: ['meta', 'title'],
      value: 'Patch-based',
    })
    expect(history.past[0].inverse).toContainEqual({
      path: ['meta', 'title'],
      value: project.meta.title,
    })
    expect(history.past[0]).not.toHaveProperty('present')
  })

  it('undoes and redoes patch entries', () => {
    const project = createEmptyProject()
    const changed = commitProjectHistory(
      createProjectHistory(project),
      (draft) => {
        draft.blocks[0].text = 'A changed scene'
      },
      'Type',
    )

    const undone = undoProjectHistory(changed)
    expect(undone.present.blocks[0].text).toBe(project.blocks[0].text)

    const redone = redoProjectHistory(undone)
    expect(redone.present.blocks[0].text).toBe('A changed scene')
  })

  it('coalesces consecutive typing in the same block into one logical undo step', () => {
    const project = createEmptyProject()
    const blockId = project.blocks[0].id
    const first = commitProjectHistory(
      createProjectHistory(project),
      (draft) => {
        draft.blocks[0].text = 'I'
      },
      'Typing',
      { coalesceKey: `block:${blockId}`, timestamp: 1000 },
    )
    const second = commitProjectHistory(
      first,
      (draft) => {
        draft.blocks[0].text = 'INT.'
      },
      'Typing',
      { coalesceKey: `block:${blockId}`, timestamp: 1500 },
    )

    expect(second.past).toHaveLength(1)
    expect(undoProjectHistory(second).present.blocks[0].text).toBe(
      project.blocks[0].text,
    )
  })

  it('retains only eighty logical undo steps', () => {
    let history = createProjectHistory(createEmptyProject())

    for (let index = 0; index < 90; index += 1) {
      history = commitProjectHistory(
        history,
        (draft) => {
          draft.meta.title = `Title ${index}`
        },
        `Rename ${index}`,
        { timestamp: index * 2000 },
      )
    }

    expect(history.past).toHaveLength(80)
  })

  it('stores screenplay insertions as splice patches instead of full block arrays', () => {
    const project = createEmptyProject()
    const history = commitProjectHistory(
      createProjectHistory(project),
      (draft) => {
        draft.blocks.push({
          ...draft.blocks[0],
          id: 'inserted-block',
          text: 'A new action line',
        })
      },
      'Insert block',
    )

    expect(history.past[0].forward).toContainEqual({
      path: ['blocks'],
      operation: 'splice',
      index: 1,
      deleteCount: 0,
      items: [
        expect.objectContaining({
          id: 'inserted-block',
          text: 'A new action line',
        }),
      ],
    })
    expect(undoProjectHistory(history).present.blocks).toEqual(project.blocks)
  })
})
