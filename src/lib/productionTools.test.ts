import { describe, expect, it } from 'vitest'
import { createBlock, createEmptyProject } from './screenplay'
import {
  addShotToScene,
  buildCallSheet,
  buildDoodGrid,
  buildDoodGridCsv,
  buildScriptSides,
  buildShotListCsv,
  buildStoryboardExportPages,
  buildStripboard,
  reorderStripboard,
} from './productionTools'

const buildProductionProject = () => {
  const project = createEmptyProject()
  const sceneA = createBlock('scene-heading', 'INT. DINER - DAY')
  const sceneB = createBlock('scene-heading', 'EXT. PIER - NIGHT')
  const sceneC = createBlock('scene-heading', 'INT. MOTEL - DAY')

  project.blocks = [
    sceneA,
    createBlock('action', 'Coffee burns on the counter.'),
    createBlock('character', 'MAYA'),
    createBlock('dialogue', 'We start here.'),
    sceneB,
    createBlock('action', 'Waves swallow the lights.'),
    createBlock('character', 'JON'),
    createBlock('dialogue', 'This ends tonight.'),
    sceneC,
    createBlock('action', 'A room key turns.'),
    createBlock('character', 'MAYA'),
    createBlock('dialogue', 'Not yet.'),
  ]

  project.production.schedule = [
    { id: 'sch-a', day: 1, sceneId: sceneA.id, location: 'Diner', notes: 'Morning' },
    { id: 'sch-b', day: 2, sceneId: sceneB.id, location: 'Pier', notes: 'Night' },
    { id: 'sch-c', day: 3, sceneId: sceneC.id, location: 'Motel', notes: 'Pickup' },
  ]
  project.production.breakdown = [
    { id: 'maya', kind: 'cast', name: 'MAYA', sceneIds: [sceneA.id, sceneC.id], notes: '' },
    { id: 'jon', kind: 'cast', name: 'JON', sceneIds: [sceneB.id], notes: '' },
    { id: 'ad', kind: 'crew', name: '1st AD', sceneIds: [], notes: 'Alex Rivers' },
  ]

  return { project, sceneA, sceneB, sceneC }
}

describe('production tools', () => {
  it('builds a stripboard from schedule, scenes, and cast breakdown', () => {
    const { project, sceneA } = buildProductionProject()

    const strips = buildStripboard(project)

    expect(strips[0]).toMatchObject({
      id: 'sch-a',
      day: 1,
      sceneId: sceneA.id,
      heading: 'INT. DINER - DAY',
      location: 'Diner',
      cast: ['MAYA'],
    })
    expect(strips[0].color).toBe('#f1d690')
  })

  it('reads day and night metadata from dot-separated scene headings', () => {
    const project = createEmptyProject()
    const scene = createBlock('scene-heading', 'EXT. COLLEGE CORRIDOR. NIGHT. SCENE 2')
    project.blocks = [scene, createBlock('action', 'Footsteps echo.')]
    project.production.schedule = [
      { id: 'sch-dot', day: 1, sceneId: scene.id, location: '', notes: '' },
    ]

    const [strip] = buildStripboard(project)

    expect(strip).toMatchObject({
      intExt: 'EXT.',
      dayNight: 'NIGHT',
      location: 'COLLEGE CORRIDOR',
      color: '#8aa4c8',
    })
  })

  it('reorders stripboard rows by schedule id', () => {
    const { project } = buildProductionProject()

    const updated = reorderStripboard(project, 'sch-c', 'sch-a')

    expect(updated.production.schedule.map((entry) => entry.id)).toEqual([
      'sch-c',
      'sch-a',
      'sch-b',
    ])
  })

  it('builds a day-out-of-days grid with start, hold, finish, and drop markers', () => {
    const { project } = buildProductionProject()

    const grid = buildDoodGrid(project)
    const maya = grid.rows.find((row) => row.character === 'MAYA')
    const jon = grid.rows.find((row) => row.character === 'JON')

    expect(grid.days).toEqual([1, 2, 3])
    expect(maya?.markers).toEqual(['S', 'H', 'F'])
    expect(jon?.markers).toEqual(['-', 'S/F', 'D'])
  })

  it('exports the day-out-of-days grid as CSV', () => {
    const { project } = buildProductionProject()

    const csv = buildDoodGridCsv(project)

    expect(csv).toContain('Character,Day 1,Day 2,Day 3')
    expect(csv).toContain('MAYA,S,H,F')
  })

  it('builds call sheets and sides for a selected shoot day', () => {
    const { project, sceneB } = buildProductionProject()
    project.blocks[5].revisionMark = true

    const callSheet = buildCallSheet(project, 2)
    const sides = buildScriptSides(project, 2)

    expect(callSheet.scenes[0].heading).toBe('EXT. PIER - NIGHT')
    expect(callSheet.cast).toEqual(['JON'])
    expect(callSheet.crew[0].name).toBe('1st AD')
    expect(sides.scenes[0].sceneId).toBe(sceneB.id)
    expect(sides.scenes[0].blocks.map((block) => block.text)).toContain(
      'Waves swallow the lights.',
    )
    expect(sides.scenes[0].hasRevisionMarks).toBe(true)
  })

  it('tracks per-scene shot lists and storyboard export labels', () => {
    let { project, sceneA } = buildProductionProject()

    project = addShotToScene(project, sceneA.id, {
      shotNumber: '1A',
      type: 'WS',
      angle: 'Eye-level',
      lens: '35mm',
      movement: 'Dolly',
      description: 'Reveal the diner counter.',
    })
    project.storyboards = [
      {
        id: 'panel-a',
        sceneId: sceneA.id,
        shot: 'Counter reveal',
        shotNumber: '1A',
        shotType: 'WS',
        angle: 'Eye-level',
        lens: '35mm',
        movement: 'Dolly',
        description: 'Reveal the diner counter.',
      },
    ]

    const csv = buildShotListCsv(project, sceneA.id)
    const pages = buildStoryboardExportPages(project)

    expect(csv).toContain('Shot Number,Scene,Type,Angle,Lens,Movement,Description')
    expect(csv).toContain('1A,INT. DINER - DAY,WS,Eye-level,35mm,Dolly')
    expect(pages[0].label).toBe('1A | WS')
  })
})
