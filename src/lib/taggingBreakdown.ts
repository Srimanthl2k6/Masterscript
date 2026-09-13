import type {
  DepartmentTagCategory,
  ScriptProject,
  TagCatalogItem,
  TaggedScriptRange,
  TaggingState,
} from '../types/screenplay'
import { cloneProject, extractScenes } from './screenplay'
import { analyzeProjectScenes, inferenceItemKey } from './sceneAnalysis'

export const departmentTagCategories: DepartmentTagCategory[] = [
  'Cast',
  'Extras',
  'Props',
  'Wardrobe',
  'Makeup',
  'Animals',
  'VFX',
  'SFX',
  'Vehicles',
  'Stunts',
  'Locations',
  'Music',
  'Set Dressing',
  'Custom',
]

export const departmentTagColors: Record<DepartmentTagCategory, string> = {
  Cast: '#f4b6c2',
  Extras: '#d7bde2',
  Props: '#f5d76e',
  Wardrobe: '#82e0aa',
  Makeup: '#f7c6a3',
  Animals: '#a9dfbf',
  VFX: '#85c1e9',
  SFX: '#f1948a',
  Vehicles: '#aed6f1',
  Stunts: '#f8c471',
  Locations: '#a3e4d7',
  Music: '#d2b4de',
  'Set Dressing': '#fad7a0',
  Custom: '#d5d8dc',
}

export interface TagSelectionInput {
  blockId: string
  start: number
  end: number
  category: DepartmentTagCategory
  label?: string
}

export interface AutoTagSuggestion {
  blockId: string
  sceneId: string | null
  category: DepartmentTagCategory
  text: string
  start: number
  end: number
  color: string
}

export interface BreakdownSheetItem extends TagCatalogItem {
  occurrences: TaggedScriptRange[]
}

export interface BreakdownSheet {
  sceneId: string | null
  sceneHeading: string
  categories: Partial<Record<DepartmentTagCategory, BreakdownSheetItem[]>>
}

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

const normalizeName = (value: string): string => value.trim().replace(/\s+/g, ' ')

const sceneIdForBlock = (project: ScriptProject, blockId: string): string | null => {
  let activeSceneId: string | null = null

  for (const block of project.blocks) {
    if (block.type === 'scene-heading') {
      activeSceneId = block.id
    }

    if (block.id === blockId) {
      return activeSceneId
    }
  }

  return null
}

const sceneHeadingById = (project: ScriptProject): Map<string, string> =>
  new Map(extractScenes(project).map((scene) => [scene.blockId, scene.heading]))

export const ensureTaggingState = (project: ScriptProject): ScriptProject => {
  const next = cloneProject(project)
  next.tagging = structuredClone(resolveTagging(project))
  return next
}

const resolvedCache = new WeakMap<ScriptProject, TaggingState>()
/** Automatic rows are derived; only corrections/rejections have authority across runs. */
export const resolveTagging = (project: ScriptProject): TaggingState => {
  const cached = resolvedCache.get(project)
  if (cached) return cached
  const stored = project.tagging ?? { tags: [], catalog: [] }
  const catalog = stored.catalog.filter(item => item.source !== 'automatic').map(item => ({ ...item }))
  const tags = stored.tags.filter(tag => tag.source !== 'automatic').map(tag => ({ ...tag, sceneId: sceneIdForBlock(project, tag.blockId) }))
  const rejectedItems = new Set(stored.rejectedItems ?? [])
  const rejectedOccurrences = new Set(stored.rejectedOccurrences ?? [])
  const catalogByKey = new Map(catalog.map(item => [item.inferenceKey ?? inferenceItemKey(item.category, item.name), item]))
  const tagsByBlock = new Map<string, TaggedScriptRange[]>()
  for (const tag of tags) tagsByBlock.set(tag.blockId, [...(tagsByBlock.get(tag.blockId) ?? []), tag])
  for (const occurrence of analyzeProjectScenes(project).flatMap(scene => scene.occurrences)) {
    if (rejectedItems.has(occurrence.itemKey) || rejectedOccurrences.has(occurrence.key)) continue
    // Existing range tags, including a different user-selected category, win at that range.
    if ((tagsByBlock.get(occurrence.blockId) ?? []).some(tag =>
      ((tag.start < occurrence.end && tag.end > occurrence.start) || tag.inferenceKey === occurrence.key))) continue
    let item = catalogByKey.get(occurrence.itemKey)
    if (!item) {
      item = { id: `auto:${occurrence.itemKey}`, category: occurrence.category, name: occurrence.name, cost: 0, notes: '', imageDataUrl: '', source: 'automatic', inferenceKey: occurrence.itemKey }
      catalog.push(item)
      catalogByKey.set(occurrence.itemKey, item)
    }
    const tag: TaggedScriptRange = { id: `auto:${occurrence.key}`, blockId: occurrence.blockId, sceneId: occurrence.sceneId, category: item.category, text: occurrence.name,
      start: occurrence.start, end: occurrence.end, color: departmentTagColors[item.category], catalogItemId: item.id, source: 'automatic', inferenceKey: occurrence.key,
      confidence: occurrence.confidence, evidence: occurrence.evidence, quantity: occurrence.quantity }
    tags.push(tag)
    tagsByBlock.set(tag.blockId, [...(tagsByBlock.get(tag.blockId) ?? []), tag])
  }
  const result = { ...stored, catalog, tags }
  resolvedCache.set(project, result)
  return result
}

