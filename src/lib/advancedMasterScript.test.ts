import { describe, expect, it } from 'vitest'
import { createBlock, createEmptyProject } from './screenplay'
import {
  addCoverageRecord,
  addParkingLotScene,
  addRevisionDistribution,
  assignProductionSceneNumbers,
  beginProductionDraft,
  buildAccessibilityExports,
  buildAdvancedNavigatorRows,
  buildAdvancedSidesPackage,
  buildCoveragePdfLines,
  buildLegalWorkflowLinks,
  buildOneLinerSchedule,
  buildPrintExportSettings,
  buildRevisionDistributionCsv,
  buildRevisionSlugList,
  buildScriptCheck,
  buildSeriesReviewFlags,
  buildTableReadExportOptions,
  buildTimingReport,
  buildTitlePageWarnings,
  createDigitalSidesLink,
  createLockedPagePlan,
  createPdfExportProject,
  exportHtmlProject,
  exportReportWorkbookXml,
  exportRtfProject,
  exportSceneListCsv,
  exportTxtProject,
  importHtmlProject,
  importPdfTextProject,
  importPlainTextProject,
  importRtfProject,
  normalizeSlugLine,
  parseSlugLine,
  scriptFormatPresets,
  smartTypeExtensions,
  smartTypeTimesOfDay,
  smartTypeTransitions,
  technicalElementTemplates,
  updateAdvancedSettings,
} from './advancedMasterScript'

const buildAdvancedProject = () => {
  const project = createEmptyProject()
  const sceneA = createBlock('scene-heading', 'I/E KITCHEN - DAY')
  const actionA = createBlock('action', 'Maya grips a phone. Maya looks afraid.')
  const mayaA = createBlock('character', 'MAYA')
  const parenthetical = createBlock('parenthetical', '(quietly, with a long line that spills past the recommended parenthetical limit)')
  const dialogueA = createBlock('dialogue', 'I am sad and scared.')
  const transitionA = createBlock('transition', 'CUT TO:')
  const sceneB = createBlock('scene-heading', 'INT. THE KITCHEN AREA - CONTINUOUS')
  const actionB = createBlock('action', 'A police car waits outside.')
  const underFive = createBlock('character', 'GUARD')
  const dialogueB = createBlock('dialogue', 'Stop.')

  project.blocks = [
    sceneA,
    actionA,
    mayaA,
    parenthetical,
    dialogueA,
    transitionA,
    sceneB,
    actionB,
    underFive,
    dialogueB,
  ]
  project.catalog = [
    { id: 'maya', kind: 'character', name: 'MAYA', notes: '' },
    { id: 'guard', kind: 'character', name: 'GUARD', notes: '' },
  ]
  project.story.sceneMeta[sceneA.id] = {
    sceneId: sceneA.id,
    status: 'Draft',
    color: '#8899aa',
    summary: 'Maya admits fear.',
    actBreak: 'ACT ONE',
  }

  return { project, sceneA, sceneB }
}

