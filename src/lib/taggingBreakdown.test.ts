import { describe, expect, it } from 'vitest'
import { createBlock, createEmptyProject } from './screenplay'
import {
  autoTagScript,
  buildBreakdownCsv,
  buildBreakdownSheet,
  buildTagCatalog,
  departmentTagColors,
  tagScriptSelection,
  updateTagCatalogItem,
} from './taggingBreakdown'

const buildTaggedProject = () => {
  const project = createEmptyProject()
  const scene = createBlock('scene-heading', 'INT. GARAGE - NIGHT')
  const action = createBlock(
    'action',
    'Maya grabs the silver revolver beside a dented taxi.',
  )

  project.blocks = [scene, action]
  return { project, scene, action }
}

describe('tagging and breakdown helpers', () => {
  it('tags a selected script phrase with category, scene, catalog item, and color', () => {
    const { project, scene, action } = buildTaggedProject()
    const start = action.text.indexOf('silver revolver')
    const end = start + 'silver revolver'.length

    const updated = tagScriptSelection(project, {
      blockId: action.id,
      start,
      end,
      category: 'Props',
    })

    expect(updated.tagging.tags).toHaveLength(1)
    expect(updated.tagging.tags[0]).toMatchObject({
      blockId: action.id,
      sceneId: scene.id,
      category: 'Props',
      text: 'silver revolver',
      color: departmentTagColors.Props,
    })
    expect(updated.tagging.catalog[0]).toMatchObject({
      category: 'Props',
      name: 'silver revolver',
    })
  })

  it('groups catalog items and preserves cost, notes, and image metadata', () => {
    const { project, action } = buildTaggedProject()
    const start = action.text.indexOf('dented taxi')
    let updated = tagScriptSelection(project, {
      blockId: action.id,
      start,
      end: start + 'dented taxi'.length,
      category: 'Vehicles',
    })

    updated = updateTagCatalogItem(updated, updated.tagging.catalog[0].id, {
      cost: 850,
      notes: 'Hero picture car',
      imageDataUrl: 'data:image/png;base64,vehicle',
    })

    const grouped = buildTagCatalog(updated)

    expect(grouped.Vehicles?.[0]).toMatchObject({
      name: 'dented taxi',
      cost: 850,
      notes: 'Hero picture car',
      imageDataUrl: 'data:image/png;base64,vehicle',
    })
  })

  it('builds a printable breakdown sheet per scene', () => {
    const { project, scene, action } = buildTaggedProject()
    const start = action.text.indexOf('silver revolver')
    const updated = tagScriptSelection(project, {
      blockId: action.id,
      start,
      end: start + 'silver revolver'.length,
      category: 'Props',
    })

    const sheet = buildBreakdownSheet(updated, scene.id)

    expect(sheet.sceneHeading).toBe('INT. GARAGE - NIGHT')
    expect(sheet.categories.Props?.[0].name).toBe('silver revolver')
    expect(sheet.categories.Props?.[0].occurrences[0].blockId).toBe(action.id)
  })

  it('exports breakdown data to CSV', () => {
    const { project, action } = buildTaggedProject()
    const start = action.text.indexOf('dented taxi')
    const updated = tagScriptSelection(project, {
      blockId: action.id,
      start,
      end: start + 'dented taxi'.length,
      category: 'Vehicles',
    })

    const csv = buildBreakdownCsv(updated)

    expect(csv).toContain('Category,Item,Scene,Text,Cost,Notes')
    expect(csv).toContain('Vehicles,dented taxi,INT. GARAGE - NIGHT,dented taxi,0,')
  })

  it('suggests local auto-tags from script text without external services', () => {
    const project = createEmptyProject()
    const scene = createBlock('scene-heading', 'EXT. ROAD - DAY')
    const action = createBlock(
      'action',
      'A police car swerves around a dog as an explosion rattles the street.',
    )
    project.blocks = [scene, action]

    const suggestions = autoTagScript(project)

    expect(suggestions.map((suggestion) => suggestion.category)).toEqual(
      expect.arrayContaining(['Vehicles', 'Animals', 'SFX']),
    )
    expect(suggestions.map((suggestion) => suggestion.text)).toEqual(
      expect.arrayContaining(['police car', 'dog', 'explosion']),
    )
  })
})
