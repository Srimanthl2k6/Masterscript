import { describe, expect, it } from 'vitest'
import { createBlock, createEmptyProject } from './screenplay'
import {
  reconcileSceneNumberLabels,
  sanitizeSceneNumberSuffix,
  updateSceneNumberLabel,
} from './sceneNumbering'

describe('editable scene numbering', () => {
  const projectWithSceneNumbers = (labels: string[]) => {
    const project = createEmptyProject()
    const blocks = labels.map((label) =>
      createBlock('scene-heading', `INT. SCENE ${label} - DAY`),
    )
    project.blocks = blocks
    project.advanced.sceneNumbering.numbers = Object.fromEntries(
      blocks.map((block, index) => [block.id, labels[index]]),
    )
    return { blocks, project }
  }

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
      [inserted.id]: '2',
      [second.id]: '3A',
      [third.id]: '4',
    })
    expect(project.advanced.sceneNumbering.numbers[second.id]).toBe('2A')
  })

  it('numbers inserted scenes into their local slot and shifts affected later bases', () => {
    const { blocks, project } = projectWithSceneNumbers([
      '1',
      '2A',
      '3',
      '2B',
      '4',
      '5',
      '2C',
      '6A',
      '7',
      '6B',
      '8',
      '9',
      '6C',
      '10',
    ])
    const originalBlocks = [...blocks]
    const inserted = createBlock('scene-heading', 'INT. INSERTED - DAY')
    project.blocks.splice(5, 0, inserted)

    const reconciled = reconcileSceneNumberLabels(project)

    expect(reconciled.advanced.sceneNumbering.numbers).toEqual({
      [originalBlocks[0].id]: '1',
      [originalBlocks[1].id]: '2A',
      [originalBlocks[2].id]: '3',
      [originalBlocks[3].id]: '2B',
      [originalBlocks[4].id]: '4',
      [inserted.id]: '5',
      [originalBlocks[5].id]: '6',
      [originalBlocks[6].id]: '2C',
      [originalBlocks[7].id]: '7A',
      [originalBlocks[8].id]: '8',
      [originalBlocks[9].id]: '7B',
      [originalBlocks[10].id]: '9',
      [originalBlocks[11].id]: '10',
      [originalBlocks[12].id]: '7C',
      [originalBlocks[13].id]: '11',
    })
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

  it('allows alphanumeric scene series without shifting target-base siblings', () => {
    const { blocks, project } = projectWithSceneNumbers(['1', '2', '3A', '4'])

    const updated = updateSceneNumberLabel(project, blocks[3].id, '3B')

    expect(updated.advanced.sceneNumbering.numbers).toEqual({
      [blocks[0].id]: '1',
      [blocks[1].id]: '2',
      [blocks[2].id]: '3A',
      [blocks[3].id]: '3B',
    })
  })

  it('allows duplicate exact scene labels', () => {
    const { blocks, project } = projectWithSceneNumbers(['1', '2', '3'])

    const updated = updateSceneNumberLabel(project, blocks[2].id, '2')

    expect(updated.advanced.sceneNumbering.numbers).toEqual({
      [blocks[0].id]: '1',
      [blocks[1].id]: '2',
      [blocks[2].id]: '2',
    })
  })

  it('compacts later numeric slots when a scene moves out of its old number', () => {
    const { blocks, project } = projectWithSceneNumbers(['28A', '30', '31', '32'])

    const updated = updateSceneNumberLabel(project, blocks[1].id, '28B')

    expect(updated.advanced.sceneNumbering.numbers).toEqual({
      [blocks[0].id]: '28A',
      [blocks[1].id]: '28B',
      [blocks[2].id]: '30',
      [blocks[3].id]: '31',
    })
  })

  it('keeps same-base suffix edits local to the edited scene', () => {
    const { blocks, project } = projectWithSceneNumbers([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ])

    const updated = updateSceneNumberLabel(project, blocks[1].id, '2A')

    expect(updated.advanced.sceneNumbering.numbers).toEqual({
      [blocks[0].id]: '1',
      [blocks[1].id]: '2A',
      [blocks[2].id]: '3',
      [blocks[3].id]: '4',
      [blocks[4].id]: '5',
      [blocks[5].id]: '6',
      [blocks[6].id]: '7',
      [blocks[7].id]: '8',
      [blocks[8].id]: '9',
    })
  })

  it('preserves target labels and compacts suffix series from the freed slot', () => {
    const { blocks, project } = projectWithSceneNumbers([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ])

    const afterScene4To2B = updateSceneNumberLabel(project, blocks[3].id, '2B')
    const afterScene5To5A = updateSceneNumberLabel(
      afterScene4To2B,
      blocks[5].id,
      '5A',
    )
    const afterScene7To5B = updateSceneNumberLabel(
      afterScene5To5A,
      blocks[7].id,
      '5B',
    )
    const afterScene4To2C = updateSceneNumberLabel(
      afterScene7To5B,
      blocks[4].id,
      '2C',
    )

    expect(afterScene4To2B.advanced.sceneNumbering.numbers).toEqual({
      [blocks[0].id]: '1',
      [blocks[1].id]: '2',
      [blocks[2].id]: '3',
      [blocks[3].id]: '2B',
      [blocks[4].id]: '4',
      [blocks[5].id]: '5',
      [blocks[6].id]: '6',
      [blocks[7].id]: '7',
      [blocks[8].id]: '8',
    })
    expect(afterScene5To5A.advanced.sceneNumbering.numbers[blocks[5].id]).toBe(
      '5A',
    )
    expect(afterScene7To5B.advanced.sceneNumbering.numbers).toMatchObject({
      [blocks[7].id]: '5B',
      [blocks[8].id]: '7',
    })
    expect(afterScene4To2C.advanced.sceneNumbering.numbers).toEqual({
      [blocks[0].id]: '1',
      [blocks[1].id]: '2',
      [blocks[2].id]: '3',
      [blocks[3].id]: '2B',
      [blocks[4].id]: '2C',
      [blocks[5].id]: '4A',
      [blocks[6].id]: '5',
      [blocks[7].id]: '4B',
      [blocks[8].id]: '6',
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