describe('advanced MasterScript feature suite', () => {
  it('defines additional script formats, SmartType lists, and technical elements', () => {
    expect(scriptFormatPresets.map((format) => format.id)).toEqual(
      expect.arrayContaining([
        'tv-one-hour',
        'multi-cam-sitcom',
        'stage-play',
        'audio-drama',
        'comic-book',
        'two-column-av',
        'documentary',
      ]),
    )
    expect(smartTypeTimesOfDay).toContain('MAGIC HOUR')
    expect(smartTypeTransitions).toContain('WHIP PAN TO:')
    expect(smartTypeExtensions).toContain('DUBBED')
    expect(technicalElementTemplates.map((element) => element.label)).toEqual(
      expect.arrayContaining(['TITLE OVER BLACK', 'PRELAP:', 'THE END', 'BACK TO SCENE']),
    )
  })

  it('imports and exports additional script formats without external services', () => {
    const { project } = buildAdvancedProject()

    expect(importPlainTextProject('Title: Pilot\n\nINT. ROOM - DAY\n\nHello').meta.title).toBe('Pilot')
    expect(importRtfProject('{\\rtf1\\ansi INT. ROOM - DAY\\par Hello}').blocks[0].text).toContain('INT.')
    expect(importHtmlProject('<h1>INT. ROOM - DAY</h1><p>Hello</p>').blocks[0].type).toBe('scene-heading')
    expect(importPdfTextProject('INT. ROOM - DAY\nHello').blocks[0].type).toBe('scene-heading')
    expect(exportTxtProject(project)).toContain('I/E KITCHEN - DAY')
    expect(exportRtfProject(project)).toContain('\\rtf1')
    expect(exportHtmlProject(project)).toContain('<article')
    expect(exportSceneListCsv(project)).toContain('Scene,Heading,INT/EXT,Location,Time')
    expect(exportReportWorkbookXml('Report', [['A', 'B'], ['1', '2']])).toContain('Workbook')
  })

  it('normalizes and checks slug lines, parentheticals, transitions, extensions, and style thresholds', () => {
    const { project } = buildAdvancedProject()

    expect(normalizeSlugLine('I/E kitchen - magic hour')).toBe('INT./EXT. KITCHEN - MAGIC HOUR')
    expect(parseSlugLine('INT. MANSION - BALLROOM - NIGHT')).toMatchObject({
      location: 'MANSION',
      subLocation: 'BALLROOM',
      timeOfDay: 'NIGHT',
    })
    expect(parseSlugLine('INT. BOYS HOSTEL ROOM. NIGHT. SCENE 1')).toMatchObject({
      intExt: 'INT.',
      location: 'BOYS HOSTEL ROOM',
      timeOfDay: 'NIGHT',
    })

    const check = buildScriptCheck(
      updateAdvancedSettings(project, {
        lint: {
          cutToThreshold: 0,
          parentheticalThreshold: 0,
          coldOpenPageLimit: 1,
          actImbalancePercent: 50,
          acknowledgedNonStandardExtensions: [],
        },
      }),
    )

    expect(check.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'SLUG_INCONSISTENCY',
        'CONTINUOUS_LOCATION_GAP',
        'CUT_TO_OVERUSE',
        'PARENTHETICAL_OVERUSE',
        'PARENTHETICAL_TOO_LONG',
        'ON_THE_NOSE_DIALOGUE',
      ]),
    )
  })

  it('handles title page production fields, watermarks, revision distribution, clean dirty export, and production draft setup', () => {
    let { project } = buildAdvancedProject()
    project = updateAdvancedSettings(project, {
      titlePage: {
        writtenBy: 'Writer A',
        screenplayBy: 'Writer B',
        storyBy: '',
        originalStoryBy: '',
        basedOn: '',
        earlierDraftWrittenBy: '',
        wgaRegistrationNumber: 'WGA123',
        copyrightNotice: 'Copyright 2026 Writer A',
        coverImageDataUrl: 'data:image/png;base64,cover',
      },
      print: {
        watermarkText: 'For Recipient',
        watermarkPosition: 'center',
        watermarkOpacity: 0.24,
        recipientWatermark: 'Reader One',
        draftInkSaver: true,
        twoUp: true,
      },
    })
    project = addRevisionDistribution(project, {
      date: '2026-05-19',
      color: 'blue',
      pages: ['1', '2A'],
      recipients: 'Line Producer',
    })
    project.blocks[1].revisionMark = true

    const productionDraft = beginProductionDraft(project)
    const dirty = createPdfExportProject(productionDraft, 'dirty')
    const clean = createPdfExportProject(productionDraft, 'clean')

    expect(buildTitlePageWarnings(project)[0].code).toBe('WGA_CREDIT_MIX')
    expect(buildRevisionSlugList(project)).toContain('Blue - 2026-05-19')
    expect(buildRevisionDistributionCsv(project)).toContain('2026-05-19,blue,1; 2A,Line Producer')
    expect(dirty.blocks.some((block) => block.revisionMark)).toBe(true)
    expect(clean.blocks.some((block) => block.revisionMark)).toBe(false)
    expect(productionDraft.meta.revisionMode).toBe(true)
    expect(productionDraft.advanced.sceneNumbering.locked).toBe(true)
    expect(buildPrintExportSettings(project)).toMatchObject({ twoUp: true, recipientWatermark: 'Reader One' })
  })

  it('models locked page physics, script coordinator exports, cast status, sides, one-liner, timing, and navigator enhancements', () => {
    let { project, sceneA } = buildAdvancedProject()
    project = assignProductionSceneNumbers(project)
    project.advanced.castStatuses.MAYA = 'Series Regular'
    project.advanced.castStatuses.GUARD = 'Under-5'
    project.production.schedule = [
      { id: 's1', day: 1, sceneId: sceneA.id, location: 'Kitchen', notes: '' },
    ]
    project.blocks[1].revisionMark = true

    const lockedPlan = createLockedPagePlan(project, {
      lockedPages: [{ label: '10', maxLines: 2, usedLines: 2 }],
      changedPageLabels: ['10A'],
    })
    const sides = buildAdvancedSidesPackage(project, 1, 'GUARD')
    const link = createDigitalSidesLink(project.id, { expiresAt: '2026-06-01' })

    expect(project.advanced.sceneNumbering.numbers[sceneA.id]).toBe('1')
    expect(lockedPlan.fixedPageMode).toBe(true)
    expect(lockedPlan.overflowPages[0].label).toBe('10A')
    expect(sides.coverCards[0]).toMatchObject({ sceneHeading: 'INT./EXT. KITCHEN - DAY' })
    expect(link).toContain('expires=2026-06-01')
    expect(buildOneLinerSchedule(project)[0]).toMatchObject({ sceneNumber: '1', location: 'KITCHEN' })
    expect(buildTimingReport(project).totalMinutes).toBeGreaterThan(0)
    expect(buildAdvancedNavigatorRows(project)[0]).toMatchObject({
      intExt: 'INT./EXT.',
      dayNight: 'DAY',
      status: 'Draft',
    })
  })

  it('supports series, coverage, writer-room, print/accessibility, and legal workflow tools', () => {
    let { project } = buildAdvancedProject()
    project = addParkingLotScene(project, 'CUT SCENE', [createBlock('action', 'Unused scene.')])
    project = addCoverageRecord(project, {
      draftId: 'white-draft',
      logline: 'A writer ships a draft.',
      format: 'Feature',
      genre: 'Drama',
      setting: 'Los Angeles',
      timePeriod: 'Present',
      characters: [{ name: 'MAYA', description: 'Lead' }],
      synopsisByAct: { actOne: 'Setup', actTwo: 'Conflict', actThree: 'Resolution' },
      comments: { story: 'Strong', character: 'Clear', dialogue: 'Sharp', format: 'Clean' },
      recommendation: 'Consider',
      ratings: { concept: 4, story: 4, structure: 3, character: 4, dialogue: 4, format: 5 },
    })
    project.advanced.series.sharedCharacters.MAYA = { name: 'MAYA', renamedTo: 'NORA' }

    expect(buildSeriesReviewFlags(project)[0]).toContain('MAYA')
    expect(project.advanced.writerRoom.parkingLot[0].title).toBe('CUT SCENE')
    expect(buildCoveragePdfLines(project.advanced.coverage[0])).toContain('Recommendation: Consider')
    expect(buildTableReadExportOptions()).toMatchObject({ fontSize: 14, pageNumbersReset: true })
    expect(buildAccessibilityExports(project).formats).toEqual(
      expect.arrayContaining(['audio-description', 'tagged-pdf', 'closed-caption']),
    )
    expect(buildLegalWorkflowLinks(project).wgaUrl).toContain('wga')
  })
})
