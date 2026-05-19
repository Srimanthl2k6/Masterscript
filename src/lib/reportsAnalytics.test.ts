import { describe, expect, it } from 'vitest'
import { createBlock, createEmptyProject } from './screenplay'
import { tagScriptSelection } from './taggingBreakdown'
import {
  buildAnalyticsDashboard,
  buildCharacterReport,
  buildDepartmentReport,
  buildDialogueReport,
  buildLocationReport,
  buildPageSceneSummary,
  buildReportCsv,
  buildSceneReport,
} from './reportsAnalytics'

const buildReportProject = () => {
  let project = createEmptyProject()
  const sceneA = createBlock('scene-heading', 'INT. CAFE - DAY')
  const actionA = createBlock('action', 'A silver revolver rests near a coffee cup.')
  const mayaA = createBlock('character', 'MAYA')
  const dialogueA = createBlock('dialogue', 'We wait for Jon.')
  const jonA = createBlock('character', 'JON')
  const dialogueB = createBlock('dialogue', 'Not anymore.')
  const sceneB = createBlock('scene-heading', 'EXT. ALLEY - NIGHT')
  const actionB = createBlock('action', 'Rain floods the alley.')
  const mayaB = createBlock('character', 'MAYA')
  const dialogueC = createBlock('dialogue', 'Run.')

  project.blocks = [
    sceneA,
    actionA,
    mayaA,
    dialogueA,
    jonA,
    dialogueB,
    sceneB,
    actionB,
    mayaB,
    dialogueC,
  ]
  project = tagScriptSelection(project, {
    blockId: actionA.id,
    start: actionA.text.indexOf('silver revolver'),
    end: actionA.text.indexOf('silver revolver') + 'silver revolver'.length,
    category: 'Props',
  })

  return { project, sceneA, sceneB }
}

describe('reports and analytics helpers', () => {
  it('builds scene report rows with heading metadata and cast', () => {
    const { project } = buildReportProject()

    const rows = buildSceneReport(project)

    expect(rows[0]).toMatchObject({
      sceneNumber: 1,
      heading: 'INT. CAFE - DAY',
      intExt: 'INT.',
      dayNight: 'DAY',
      castPresent: ['JON', 'MAYA'],
      pageCount: 1,
    })
  })

  it('builds character and dialogue reports', () => {
    const { project } = buildReportProject()

    const characterRows = buildCharacterReport(project)
    const dialogueRows = buildDialogueReport(project)

    expect(characterRows.find((row) => row.character === 'MAYA')).toMatchObject({
      sceneCount: 2,
      totalPages: 2,
    })
    expect(dialogueRows.find((row) => row.character === 'MAYA')).toMatchObject({
      lines: 2,
      words: 5,
    })
  })

  it('builds location and department reports', () => {
    const { project } = buildReportProject()

    const locations = buildLocationReport(project)
    const props = buildDepartmentReport(project, 'Props')

    expect(locations[0]).toMatchObject({
      location: 'CAFE',
      intExt: 'INT.',
      dayNight: 'DAY',
      totalPages: 1,
    })
    expect(props[0]).toMatchObject({
      item: 'silver revolver',
      scenes: ['INT. CAFE - DAY'],
    })
  })

  it('builds page and scene count summary plus CSV output', () => {
    const { project } = buildReportProject()

    const summary = buildPageSceneSummary(project)
    const csv = buildReportCsv(
      ['Scene', 'Heading'],
      buildSceneReport(project).map((row) => [row.sceneNumber, row.heading]),
    )

    expect(summary).toMatchObject({
      sceneCount: 2,
      estimatedPages: 1,
      taggedItems: 1,
    })
    expect(csv).toContain('Scene,Heading')
    expect(csv).toContain('1,INT. CAFE - DAY')
  })

  it('builds analytics dashboard chart data', () => {
    const { project } = buildReportProject()

    const analytics = buildAnalyticsDashboard(project)

    expect(analytics.intExt).toEqual([
      { label: 'INT.', value: 1 },
      { label: 'EXT.', value: 1 },
    ])
    expect(analytics.dayNight).toEqual([
      { label: 'DAY', value: 1 },
      { label: 'NIGHT', value: 1 },
    ])
    expect(analytics.dialogueVsAction.dialogueWords).toBe(7)
    expect(analytics.sceneLengthHistogram[0].sceneNumber).toBe(1)
  })

  it('recognizes dot-separated day and night scene headings with scene numbers', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. BOYS HOSTEL ROOM. NIGHT. SCENE 1'),
      createBlock('action', 'A lamp glows beside the bed.'),
      createBlock('scene-heading', 'EXT. COLLEGE CORRIDOR. DAY. SCENE 2'),
      createBlock('action', 'Students hurry past lockers.'),
    ]

    const sceneRows = buildSceneReport(project)
    const locationRows = buildLocationReport(project)
    const analytics = buildAnalyticsDashboard(project)

    expect(sceneRows[0]).toMatchObject({
      intExt: 'INT.',
      dayNight: 'NIGHT',
    })
    expect(sceneRows[1]).toMatchObject({
      intExt: 'EXT.',
      dayNight: 'DAY',
    })
    expect(locationRows.map((row) => row.location)).toEqual([
      'BOYS HOSTEL ROOM',
      'COLLEGE CORRIDOR',
    ])
    expect(analytics.dayNight).toEqual([
      { label: 'NIGHT', value: 1 },
      { label: 'DAY', value: 1 },
    ])
  })
})
