import { describe, expect, it } from 'vitest'
import { createBlock, createEmptyProject, nextTypeForEnter } from './screenplay'
import { splitBlock } from './splitBlock'
import { commitProjectHistory, createProjectHistory, redoProjectHistory, undoProjectHistory } from './projectHistory'
import type { BlockType } from '../types/screenplay'

describe('screenplay Enter transaction', () => {
  it.each([['start', 0, 0, '', 'Hello world'], ['middle', 5, 5, 'Hello', 'world'], ['end', 11, 11, 'Hello world', ''], ['selection', 2, 8, 'He', 'rld']] as const)(
    '%s splits and replaces the selection', (_label, start, end, left, right) => {
      const project = createEmptyProject()
      project.blocks = [createBlock('action', 'Hello world')]
      const result = splitBlock(project, project.blocks[0].id, { start, end })
      expect(result.project.blocks.map(block => block.text)).toEqual([left, right])
      expect(result.selection).toEqual({ start: 0, end: 0 })
      expect(result.focusBlockId).toBe(result.project.blocks[1].id)
      expect(project.blocks[0].text).toBe('Hello world')
    },
  )
  it.each<BlockType>(['action', 'character', 'dialogue', 'parenthetical', 'scene-heading', 'transition'])('preserves %s inference for empty and populated blocks', type => {
    for (const text of ['', 'abcdef']) {
      const project = createEmptyProject()
      project.blocks = [createBlock(type, text)]
      const result = splitBlock(project, project.blocks[0].id, { start: 3, end: 3 })
      expect(result.project.blocks[1].type).toBe(nextTypeForEnter(type))
    }
  })
  it('clips formatting, carries dual dialogue and marks both halves in the active revision', () => {
    const project = createEmptyProject()
    project.meta.revisionMode = true
    project.meta.activeRevision = 'blue'
    project.blocks = [{ ...createBlock('character', 'abcdef'), dualDialogueId: 'pair', dualDialogueSide: 'left', formatRanges: [{ start: 1, end: 6, format: { bold: true } }] }]
    const result = splitBlock(project, project.blocks[0].id, { start: 3, end: 4 })
    expect(result.project.blocks.map(block => block.formatRanges)).toEqual([
      [{ start: 1, end: 3, format: { bold: true } }], [{ start: 0, end: 2, format: { bold: true } }],
    ])
    expect(result.project.blocks.every(block => block.revision === 'blue' && block.revisionMark)).toBe(true)
    expect(result.project.blocks[1].dualDialogueId).toBe('pair')
  })
  it.each(['locked', 'omitted'] as const)('refuses %s blocks and omitted scene contents', flag => {
    const project = createEmptyProject()
    project.blocks[0][flag] = true
    expect(splitBlock(project, project.blocks[0].id, { start: 0, end: 0 }).project).toBe(project)
    project.blocks.push(createBlock('action', 'Do not split'))
    expect(splitBlock(project, project.blocks[1].id, { start: 3, end: 3 }).blocked).toBe(true)
  })
  it('undoes and redoes both the text edit and insertion together', () => {
    const project = createEmptyProject()
    project.blocks = [createBlock('action', 'Hello world'), createBlock('action', 'untouched')]
    const result = splitBlock(project, project.blocks[0].id, { start: 5, end: 5 })
    const history = commitProjectHistory(createProjectHistory(project), draft => { draft.blocks = result.project.blocks }, 'Split')
    const undone = undoProjectHistory(history)
    expect(undone.present.blocks).toEqual(project.blocks)
    expect(redoProjectHistory(undone).present.blocks).toEqual(result.project.blocks)
  })
})
