import { describe, expect, it } from 'vitest'
import {
  buildCharacterDialogueReport,
  buildDayOutOfDaysReport,
  collectCharacterSuggestions,
  createRevisionSnapshot,
  createBlock,
  createEmptyProject,
  cycleScreenplayBlockType,
  detectCatalogEntries,
  generateProductionBreakdown,
  insertCharacterVoiceCue,
  nextTypeForEnter,
  screenplayKeyboardCycle,
  summarizeRevisionSnapshotDiff,
  toFountain,
} from './screenplay'

describe('screenplay core behavior', () => {
  it('starts new projects with one blank scene heading block', () => {
    const project = createEmptyProject()

    expect(project.blocks).toHaveLength(1)
    expect(project.blocks[0]).toMatchObject({
      type: 'scene-heading',
      text: '',
    })
    expect(project.advanced.editor.shortcuts).toMatchObject({
      'scene-heading': 'Ctrl+Alt+1',
      action: 'Ctrl+Alt+2',
      transition: 'Ctrl+Alt+6',
    })
  })

  it('maps enter key behavior to screenplay-friendly next block types', () => {
    expect(nextTypeForEnter('scene-heading')).toBe('action')
    expect(nextTypeForEnter('action')).toBe('character')
    expect(nextTypeForEnter('character')).toBe('dialogue')
    expect(nextTypeForEnter('dialogue')).toBe('character')
    expect(nextTypeForEnter('parenthetical')).toBe('dialogue')
    expect(nextTypeForEnter('transition')).toBe('scene-heading')
  })

  it('cycles keyboard block formatting through primary screenplay elements', () => {
    expect(screenplayKeyboardCycle).toEqual([
      'scene-heading',
      'action',
      'character',
      'dialogue',
      'parenthetical',
      'transition',
      'shot',
    ])

    expect(cycleScreenplayBlockType('scene-heading', 1)).toBe('action')
    expect(cycleScreenplayBlockType('action', -1)).toBe('scene-heading')
    expect(cycleScreenplayBlockType('shot', 1)).toBe('scene-heading')
    expect(cycleScreenplayBlockType('super', 1)).toBe('scene-heading')
  })

  it('creates normalized fountain output', () => {
    const project = createEmptyProject()
    project.meta.title = 'Test Script'
    project.blocks = [
      createBlock('scene-heading', 'int. warehouse - night'),
      createBlock('action', 'Rain hits the broken skylight.'),
      createBlock('character', 'alex'),
      createBlock('parenthetical', 'whispers'),
      createBlock('dialogue', 'Someone is here.'),
      createBlock('transition', 'cut'),
    ]

    const fountain = toFountain(project)

    expect(fountain).toContain('Title: Test Script')
    expect(fountain).toContain('INT. WAREHOUSE - NIGHT')
    expect(fountain).toContain('ALEX')
    expect(fountain).toContain('(whispers)')
    expect(fountain).toContain('CUT TO:')
  })

  it('detects unique character and location catalog entries from script blocks', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. CAFE - DAY'),
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'Morning.'),
      createBlock('scene-heading', 'EXT. CAFE PATIO - DAY'),
      createBlock('character', 'MAYA'),
      createBlock('character', 'JON'),
    ]

    const catalog = detectCatalogEntries(project)

    expect(catalog.filter((entry) => entry.kind === 'character')).toHaveLength(2)
    expect(catalog.filter((entry) => entry.kind === 'location')).toHaveLength(2)
  })

  it('generates production breakdown entities from scenes and characters', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. CAFE - DAY'),
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'Morning.'),
      createBlock('scene-heading', 'EXT. ALLEY - NIGHT'),
      createBlock('character', 'JON'),
      createBlock('character', 'MAYA'),
    ]

    const breakdown = generateProductionBreakdown(project)

    expect(breakdown.filter((entry) => entry.kind === 'cast')).toHaveLength(2)
    expect(breakdown.filter((entry) => entry.kind === 'location')).toHaveLength(2)
  })

  it('builds a day-out-of-days report from schedule and cast breakdown', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. CAFE - DAY'),
      createBlock('character', 'MAYA'),
      createBlock('scene-heading', 'EXT. ALLEY - NIGHT'),
      createBlock('character', 'JON'),
    ]

    const [sceneOne, sceneTwo] = project.blocks.filter(
      (block) => block.type === 'scene-heading',
    )

    project.production.breakdown = generateProductionBreakdown(project)
    project.production.schedule = [
      {
        id: 'day-1',
        day: 1,
        sceneId: sceneOne.id,
        location: 'Cafe',
        notes: '',
      },
      {
        id: 'day-2',
        day: 2,
        sceneId: sceneTwo.id,
        location: 'Alley',
        notes: '',
      },
    ]

    const report = buildDayOutOfDaysReport(project)

    expect(report).toContain('Day-Out-of-Days')
    expect(report).toContain('MAYA')
    expect(report).toContain('JON')
    expect(report).toContain('D1')
    expect(report).toContain('D2')
  })

  it('collects unique character suggestions from blocks and catalog-like sources', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('character', 'maya'),
      createBlock('character', 'JON'),
      createBlock('character', 'MAYA'),
    ]
    project.catalog = [
      {
        id: 'cat-1',
        kind: 'character',
        name: 'nora',
        notes: '',
      },
    ]

    const suggestions = collectCharacterSuggestions(project)

    expect(suggestions).toEqual(['JON', 'MAYA', 'NORA'])
  })

  it('collects character suggestions without voice cue suffixes', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('character', 'MAYA'),
      createBlock('character', 'MAYA (V.O.)'),
      createBlock('character', 'MAYA (O.S.)'),
      createBlock('character', 'JON ('),
    ]

    const suggestions = collectCharacterSuggestions(project)

    expect(suggestions).toEqual(['JON', 'MAYA'])
  })

  it('builds a character dialogue report with counts', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. CAFE - DAY'),
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'We should leave now.'),
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'Take the back exit.'),
      createBlock('character', 'JON'),
      createBlock('dialogue', 'I will cover you.'),
    ]

    const report = buildCharacterDialogueReport(project)

    expect(report).toContain('Character Dialogue Report')
    expect(report).toContain('MAYA | 2 | 2 | 8')
    expect(report).toContain('JON | 1 | 1 | 4')
  })

  it('merges character dialogue report rows across voice cue suffixes', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. CAFE - DAY'),
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'One two.'),
      createBlock('character', 'MAYA (V.O.)'),
      createBlock('dialogue', 'Three four.'),
      createBlock('character', 'MAYA (O.S.)'),
      createBlock('dialogue', 'Five six.'),
    ]

    const report = buildCharacterDialogueReport(project)

    expect(report).toContain('MAYA | 3 | 3 | 6')
    expect(report).not.toContain('MAYA (V.O.)')
    expect(report).not.toContain('MAYA (O.S.)')
  })

  it('replaces open character parentheticals with screenplay voice cues', () => {
    expect(insertCharacterVoiceCue('MAYA (', 'V.O.')).toEqual({
      text: 'MAYA (V.O.)',
      cursor: 11,
    })
    expect(insertCharacterVoiceCue('MAYA (o', 'O.S.')).toEqual({
      text: 'MAYA (O.S.)',
      cursor: 11,
    })
  })

  it('creates revision snapshots that clone screenplay blocks', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. OFFICE - DAY'),
      createBlock('action', 'A phone vibrates on the desk.'),
    ]

    const snapshot = createRevisionSnapshot(project, 'Checkpoint A')

    expect(snapshot.label).toBe('Checkpoint A')
    expect(snapshot.blocks).toHaveLength(2)

    project.blocks[1].text = 'Changed after snapshot'
    expect(snapshot.blocks[1].text).toBe('A phone vibrates on the desk.')
  })

  it('summarizes revision snapshot diffs for added, removed, and changed blocks', () => {
    const project = createEmptyProject()
    const baseA = createBlock('scene-heading', 'INT. LAB - NIGHT')
    const baseB = createBlock('action', 'Monitors flicker in the dark.')

    project.blocks = [baseA, baseB]
    const snapshot = createRevisionSnapshot(project, 'Before changes')

    const changedB = { ...baseB, text: 'Monitors are dark and silent.' }
    const addedC = createBlock('dialogue', 'We are out of time.')
    project.blocks = [baseA, changedB, addedC]

    const diff = summarizeRevisionSnapshotDiff(snapshot, project.blocks)

    expect(diff).toEqual({
      added: 1,
      removed: 0,
      changed: 1,
      unchanged: 1,
    })
  })
})
