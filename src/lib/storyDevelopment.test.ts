import { describe, expect, it } from 'vitest'
import { createBlock, createEmptyProject } from './screenplay'
import {
  buildHierarchicalOutline,
  ensureStoryDevelopmentState,
  reorderScenesByOutline,
  setSceneDevelopmentMeta,
  setSceneNote,
  updateCorkboardCard,
} from './storyDevelopment'

describe('story development helpers', () => {
  it('builds an Act -> Sequence -> Scene outline from script scenes', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. CAFE - DAY'),
      createBlock('scene-heading', 'EXT. ROOFTOP - NIGHT'),
    ]

    const outline = buildHierarchicalOutline(project)

    expect(outline[0].type).toBe('act')
    expect(outline[0].children[0].type).toBe('sequence')
    expect(outline[0].children[0].children.map((node) => node.title)).toEqual([
      'INT. CAFE - DAY',
      'EXT. ROOFTOP - NIGHT',
    ])
  })

  it('reorders script scene blocks from outline order while preserving scene bodies', () => {
    const project = createEmptyProject()
    const sceneA = createBlock('scene-heading', 'INT. CAFE - DAY')
    const actionA = createBlock('action', 'A beat.')
    const sceneB = createBlock('scene-heading', 'EXT. ROOFTOP - NIGHT')
    const actionB = createBlock('action', 'B beat.')
    project.blocks = [sceneA, actionA, sceneB, actionB]

    const reordered = reorderScenesByOutline(project, [sceneB.id, sceneA.id])

    expect(reordered.blocks.map((block) => block.text)).toEqual([
      'EXT. ROOFTOP - NIGHT',
      'B beat.',
      'INT. CAFE - DAY',
      'A beat.',
    ])
  })

  it('stores freeform corkboard position, color, image, and scene sync metadata', () => {
    const project = createEmptyProject()
    const card = project.cards[0]

    const updated = updateCorkboardCard(project, card.id, {
      x: 120,
      y: 240,
      color: '#7c3aed',
      imageDataUrl: 'data:image/png;base64,abc',
    })

    expect(updated.cards[0].x).toBe(120)
    expect(updated.cards[0].y).toBe(240)
    expect(updated.cards[0].color).toBe('#7c3aed')
    expect(updated.cards[0].imageDataUrl).toContain('data:image')
  })

  it('stores scene status, color, summary, and act markers', () => {
    const project = createEmptyProject()
    const scene = createBlock('scene-heading', 'INT. OFFICE - DAY')
    project.blocks = [scene]

    const updated = setSceneDevelopmentMeta(project, scene.id, {
      status: 'Needs Revision',
      color: '#f97316',
      summary: 'Hero loses leverage.',
      actBreak: 'Act 2 Break',
    })

    expect(updated.story.sceneMeta[scene.id]).toEqual({
      sceneId: scene.id,
      status: 'Needs Revision',
      color: '#f97316',
      summary: 'Hero loses leverage.',
      actBreak: 'Act 2 Break',
    })
  })

  it('preserves script-level, scene-level, inline, and scratchpad notes', () => {
    let project = ensureStoryDevelopmentState(createEmptyProject())
    const scene = createBlock('scene-heading', 'INT. OFFICE - DAY')
    project.blocks = [scene]

    project = setSceneNote(project, 'script', 'Global theme note')
    project = setSceneNote(project, 'scratchpad', 'Loose idea')
    project = setSceneNote(project, 'scene', 'Scene-specific note', scene.id)
    project = setSceneNote(project, 'inline', 'Line note', scene.id)

    expect(project.story.notes.script).toBe('Global theme note')
    expect(project.story.notes.scratchpad).toBe('Loose idea')
    expect(project.story.notes.scenes[scene.id]).toBe('Scene-specific note')
    expect(project.story.notes.inline[0].text).toBe('Line note')
  })
})
