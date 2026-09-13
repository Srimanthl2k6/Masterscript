import { describe, expect, it } from 'vitest'
import { createTerminalSession } from './domain'
import { createBlock, createEmptyProject } from '../lib/screenplay'

describe('terminal domain uses the GUI project and editing rules', () => {
  it('edits breakdown with immediate feedback, validates input, and preserves rejection on reload', () => {
    const { dispatch } = createTerminalSession()
    dispatch({ op: 'insert', value: 'INT. ROOM - DAY' })
    dispatch({ op: 'split' })
    dispatch({ op: 'insert', value: 'MAYA carries a backpack.' })
    dispatch({ op: 'breakdown' })
    expect(dispatch({ op: 'edit-item', id: 'auto:Props:backpack', value: '{"name":"Hero bag","notes":"Keep","cost":25}' })).toMatchObject({ panel: expect.stringContaining('Hero bag') })
    expect(() => dispatch({ op: 'edit-item', id: 'auto:Props:backpack', value: '{"cost":"bad"}' })).toThrow('Cost')
    dispatch({ op: 'remove-item', id: 'auto:Props:backpack' })
    const saved = dispatch({ op: 'serialize' }) as { json: string }
    dispatch({ op: 'open', value: saved.json })
    expect(dispatch({ op: 'breakdown' })).not.toMatchObject({ panel: expect.stringContaining('backpack') })
  })
  it('creates, edits, splits, navigates, searches, deletes, undoes and reloads', () => {
    const { dispatch } = createTerminalSession()
    expect(dispatch({ op: 'new' })).toMatchObject({ dirty: true })
    dispatch({ op: 'insert', value: 'INT. HOSPITAL - NIGHT' })
    dispatch({ op: 'split' })
    dispatch({ op: 'insert', value: 'RAVI lies beside a backpack.' })
    expect(dispatch({ op: 'report', value: 'scene' })).toMatchObject({ panel: expect.stringContaining('RAVI') })
    expect(dispatch({ op: 'breakdown' })).toMatchObject({ panel: expect.stringContaining('backpack') })
    expect(dispatch({ op: 'search', value: 'HOSPITAL' })).toMatchObject({ index: 0, caret: 5 })
    dispatch({ op: 'navigate', amount: 1 })
    dispatch({ op: 'home' })
    dispatch({ op: 'insert', value: 'MAYA enters. ' })
    dispatch({ op: 'delete-block' })
    expect(dispatch({ op: 'state' })).toMatchObject({ blockCount: 1 })
    expect(dispatch({ op: 'undo' })).toMatchObject({ blockCount: 2 })
    const saved = dispatch({ op: 'serialize' }) as { json: string }
    const project = JSON.parse(saved.json)
    expect(project.blocks[1].text).toContain('MAYA enters.')
    expect(dispatch({ op: 'open', value: saved.json })).toMatchObject({ dirty: false, blockCount: 2 })
    expect(dispatch({ op: 'saved' })).toMatchObject({ dirty: false })
  })
  it('preserves formatting, revisions, extra metadata and rejects malformed projects', () => {
    const { dispatch } = createTerminalSession()
    const project = createEmptyProject()
    project.blocks = [createBlock('scene-heading', 'INT. ROOM - DAY'), { ...createBlock('action', 'Hello world'), formatRanges: [{ start: 0, end: 11, format: { bold: true } }], revision: 'pink' }]
    dispatch({ op: 'open', value: JSON.stringify(project) })
    dispatch({ op: 'navigate', amount: 1 })
    for (let i = 0; i < 5; i++) dispatch({ op: 'move' })
    dispatch({ op: 'split' })
    const saved = JSON.parse((dispatch({ op: 'serialize' }) as { json: string }).json)
    expect(saved.blocks[2]).toMatchObject({ text: 'world', revision: 'pink', formatRanges: [{ start: 0, end: 5, format: { bold: true } }] })
    expect(saved.cards).toEqual(project.cards)
    expect(() => dispatch({ op: 'open', value: '{"blocks":[]}' })).toThrow()
  })
  it('protects Unicode caret boundaries and keeps edits dirty until saved', () => {
    const { dispatch } = createTerminalSession()
    dispatch({ op: 'insert', value: 'A🎬B' })
    dispatch({ op: 'move', amount: -1 })
    expect(dispatch({ op: 'backspace' })).toMatchObject({ text: 'AB', caret: 1, dirty: true })
    dispatch({ op: 'saved' })
    expect(dispatch({ op: 'move' })).toMatchObject({ dirty: false })
  })
})
