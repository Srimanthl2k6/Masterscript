import { describe, expect, it } from 'vitest'
import { createBlock, createEmptyProject } from './screenplay'
import {
  buildSmartTypeOptions,
  inferContinuousBlockType,
  rebuildCatalogFromScript,
  renameCharacterAcrossProject,
  standardScriptExtensions,
} from './formattingEngine'

describe('formatting engine helpers', () => {
  it('recognizes standard special elements and transitions from continuous text', () => {
    expect(inferContinuousBlockType('SUPER: THREE YEARS LATER', 'action')).toBe('super')
    expect(inferContinuousBlockType('INSERT - THE BLOODY KEY', 'action')).toBe('insert')
    expect(inferContinuousBlockType('INTERCUT WITH:', 'action')).toBe('intercut')
    expect(inferContinuousBlockType('FLASHBACK', 'action')).toBe('flashback')
    expect(inferContinuousBlockType('END FLASHBACK', 'action')).toBe('end-flashback')
    expect(inferContinuousBlockType('MONTAGE', 'action')).toBe('montage')
    expect(inferContinuousBlockType('END MONTAGE', 'action')).toBe('end-montage')
    expect(inferContinuousBlockType('SMASH CUT TO:', 'action')).toBe('transition')
    expect(inferContinuousBlockType('MATCH CUT TO:', 'action')).toBe('transition')
  })

  it('builds SmartType suggestions for the active continuous editor', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. CAFE - DAY'),
      createBlock('character', 'Maya'),
      createBlock('dialogue', 'Coffee first.'),
      createBlock('scene-heading', 'EXT. ROOFTOP - NIGHT'),
      createBlock('shot', 'CLOSE ON: THE ANTENNA'),
    ]

    const options = buildSmartTypeOptions(project)

    expect(options.characters).toContain('MAYA')
    expect(options.locations).toContain('CAFE')
    expect(options.locations).toContain('ROOFTOP')
    expect(options.timesOfDay).toContain('NIGHT')
    expect(options.transitions).toContain('SMASH CUT TO:')
    expect(options.shots).toContain('CLOSE ON:')
    expect(options.extensions).toEqual(standardScriptExtensions)
  })

  it('renames a character throughout script, catalog, breakdown, and stash-ready text', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'I am Maya.'),
      createBlock('character', "MAYA (V.O.)"),
      createBlock('dialogue', 'Still here.'),
    ]
    project.catalog = [{ id: 'cat-1', kind: 'character', name: 'Maya', notes: 'Lead' }]
    project.production.breakdown = [
      { id: 'cast-1', kind: 'cast', name: 'MAYA', sceneIds: [], notes: '' },
    ]

    const renamed = renameCharacterAcrossProject(project, 'Maya', 'Nora')

    expect(renamed.blocks[0].text).toBe('NORA')
    expect(renamed.blocks[2].text).toBe('NORA (V.O.)')
    expect(renamed.catalog[0].name).toBe('NORA')
    expect(renamed.production.breakdown[0].name).toBe('NORA')
    expect(project.blocks[0].text).toBe('MAYA')
  })

  it('rebuilds character and location catalog from current script only', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. CAFE - DAY'),
      createBlock('character', 'MAYA'),
    ]
    project.catalog = [
      { id: 'keep-1', kind: 'character', name: 'MAYA', notes: 'Keep note' },
      { id: 'drop-1', kind: 'character', name: 'REMOVED', notes: 'Gone' },
      { id: 'keep-2', kind: 'location', name: 'CAFE', notes: 'Keep location' },
    ]

    const rebuilt = rebuildCatalogFromScript(project)

    expect(rebuilt.map((entry) => `${entry.kind}:${entry.name}`).sort()).toEqual([
      'character:MAYA',
      'location:CAFE',
    ])
    expect(rebuilt.find((entry) => entry.name === 'MAYA')?.notes).toBe('Keep note')
  })
})
