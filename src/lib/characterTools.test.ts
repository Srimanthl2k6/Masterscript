import { describe, expect, it } from 'vitest'
import { createBlock, createEmptyProject } from './screenplay'
import {
  addCharacterRelationship,
  buildCharacterStats,
  buildDialogueDistribution,
  removeCharacterRelationship,
  renameCharacterEverywhere,
  setCharacterArcStage,
  upsertCharacterProfile,
} from './characterTools'

describe('character tools', () => {
  it('creates and updates profile pages with custom fields and images', () => {
    const project = createEmptyProject()

    const updated = upsertCharacterProfile(project, 'Maya', {
      bio: 'A paramedic hiding a secret.',
      notes: 'Carries guilt.',
      imageDataUrl: 'data:image/png;base64,abc',
      customFields: [{ id: 'field-1', label: 'Age', value: '32' }],
    })

    expect(updated.characters.profiles.MAYA.bio).toBe('A paramedic hiding a secret.')
    expect(updated.characters.profiles.MAYA.customFields[0].value).toBe('32')
    expect(project.characters?.profiles.MAYA).toBeUndefined()
  })

  it('calculates scene count and page/screen-time share per character', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. CAFE - DAY'),
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'We should go.'),
      createBlock('scene-heading', 'EXT. ROOF - NIGHT'),
      createBlock('character', 'JON'),
      createBlock('dialogue', 'Stay low.'),
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'I see them.'),
    ]

    const stats = buildCharacterStats(project)

    expect(stats.MAYA.sceneCount).toBe(2)
    expect(stats.JON.sceneCount).toBe(1)
    expect(stats.MAYA.screenTimePercent).toBeGreaterThan(stats.JON.screenTimePercent)
    expect(stats.MAYA.dialogueWords).toBe(6)
  })

  it('merges character stats across voice cue suffixes', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. CAFE - DAY'),
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'one two'),
      createBlock('character', 'MAYA (V.O.)'),
      createBlock('dialogue', 'three four'),
      createBlock('character', 'MAYA (O.S.)'),
      createBlock('dialogue', 'five six'),
    ]

    const stats = buildCharacterStats(project)

    expect(Object.keys(stats)).toEqual(['MAYA'])
    expect(stats.MAYA.dialogueLines).toBe(3)
    expect(stats.MAYA.dialogueWords).toBe(6)
  })

  it('builds dialogue distribution percentages for chart rendering', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'one two three four'),
      createBlock('character', 'JON'),
      createBlock('dialogue', 'one two'),
    ]

    const distribution = buildDialogueDistribution(project)

    expect(distribution.find((entry) => entry.character === 'MAYA')?.percent).toBeCloseTo(
      66.67,
      1,
    )
    expect(distribution.find((entry) => entry.character === 'JON')?.percent).toBeCloseTo(
      33.33,
      1,
    )
  })

  it('stores relationship map edges with labels', () => {
    const project = createEmptyProject()

    const updated = addCharacterRelationship(project, 'Maya', 'Jon', 'siblings')

    expect(updated.characters.relationships[0]).toMatchObject({
      from: 'MAYA',
      to: 'JON',
      label: 'siblings',
    })
  })

  it('removes a relationship by ID without mutating the source project', () => {
    const project = addCharacterRelationship(
      createEmptyProject(),
      'Maya',
      'Jon',
      'siblings',
    )
    const relationshipId = project.characters.relationships[0].id

    const updated = removeCharacterRelationship(project, relationshipId)

    expect(updated.characters.relationships).toEqual([])
    expect(project.characters.relationships).toHaveLength(1)
  })

  it('tracks character arc stage per scene', () => {
    const project = createEmptyProject()
    const scene = createBlock('scene-heading', 'INT. CAFE - DAY')
    project.blocks = [scene]

    const updated = setCharacterArcStage(project, 'Maya', scene.id, 'Conflict')

    expect(updated.characters.arcs.MAYA[scene.id]).toBe('Conflict')
  })

  it('renames a catalog character and propagates through script/profile/relationships/arcs', () => {
    let project = createEmptyProject()
    const scene = createBlock('scene-heading', 'INT. CAFE - DAY')
    project.blocks = [scene, createBlock('character', 'MAYA')]
    project = upsertCharacterProfile(project, 'Maya', { bio: 'Lead' })
    project = addCharacterRelationship(project, 'Maya', 'Jon', 'trusts')
    project = setCharacterArcStage(project, 'Maya', scene.id, 'Setup')

    const renamed = renameCharacterEverywhere(project, 'Maya', 'Nora')

    expect(renamed.blocks[1].text).toBe('NORA')
    expect(renamed.characters.profiles.NORA.bio).toBe('Lead')
    expect(renamed.characters.profiles.MAYA).toBeUndefined()
    expect(renamed.characters.relationships[0].from).toBe('NORA')
    expect(renamed.characters.arcs.NORA[scene.id]).toBe('Setup')
  })
})
