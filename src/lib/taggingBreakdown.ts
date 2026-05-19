import type {
  DepartmentTagCategory,
  ScriptProject,
  TagCatalogItem,
  TaggedScriptRange,
} from '../types/screenplay'
import { cloneProject, extractScenes } from './screenplay'

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
  next.tagging = {
    tags: next.tagging?.tags ?? [],
    catalog: next.tagging?.catalog ?? [],
  }
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
  const next = ensureTaggingState(project)
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
  updates: Partial<Pick<TagCatalogItem, 'cost' | 'notes' | 'imageDataUrl' | 'name'>>,
): ScriptProject => {
  const next = ensureTaggingState(project)
  const item = next.tagging.catalog.find((candidate) => candidate.id === itemId)
  if (!item) {
    return next
  }

  Object.assign(item, updates)
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

const autoTagRules: Array<{
  category: DepartmentTagCategory
  pattern: RegExp
}> = [
  { category: 'Animals', pattern: /\b(dog|cat|horse|bird|snake)\b/gi },
  { category: 'Vehicles', pattern: /\b(police car|taxi|truck|van|motorcycle|car)\b/gi },
  { category: 'Props', pattern: /\b(revolver|gun|knife|letter|phone|key|watch)\b/gi },
  { category: 'Wardrobe', pattern: /\b(coat|dress|uniform|hat|boots)\b/gi },
  { category: 'Makeup', pattern: /\b(blood|scar|bruise|tattoo)\b/gi },
  { category: 'VFX', pattern: /\b(hologram|portal|spaceship|creature)\b/gi },
  { category: 'SFX', pattern: /\b(explosion|gunshot|crash|fire|smoke)\b/gi },
  { category: 'Stunts', pattern: /\b(fight|fall|jump|chase|tackle)\b/gi },
  { category: 'Music', pattern: /\b(song|music|radio|guitar|piano)\b/gi },
  { category: 'Set Dressing', pattern: /\b(neon sign|poster|lamp|table|sofa)\b/gi },
]

export const autoTagScript = (project: ScriptProject): AutoTagSuggestion[] => {
  const suggestions: AutoTagSuggestion[] = []
  const seen = new Set<string>()

  for (const block of project.blocks) {
    if (!['action', 'scene-heading', 'dialogue'].includes(block.type)) {
      continue
    }

    for (const rule of autoTagRules) {
      const regex = new RegExp(rule.pattern)
      let match = regex.exec(block.text)
      while (match) {
        const text = normalizeName(match[0] ?? '')
        const signature = `${block.id}:${rule.category}:${match.index}:${text.toLowerCase()}`
        if (text && !seen.has(signature)) {
          seen.add(signature)
          suggestions.push({
            blockId: block.id,
            sceneId: sceneIdForBlock(project, block.id),
            category: rule.category,
            text,
            start: match.index,
            end: match.index + text.length,
            color: departmentTagColors[rule.category],
          })
        }

        match = regex.exec(block.text)
      }
    }
  }

  return suggestions
}
