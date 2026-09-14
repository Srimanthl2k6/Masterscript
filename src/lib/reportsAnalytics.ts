import type {
  DepartmentTagCategory,
  ScriptProject,
} from '../types/screenplay'
import { extractScenes, getScriptStats, normalizeCharacterName } from './screenplay'
import { analyzeProjectScenes } from './sceneAnalysis'
import { resolveTagging } from './taggingBreakdown'
import { characterAliasIndex } from './characterNormalization'

export interface SceneReportRow {
  sceneNumber: number
  sceneId: string
  heading: string
  intExt: string
  dayNight: string
  castPresent: string[]
  pageCount: number
  sceneLabel: string
  location: string
  nonSpeakingCast: string[]
  requirements: Partial<Record<DepartmentTagCategory, string[]>>
}

export interface CharacterReportRow {
  character: string
  scenes: string[]
  sceneCount: number
  totalPages: number
  screenTimePercent: number
}

export interface LocationReportRow {
  location: string
  intExt: string
  dayNight: string
  scenes: string[]
  totalPages: number
}

export interface DepartmentReportRow {
  category: DepartmentTagCategory
  item: string
  scenes: string[]
  cost: number
  notes: string
  occurrences: number
  source: string
}

export interface DialogueReportRow {
  character: string
  lines: number
  words: number
  percent: number
}

export interface PageSceneSummary {
  sceneCount: number
  estimatedPages: number
  dialogueLines: number
  wordCount: number
  taggedItems: number
}

export interface ChartDatum {
  label: string
  value: number
}

export interface SceneLengthDatum {
  sceneNumber: number
  heading: string
  words: number
  pages: number
}

export interface AnalyticsDashboard {
  intExt: ChartDatum[]
  dayNight: ChartDatum[]
  dialogueVsAction: {
    dialogueWords: number
    actionWords: number
    dialoguePercent: number
    actionPercent: number
  }
  sceneLengthHistogram: SceneLengthDatum[]
}

const countWords = (text: string): number =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

const percent = (value: number, total: number): number =>
  total <= 0 ? 0 : Number(((value / total) * 100).toFixed(2))

const sceneReportCache = new WeakMap<ScriptProject, SceneReportRow[]>()
export const buildSceneReport = (project: ScriptProject): SceneReportRow[] => {
  const cached = sceneReportCache.get(project)
  if (cached) return cached
  const tagging = resolveTagging(project)
  const catalog = new Map(tagging.catalog.map(item => [item.id, item]))
  const result = analyzeProjectScenes(project).map((scene) => {
    const requirements: Partial<Record<DepartmentTagCategory, string[]>> = {}
    for (const tag of tagging.tags.filter(tag => tag.sceneId === scene.sceneId)) {
      const item = catalog.get(tag.catalogItemId)
      if (!item) continue
      const label = tag.quantity ? `${item.name} (approx. ${tag.quantity})` : item.name
      requirements[item.category] = [...new Set([...(requirements[item.category] ?? []), label])].sort()
    }
    const castPresent = (requirements.Cast ?? []).map(normalizeCharacterName).sort()
    return {
      sceneNumber: scene.sceneNumber,
      sceneLabel: scene.sceneLabel,
      sceneId: scene.sceneId,
      heading: scene.heading,
      location: scene.location,
      intExt: scene.intExt,
      dayNight: scene.dayNight,
      castPresent,
      nonSpeakingCast: castPresent.filter(name => !scene.speakingCast.includes(name)),
      pageCount: scene.pageCount,
      requirements,
    }
  })
  sceneReportCache.set(project, result)
  return result
}

export const buildCharacterReport = (project: ScriptProject): CharacterReportRow[] => {
  const scenes = buildSceneReport(project)
  const totalPages = scenes.reduce((sum, scene) => sum + scene.pageCount, 0)
  const stats = new Map<string, { scenes: Set<string>; pages: number }>()

  for (const scene of scenes) {
    const scenePages = scene.pageCount
    for (const character of scene.castPresent) {
      const entry = stats.get(character) ?? { scenes: new Set<string>(), pages: 0 }
      if (!entry.scenes.has(scene.sceneId)) {
        entry.pages += scenePages
      }
      entry.scenes.add(scene.sceneId)
      stats.set(character, entry)
    }
  }

  return [...stats.entries()]
    .map(([character, entry]) => ({
      character,
      scenes: [...entry.scenes].map(id => { const scene = scenes.find(scene => scene.sceneId === id)!; return `${scene.sceneLabel}. ${scene.heading}` }),
      sceneCount: entry.scenes.size,
      totalPages: entry.pages,
      screenTimePercent: percent(entry.pages, totalPages),
    }))
    .sort((left, right) => left.character.localeCompare(right.character))
}

export const buildLocationReport = (project: ScriptProject): LocationReportRow[] => {
  const grouped = new Map<string, LocationReportRow>()

  for (const scene of buildSceneReport(project)) {
    const parts = scene
    const key = `${parts.location}|${parts.intExt}|${parts.dayNight}`
    const entry =
      grouped.get(key) ??
      ({
        location: parts.location,
        intExt: parts.intExt,
        dayNight: parts.dayNight,
        scenes: [],
        totalPages: 0,
      } satisfies LocationReportRow)

    entry.scenes.push(scene.heading)
    entry.totalPages += scene.pageCount
    grouped.set(key, entry)
  }

  return [...grouped.values()]
}