export const removeTagCatalogItem = (project: ScriptProject, itemId: string): ScriptProject => {
  const next = ensureTaggingState(project)
  const item = next.tagging.catalog.find(item => item.id === itemId)
  if (!item) return next
  const removed = next.tagging.tags.filter(tag => tag.catalogItemId === itemId)
  const suppressed = analyzeProjectScenes(project).flatMap(scene => scene.occurrences).filter(occurrence => removed.some(tag => tag.blockId === occurrence.blockId && tag.start < occurrence.end && tag.end > occurrence.start)).map(occurrence => occurrence.key)
  next.tagging.rejectedOccurrences = [...new Set([...(next.tagging.rejectedOccurrences ?? []), ...suppressed])]
  next.tagging.rejectedItems = [...new Set([...(next.tagging.rejectedItems ?? []), item.inferenceKey ?? inferenceItemKey(item.category, item.name)])]
  next.tagging.tags = next.tagging.tags.filter(tag => tag.catalogItemId !== itemId)
  next.tagging.catalog = next.tagging.catalog.filter(item => item.id !== itemId)
  return next
}

export const removeTagOccurrence = (project: ScriptProject, tagId: string): ScriptProject => {
  const next = ensureTaggingState(project)
  const tag = next.tagging.tags.find(tag => tag.id === tagId)
  if (tag) {
    const keys = analyzeProjectScenes(project).flatMap(scene => scene.occurrences).filter(occurrence => occurrence.blockId === tag.blockId && tag.start < occurrence.end && tag.end > occurrence.start).map(occurrence => occurrence.key)
    next.tagging.rejectedOccurrences = [...new Set([...(next.tagging.rejectedOccurrences ?? []), ...keys, ...(tag.inferenceKey ? [tag.inferenceKey] : [])])]
  }
  next.tagging.tags = next.tagging.tags.filter(tag => tag.id !== tagId)
  return next
}

export const addCatalogOccurrence = (project: ScriptProject, itemId: string, sceneId: string): ScriptProject => {
  const next = ensureTaggingState(project)
  const item = next.tagging.catalog.find(item => item.id === itemId)
  if (!item || !next.blocks.some(block => block.id === sceneId && block.type === 'scene-heading')) return project
  item.source = item.source === 'automatic' ? 'confirmed' : item.source
  next.tagging.tags.push({ id: createId(), blockId: sceneId, sceneId, category: item.category, text: item.name, start: 0, end: 0, color: departmentTagColors[item.category], catalogItemId: itemId, source: 'manual' })
  return next
}

export const createCatalogItem = (project: ScriptProject, category: DepartmentTagCategory, name: string, sceneId: string | null): ScriptProject => {
  const next = ensureTaggingState(project)
  const item = { id: createId(), category, name: name.trim(), cost: 0, notes: '', imageDataUrl: '', source: 'manual' as const }
  if (!item.name) return project
  next.tagging.catalog.push(item)
  return sceneId ? addCatalogOccurrence(next, item.id, sceneId) : next
}

export const restoreAutomaticBreakdown = (project: ScriptProject): ScriptProject => {
  const next = cloneProject(project)
  next.tagging.rejectedItems = []
  next.tagging.rejectedOccurrences = []
  return next
}

const findCatalogItem = (
  catalog: TagCatalogItem[],
  category: DepartmentTagCategory,
  name: string,
): TagCatalogItem | undefined =>
  catalog.find(
    (item) =>
      item.category === category &&
      item.name.trim().toLowerCase() === name.trim().toLowerCase(),
  )

export const tagScriptSelection = (
  project: ScriptProject,
  input: TagSelectionInput,
): ScriptProject => {
  const next = cloneProject(project)
  next.tagging = { ...next.tagging, tags: next.tagging?.tags ?? [], catalog: next.tagging?.catalog ?? [] }
  const block = next.blocks.find((candidate) => candidate.id === input.blockId)
  if (!block) {
    return next
  }

  const start = Math.max(0, Math.min(input.start, block.text.length))
  const end = Math.max(start, Math.min(input.end, block.text.length))
  const selectedText = normalizeName(input.label ?? block.text.slice(start, end))
  if (!selectedText) {
    return next
  }

  let catalogItem = findCatalogItem(next.tagging.catalog, input.category, selectedText)
  if (!catalogItem) {
    catalogItem = {
      id: createId(),
      category: input.category,
      name: selectedText,
      cost: 0,
      notes: '',
      imageDataUrl: '',
    }
    next.tagging.catalog.push(catalogItem)
  }

  next.tagging.tags.push({
    id: createId(),
    blockId: input.blockId,
    sceneId: sceneIdForBlock(next, input.blockId),
    category: input.category,
    text: selectedText,
    start,
    end,
    color: departmentTagColors[input.category],
    catalogItemId: catalogItem.id,
  })

  return next
}

