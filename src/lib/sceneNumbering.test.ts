import { describe, expect, it } from 'vitest'
import { createBlock, createEmptyProject } from './screenplay'
import {
  reconcileSceneNumberLabels,
  sanitizeSceneNumberSuffix,
  updateSceneNumberLabel,
} from './sceneNumbering'

describe('editable scene numbering', () => {
  it('renumbers numeric prefixes while preserving alphabetic suffixes', () => {
    const project = createEmptyProject()
    const first = createBlock('scene-heading', 'INT. FIRST - DAY')
    const second = createBlock('scene-heading', 'INT. SECOND - DAY')
    const third = createBlock('scene-heading', 'INT. THIRD - DAY')
    const inserted = createBlock('scene-heading', 'INT. INSERTED - DAY')
    project.blocks = [first, inserted, second, third]
    project.advanced.sceneNumbering.numbers = {
      [first.id]: '1',
      [second.id]: '2A',
      [third.id]: '3',
    }

    const reconciled = reconcileSceneNumberLabels(project)

    expect(reconciled.advanced.sceneNumbering.numbers).toEqual({
      [first.id]: '1',
      [inserted.id]: '2',
      [second.id]: '3A',
      [third.id]: '4',
    })
    expect(project.advanced.sceneNumbering.numbers[second.id]).toBe('2A')
  })

  it('updates a scene suffix and normalizes invalid input', () => {
    const project = createEmptyProject()
    const first = createBlock('scene-heading', 'INT. FIRST - DAY')
    const second = createBlock('scene-heading', 'INT. SECOND - DAY')
    project.blocks = [first, second]

    const updated = updateSceneNumberLabel(project, second.id, '2 a-1b ')

    expect(sanitizeSceneNumberSuffix('2 a-1b ')).toBe('AB')
    expect(updated.advanced.sceneNumbering.numbers).toEqual({
      [first.id]: '1',
      [second.id]: '2AB',
    })
  })

  it('leaves production-locked scene numbers unchanged', () => {
    const project = createEmptyProject()
    const first = createBlock('scene-heading', 'INT. FIRST - DAY')
    const second = createBlock('scene-heading', 'INT. SECOND - DAY')
    project.blocks = [first, second]
    project.advanced.sceneNumbering.locked = true
    project.advanced.sceneNumbering.numbers = {
      [first.id]: '10',
      [second.id]: '10A',
    }

    expect(
      reconcileSceneNumberLabels(project).advanced.sceneNumbering.numbers,
    ).toEqual({
      [first.id]: '10',
      [second.id]: '10A',
    })
    expect(
      updateSceneNumberLabel(project, second.id, '11B').advanced.sceneNumbering
        .numbers,
    ).toEqual({
      [first.id]: '10',
      [second.id]: '10A',
    })
  })
})
