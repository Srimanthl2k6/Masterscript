import { describe, expect, it } from 'vitest'
import { createBlock, createEmptyProject } from './screenplay'
import {
  reconcileSceneNumberLabels,
  sanitizeSceneNumberSuffix,
  updateSceneNumberLabel,
} from './sceneNumbering'

describe('editable scene numbering', () => {
  it('preserves existing labels and fills missing labels during reconciliation', () => {
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
      [inserted.id]: '4',
      [second.id]: '2A',
      [third.id]: '3',
    })
    expect(project.advanced.sceneNumbering.numbers[second.id]).toBe('2A')
  })

  it('updates a full scene number and normalizes invalid suffix input', () => {
    const project = createEmptyProject()
    const first = createBlock('scene-heading', 'INT. FIRST - DAY')
    const second = createBlock('scene-heading', 'INT. SECOND - DAY')
    project.blocks = [first, second]

    const updated = updateSceneNumberLabel(project, second.id, '12 a-1b ')

    expect(sanitizeSceneNumberSuffix('12 a-1b ')).toBe('AB')
    expect(updated.advanced.sceneNumbering.numbers).toEqual({
      [first.id]: '1',
      [second.id]: '12AB',
    })
  })

  it('reflows colliding scene numbers by default', () => {
    const project = createEmptyProject()
    const first = createBlock('scene-heading', 'INT. FIRST - DAY')
    const second = createBlock('scene-heading', 'INT. SECOND - DAY')
    const third = createBlock('scene-heading', 'INT. THIRD - DAY')
    const fourth = createBlock('scene-heading', 'INT. FOURTH - DAY')
    project.blocks = [first, second, third, fourth]
    project.advanced.sceneNumbering.numbers = {
      [first.id]: '1',
      [second.id]: '2A',
      [third.id]: '3',
      [fourth.id]: '4B',
    }

    const updated = updateSceneNumberLabel(project, third.id, '2')

    expect(updated.advanced.sceneNumbering.numbers).toEqual({
      [first.id]: '1',
      [second.id]: '3A',
      [third.id]: '2',
      [fourth.id]: '4B',
    })
  })

  it('keeps the requested letter suffix while reflowing numbers', () => {
    const project = createEmptyProject()
    const first = createBlock('scene-heading', 'INT. FIRST - DAY')
    const second = createBlock('scene-heading', 'INT. SECOND - DAY')
    const third = createBlock('scene-heading', 'INT. THIRD - DAY')
    project.blocks = [first, second, third]
    project.advanced.sceneNumbering.numbers = {
      [first.id]: '1',
      [second.id]: '2',
      [third.id]: '3',
    }

    const updated = updateSceneNumberLabel(project, third.id, '2 b')

    expect(updated.advanced.sceneNumbering.numbers).toEqual({
      [first.id]: '1',
      [second.id]: '3',
      [third.id]: '2B',
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