export const buildTagCatalog = (
  project: ScriptProject,
): Partial<Record<DepartmentTagCategory, TagCatalogItem[]>> => {
  const hydrated = ensureTaggingState(project)
  const grouped: Partial<Record<DepartmentTagCategory, TagCatalogItem[]>> = {}

  for (const item of hydrated.tagging.catalog) {
    grouped[item.category] = grouped[item.category] ?? []
    grouped[item.category]?.push(item)
  }

  for (const category of departmentTagCategories) {
    grouped[category]?.sort((left, right) => left.name.localeCompare(right.name))
  }

  return grouped
}

export const updateTagCatalogItem = (
  project: ScriptProject,
  itemId: string,
  updates: Partial<Pick<TagCatalogItem, 'cost' | 'notes' | 'imageDataUrl' | 'name' | 'category' | 'source'>>,
): ScriptProject => {
  const next = ensureTaggingState(project)
  const item = next.tagging.catalog.find((candidate) => candidate.id === itemId)
  if (!item) {
    return next
  }

  Object.assign(item, updates)
  item.source = updates.source ?? 'edited'
  for (const tag of next.tagging.tags) {
    if (tag.catalogItemId === itemId) {
      tag.category = item.category
      tag.color = departmentTagColors[item.category]
    }
  }
  if (typeof item.cost !== 'number' || Number.isNaN(item.cost)) {
    item.cost = 0
  }

  return next
}

export const buildBreakdownSheet = (
  project: ScriptProject,
  sceneId: string | null,
): BreakdownSheet => {
  const hydrated = ensureTaggingState(project)
  const headings = sceneHeadingById(hydrated)
  const categories: Partial<Record<DepartmentTagCategory, BreakdownSheetItem[]>> = {}
  const relevantTags = hydrated.tagging.tags.filter((tag) => tag.sceneId === sceneId)

  for (const tag of relevantTags) {
    const catalogItem = hydrated.tagging.catalog.find((item) => item.id === tag.catalogItemId)
    if (!catalogItem) {
      continue
    }

    categories[tag.category] = categories[tag.category] ?? []
    let sheetItem = categories[tag.category]?.find((item) => item.id === catalogItem.id)
    if (!sheetItem) {
      sheetItem = { ...catalogItem, occurrences: [] }
      categories[tag.category]?.push(sheetItem)
    }
    sheetItem.occurrences.push(tag)
  }

  if (sceneId === null) {
    const assigned = new Set(hydrated.tagging.tags.map(tag => tag.catalogItemId))
    for (const item of hydrated.tagging.catalog.filter(item => !assigned.has(item.id))) {
      categories[item.category] ??= []
      categories[item.category]!.push({ ...item, occurrences: [] })
    }
  }

  return {
    sceneId,
    sceneHeading: sceneId ? headings.get(sceneId) ?? 'Unassigned Scene' : 'Unassigned Scene',
    categories,
  }
}

const csvCell = (value: string | number | null | undefined): string => {
  const text = String(value ?? '')
  if (!/[",\n]/.test(text)) {
    return text
  }

  return `"${text.replace(/"/g, '""')}"`
}

export const buildBreakdownCsv = (
  project: ScriptProject,
  sceneId?: string | null,
): string => {
  const hydrated = ensureTaggingState(project)
  const headings = sceneHeadingById(hydrated)
  const rows = hydrated.tagging.tags
    .filter((tag) => (sceneId === undefined ? true : tag.sceneId === sceneId))
    .map((tag) => {
      const item = hydrated.tagging.catalog.find(
        (candidate) => candidate.id === tag.catalogItemId,
      )
      return [
        tag.category,
        item?.name ?? tag.text,
        tag.sceneId ? headings.get(tag.sceneId) ?? 'Unassigned Scene' : 'Unassigned Scene',
        tag.text,
        item?.cost ?? 0,
        item?.notes ?? '',
      ]
    })

  return [
    ['Category', 'Item', 'Scene', 'Text', 'Cost', 'Notes'],
    ...rows,
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\n')
}

export const autoTagScript = (project: ScriptProject): AutoTagSuggestion[] =>
  resolveTagging(project).tags.filter(tag => tag.source === 'automatic').map(tag => ({
    blockId: tag.blockId, sceneId: tag.sceneId, category: tag.category, text: tag.text,
    start: tag.start, end: tag.end, color: tag.color,
  }))