export const buildDepartmentReport = (
  project: ScriptProject,
  category: DepartmentTagCategory,
): DepartmentReportRow[] => {
  const headings = new Map(extractScenes(project).map((scene) => [scene.blockId, scene.heading]))
  const grouped = new Map<string, DepartmentReportRow>()

  const tagging = resolveTagging(project)
  for (const item of tagging.catalog.filter((entry) => entry.category === category)) {
    const tags = tagging.tags.filter((tag) => tag.catalogItemId === item.id)
    grouped.set(item.id, {
      category,
      item: item.name,
      scenes: [
        ...new Set(
          tags.map((tag) =>
            tag.sceneId ? headings.get(tag.sceneId) ?? 'Unassigned Scene' : 'Unassigned Scene',
          ),
        ),
      ],
      cost: item.cost,
      notes: item.notes,
      occurrences: tags.length,
      source: item.source ?? 'manual',
    })
  }

  return [...grouped.values()].sort((left, right) => left.item.localeCompare(right.item))
}

export const buildDialogueReport = (project: ScriptProject): DialogueReportRow[] => {
  const stats = new Map<string, { lines: number; words: number }>()
  const aliases = characterAliasIndex(project)
  let activeCharacter: string | null = null

  let omittedScene = false
  for (const block of project.blocks) {
    if (block.type === 'scene-heading') omittedScene = Boolean(block.omitted)
    if (omittedScene || block.omitted) { activeCharacter = null; continue }
    if (block.type === 'character') {
      const name = normalizeCharacterName(block.text)
      activeCharacter = aliases.get(name) ?? (name || null)
      if (activeCharacter && !stats.has(activeCharacter)) {
        stats.set(activeCharacter, { lines: 0, words: 0 })
      }
      continue
    }

    if (block.type === 'dialogue' && activeCharacter) {
      const entry = stats.get(activeCharacter) ?? { lines: 0, words: 0 }
      entry.lines += 1
      entry.words += countWords(block.text)
      stats.set(activeCharacter, entry)
    }
    if (!['character', 'dialogue', 'parenthetical'].includes(block.type)) activeCharacter = null
  }

  const totalWords = [...stats.values()].reduce((sum, entry) => sum + entry.words, 0)
  return [...stats.entries()]
    .map(([character, entry]) => ({
      character,
      lines: entry.lines,
      words: entry.words,
      percent: percent(entry.words, totalWords),
    }))
    .sort((left, right) => right.words - left.words || left.character.localeCompare(right.character))
}

export const buildPageSceneSummary = (project: ScriptProject): PageSceneSummary => {
  const stats = getScriptStats(project)
  return {
    sceneCount: stats.sceneCount,
    estimatedPages: stats.estimatedPages,
    dialogueLines: stats.dialogueLines,
    wordCount: stats.wordCount,
    taggedItems: resolveTagging(project).tags.length,
  }
}

const chartRowsFromCounts = (counts: Map<string, number>): ChartDatum[] =>
  [...counts.entries()]
    .map(([label, value]) => ({ label, value }))

export const buildAnalyticsDashboard = (project: ScriptProject): AnalyticsDashboard => {
  const intExtCounts = new Map<string, number>()
  const dayNightCounts = new Map<string, number>()

  const sceneLengthHistogram = analyzeProjectScenes(project).filter(scene => scene.pageCount > 0).map((scene) => {
    const parts = scene
    if (parts.intExt) {
      intExtCounts.set(parts.intExt, (intExtCounts.get(parts.intExt) ?? 0) + 1)
    }
    if (parts.dayNight) {
      dayNightCounts.set(parts.dayNight, (dayNightCounts.get(parts.dayNight) ?? 0) + 1)
    }

    const words = scene.words
    return {
      sceneNumber: scene.sceneNumber,
      heading: scene.heading,
      words,
      pages: scene.pageCount,
    }
  })

  const dialogueWords = project.blocks
    .filter((block) => block.type === 'dialogue')
    .reduce((sum, block) => sum + countWords(block.text), 0)
  const actionWords = project.blocks
    .filter((block) => block.type === 'action')
    .reduce((sum, block) => sum + countWords(block.text), 0)
  const total = dialogueWords + actionWords

  return {
    intExt: chartRowsFromCounts(intExtCounts),
    dayNight: chartRowsFromCounts(dayNightCounts),
    dialogueVsAction: {
      dialogueWords,
      actionWords,
      dialoguePercent: percent(dialogueWords, total),
      actionPercent: percent(actionWords, total),
    },
    sceneLengthHistogram,
  }
}

const csvCell = (value: string | number | string[] | null | undefined): string => {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '')
  if (!/[",\n]/.test(text)) {
    return text
  }

  return `"${text.replace(/"/g, '""')}"`
}

export const buildReportCsv = (
  headers: Array<string | number>,
  rows: Array<Array<string | number | string[]>>,
): string => [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
