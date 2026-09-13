import { describe, expect, it } from 'vitest'
import { analyzeProjectScenes, createSceneAnalyzer } from './sceneAnalysis'
import { createBlock, createEmptyProject } from './screenplay'
import { buildCharacterReport, buildDepartmentReport, buildDialogueReport, buildLocationReport, buildSceneReport } from './reportsAnalytics'
import { addCatalogOccurrence, createCatalogItem, removeTagCatalogItem, removeTagOccurrence, resolveTagging, restoreAutomaticBreakdown, tagScriptSelection, updateTagCatalogItem } from './taggingBreakdown'
import { hydrateProject } from './projectHydration'
import { buildCurrentReport } from '../workspaces/reportModel'

const hospital = () => {
  const project = createEmptyProject()
  project.blocks = [createBlock('scene-heading', 'INT. HOSPITAL - NIGHT'),
    createBlock('action', "RAVI, 42, lies unconscious on the bed. Maya enters carrying Ravi's backpack. A NURSE follows her. She checks the heart monitor."),
    createBlock('character', 'MAYA'), createBlock('dialogue', 'Is he going to be okay?')]
  return project
}

describe('canonical offline scene analysis', () => {
  it('understands the hospital fixture, including silent cast and medical dressing', () => {
    const project = hospital()
    const scene = analyzeProjectScenes(project)[0]
    expect(scene).toMatchObject({ cast: ['MAYA', 'RAVI'], nonSpeakingCast: ['RAVI'], location: 'HOSPITAL', intExt: 'INT.', dayNight: 'NIGHT' })
    expect(scene.occurrences).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'Extras', name: 'NURSE', quantity: 1 }),
      expect.objectContaining({ category: 'Props', name: 'backpack' }),
      expect.objectContaining({ category: 'Set Dressing', name: 'hospital bed' }),
      expect.objectContaining({ category: 'Set Dressing', name: 'heart monitor' }),
    ]))
    expect(buildSceneReport(project)[0].nonSpeakingCast).toEqual(['RAVI'])
    expect(buildCharacterReport(project).find(row => row.character === 'RAVI')?.sceneCount).toBe(1)
    expect(buildDialogueReport(project).map(row => row.character)).toEqual(['MAYA'])
    expect(buildDepartmentReport(project, 'Props').map(row => row.item)).toContain('backpack')
    expect(JSON.stringify(buildCurrentReport(project, 'scene', 'Cast'))).toContain('heart monitor')
  })
  it.each([
    ['JOHN enters. Sarah watches him. KARTHIK crosses the room without speaking.', 'Cast', 'SARAH'],
    ['JOHN opens the CAR door.', 'Vehicles', 'car'],
    ['He lights a cigarette.', 'Props', 'cigarette'],
    ['Blood covers her white dress.', 'Wardrobe', 'white dress'],
    ['Blood covers her white dress.', 'Makeup', 'blood'],
    ['Twenty students fill the classroom.', 'Extras', 'STUDENT'],
    ['A police cruiser screeches to a halt.', 'Vehicles', 'police cruiser'],
    ['A dog waits beside the table.', 'Animals', 'dog'],
    ['They fight. He punches her and she falls.', 'Stunts', 'falls'],
    ['The building EXPLODES. Fire and smoke rise.', 'SFX', 'explodes'],
    ['A hologram appears inside a portal.', 'VFX', 'hologram'],
    ['She sings a song beside the piano.', 'Music', 'song'],
  ])('extracts %s', (text, category, name) => {
    const project = hospital()
    project.blocks[1].text = text
    expect(analyzeProjectScenes(project)[0].occurrences).toContainEqual(expect.objectContaining({ category, name }))
    if (text.startsWith('Twenty')) expect(analyzeProjectScenes(project)[0].occurrences.find(item => item.name === 'STUDENT')?.quantity).toBe(20)
  })
  it('uses aliases and distinguishes physical presence from references and dialogue', () => {
    const project = hospital()
    project.characters.profiles.RAVI = { name: 'RAVI', aliases: ['RAV'], bio: '', notes: '', customFields: [], imageDataUrl: '' }
    project.production.breakdown.push({ id: 'legacy-rav', kind: 'cast', name: 'Rav', sceneIds: [], notes: '' })
    project.blocks[1].text = 'Rav sits beside Maya. MAYA watches Rav. JOHN opens the CAR door.'
    expect(analyzeProjectScenes(project)[0].cast).toEqual(['JOHN', 'MAYA', 'RAVI'])
    const other = hospital()
    other.characters = project.characters
    other.blocks[1].text = "A photo of Ravi hangs above the bed. He lights a cigarette without a lighter. The CAR door opens. Rain falls."
    other.blocks[3].text = 'Bring a gun and a helicopter.'
    const scene = analyzeProjectScenes(other)[0]
    expect(scene.cast).toEqual(['MAYA'])
    expect(scene.occurrences.some(item => ['lighter', 'gun', 'helicopter'].includes(item.name))).toBe(false)
    expect(scene.occurrences.some(item => item.category === 'Stunts')).toBe(false)
  })
  it('normalizes dialogue aliases and excludes speech from omitted scenes', () => {
    const project = hospital()
    project.characters.profiles.MAYA = { name: 'MAYA', aliases: ['MAY'], bio: '', notes: '', customFields: [], imageDataUrl: '' }
    project.blocks[2].text = 'MAY (O.S.)'
    expect(buildDialogueReport(project)[0].character).toBe('MAYA')
    project.blocks[0].omitted = true
    expect(buildDialogueReport(project)).toEqual([])
  })
  it('counts repeated headings as distinct scenes and keeps sublocations distinct', () => {
    const project = hospital()
    project.blocks.push(createBlock('scene-heading', 'INT. Hospital - NIGHT'), createBlock('action', 'Ravi lies still.'),
      createBlock('scene-heading', 'INT. HOSPITAL - CORRIDOR - NIGHT'), createBlock('action', 'Maya enters.'))
    expect(buildCharacterReport(project).find(row => row.character === 'RAVI')?.sceneCount).toBe(2)
    expect(buildLocationReport(project)).toHaveLength(2)
    expect(buildLocationReport(project)[0].scenes).toHaveLength(2)
  })
  it('only reextracts the edited scene and invalidates character knowledge globally', () => {
    const engine = createSceneAnalyzer()
    const project = hospital()
    project.blocks.push(createBlock('scene-heading', 'EXT. ROAD - DAY'), createBlock('action', 'A car stops.'))
    const first = engine.analyze(project)
    expect(engine.recomputedScenes).toBe(2)
    const edited = structuredClone(project)
    edited.blocks[5].text = 'A car stops beside a truck.'
    const second = engine.analyze(edited)
    expect(engine.recomputedScenes).toBe(1)
    expect(second[0]).toBe(first[0])
    expect(second[1]).not.toBe(first[1])
    edited.blocks[5].text = 'JOHN enters.'
    engine.analyze(edited)
    expect(engine.recomputedScenes).toBe(2)
  })
  it('keeps a 120-page script incremental and prunes removed scenes', () => {
    const project = hospital()
    project.blocks = Array.from({ length: 120 }, (_, i) => [
      createBlock('scene-heading', `INT. ROOM ${i} - DAY`),
      createBlock('action', 'MAYA watches Ravi beside a backpack. '.repeat(35)),
    ]).flat()
    const engine = createSceneAnalyzer()
    const initial = engine.analyze(project)
    const edited = structuredClone(project)
    edited.blocks[23].text += ' A phone rings.'
    const next = engine.analyze(edited)
    expect(engine.recomputedScenes).toBe(1)
    expect(next.filter((scene, index) => scene === initial[index])).toHaveLength(119)
    edited.blocks.splice(20, 2)
    expect(engine.analyze(edited)).toHaveLength(119)
    expect(engine.recomputedScenes).toBe(0)
  })
})

describe('editable reconciled breakdown and compatibility', () => {
  it('retains item edits, category, notes, cost and confirmations through edits and hydration', () => {
    let project = hospital()
    const item = resolveTagging(project).catalog.find(item => item.name === 'backpack')!
    project = updateTagCatalogItem(project, item.id, { name: 'Ravi bag', category: 'Custom', notes: 'Hero bag', cost: 25 })
    project.blocks[1].text += ' A car arrives.'
    project = hydrateProject(JSON.parse(JSON.stringify(project)))
    expect(resolveTagging(project).catalog.find(entry => entry.id === item.id)).toMatchObject({ name: 'Ravi bag', category: 'Custom', cost: 25, notes: 'Hero bag', source: 'edited' })
    expect(buildDepartmentReport(project, 'Custom')[0].occurrences).toBe(1)
  })
  it('keeps rejections rejected across text offsets, saves and repeated runs, with explicit restoration', () => {
    let project = hospital()
    const item = resolveTagging(project).catalog.find(item => item.name === 'backpack')!
    project = removeTagCatalogItem(project, item.id)
    project.blocks[1].text = `Later, ${project.blocks[1].text}`
    project = hydrateProject(JSON.parse(JSON.stringify(project)))
    expect(resolveTagging(project).catalog.some(item => item.name === 'backpack')).toBe(false)
    expect(resolveTagging(restoreAutomaticBreakdown(project)).catalog.some(item => item.name === 'backpack')).toBe(true)
  })
  it('adds/removes occurrences and keeps manual entries without duplicates', () => {
    let project = hospital()
    const auto = resolveTagging(project).tags.find(tag => tag.text === 'backpack')!
    project = removeTagOccurrence(project, auto.id)
    expect(resolveTagging(project).tags.some(tag => tag.text === 'backpack')).toBe(false)
    project = createCatalogItem(project, 'Custom', 'Safety coordinator', project.blocks[0].id)
    const item = project.tagging.catalog.find(item => item.name === 'Safety coordinator')!
    project.blocks.push(createBlock('scene-heading', 'EXT. ROAD - DAY'))
    project = addCatalogOccurrence(project, item.id, project.blocks.at(-1)!.id)
    expect(buildDepartmentReport(project, 'Custom')[0].occurrences).toBe(2)
    const old = hospital()
    const offset = old.blocks[1].text.indexOf('backpack')
    project = tagScriptSelection(old, { blockId: old.blocks[1].id, start: offset, end: offset + 8, category: 'Props' })
    expect(resolveTagging(project).tags.filter(tag => tag.text === 'backpack')).toHaveLength(1)
  })
  it('preserves every existing schema-1 field and defaults only new optional state', () => {
    const project = hospital()
    project.cards.push({ id: 'card', title: 'Beat', beat: 'Keep', linkedSceneId: project.blocks[0].id })
    project.production.schedule.push({ id: 'day', day: 1, sceneId: project.blocks[0].id, location: 'Set', notes: 'Keep' })
    project.tagging = { tags: [], catalog: [{ id: 'manual', name: 'Old manual item', category: 'Custom', cost: 12, notes: 'Keep', imageDataUrl: '' }] }
    const restored = hydrateProject(JSON.parse(JSON.stringify(project)))
    for (const key of ['blocks', 'cards', 'production', 'tagging', 'characters', 'story', 'productivity', 'revisionSnapshots', 'revisionDraftSets', 'catalog'] as const) expect(restored[key]).toEqual(project[key])
    expect(resolveTagging(restored).catalog).toContainEqual(project.tagging.catalog[0])
  })
})
