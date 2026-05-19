import type {
  DepartmentTagCategory,
  ScriptBlock,
  ScriptProject,
} from '../types/screenplay'
import { extractScenes, getScriptStats } from './screenplay'
import { parseSceneHeadingParts } from './sceneHeading'

export interface SceneReportRow {
  sceneNumber: number
  sceneId: string
  heading: string
  intExt: string
  dayNight: string
  castPresent: string[]
  pageCount: number
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

const wordsPerPage = 250

const countWords = (text: string): number =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

const sceneParts = (heading: string) => {
  const parts = parseSceneHeadingParts(heading)
  return {
    intExt: parts.intExt,
    dayNight: parts.dayNight,
    location: parts.location,
  }
}

const sceneRanges = (project: ScriptProject) => {
  const scenes = extractScenes(project)
  return scenes.map((scene, index) => {
    const nextScene = scenes[index + 1]
    const startIndex = scene.index
    const endIndex = nextScene?.index ?? project.blocks.length
    return {
      ...scene,
      sceneNumber: index + 1,
      blocks: project.blocks.slice(startIndex, endIndex),
    }
  })
}

const pageCountForBlocks = (blocks: ScriptBlock[]): number => {
  const words = blocks.reduce((sum, block) => sum + countWords(block.text), 0)
  return Math.max(1, Math.ceil(words / wordsPerPage))
}

const castForBlocks = (blocks: ScriptBlock[]): string[] =>
  [...new Set(
    blocks
      .filter((block) => block.type === 'character')
      .map((block) => block.text.trim().replace(/\(.+\)/, '').trim().toUpperCase())
      .filter(Boolean),
  )].sort((left, right) => left.localeCompare(right))

const percent = (value: number, total: number): number =>
  total <= 0 ? 0 : Number(((value / total) * 100).toFixed(2))

export const buildSceneReport = (project: ScriptProject): SceneReportRow[] =>
  sceneRanges(project).map((scene) => {
    const parts = sceneParts(scene.heading)
    return {
      sceneNumber: scene.sceneNumber,
      sceneId: scene.blockId,
      heading: scene.heading,
      intExt: parts.intExt,
      dayNight: parts.dayNight,
      castPresent: castForBlocks(scene.blocks),
      pageCount: pageCountForBlocks(scene.blocks),
    }
  })

export const buildCharacterReport = (project: ScriptProject): CharacterReportRow[] => {
  const scenes = sceneRanges(project)
  const totalPages = scenes.reduce((sum, scene) => sum + pageCountForBlocks(scene.blocks), 0)
  const stats = new Map<string, { scenes: Set<string>; pages: number }>()

  for (const scene of scenes) {
    const scenePages = pageCountForBlocks(scene.blocks)
    for (const character of castForBlocks(scene.blocks)) {
      const entry = stats.get(character) ?? { scenes: new Set<string>(), pages: 0 }
      if (!entry.scenes.has(scene.heading)) {
        entry.pages += scenePages
      }
      entry.scenes.add(scene.heading)
      stats.set(character, entry)
    }
  }

  return [...stats.entries()]
    .map(([character, entry]) => ({
      character,
      scenes: [...entry.scenes],
      sceneCount: entry.scenes.size,
      totalPages: entry.pages,
      screenTimePercent: percent(entry.pages, totalPages),
    }))
    .sort((left, right) => left.character.localeCompare(right.character))
}

export const buildLocationReport = (project: ScriptProject): LocationReportRow[] => {
  const grouped = new Map<string, LocationReportRow>()

  for (const scene of buildSceneReport(project)) {
    const parts = sceneParts(scene.heading)
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

  for (const item of project.tagging.catalog.filter((entry) => entry.category === category)) {
    const tags = project.tagging.tags.filter((tag) => tag.catalogItemId === item.id)
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
    })
  }

  return [...grouped.values()].sort((left, right) => left.item.localeCompare(right.item))
}

export const buildDialogueReport = (project: ScriptProject): DialogueReportRow[] => {
  const stats = new Map<string, { lines: number; words: number }>()
  let activeCharacter: string | null = null

  for (const block of project.blocks) {
    if (block.type === 'character') {
      activeCharacter = block.text.trim().replace(/\(.+\)/, '').trim().toUpperCase() || null
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
    taggedItems: project.tagging.tags.length,
  }
}

const chartRowsFromCounts = (counts: Map<string, number>): ChartDatum[] =>
  [...counts.entries()]
    .map(([label, value]) => ({ label, value }))

export const buildAnalyticsDashboard = (project: ScriptProject): AnalyticsDashboard => {
  const intExtCounts = new Map<string, number>()
  const dayNightCounts = new Map<string, number>()

  const sceneLengthHistogram = sceneRanges(project).map((scene) => {
    const parts = sceneParts(scene.heading)
    if (parts.intExt) {
      intExtCounts.set(parts.intExt, (intExtCounts.get(parts.intExt) ?? 0) + 1)
    }
    if (parts.dayNight) {
      dayNightCounts.set(parts.dayNight, (dayNightCounts.get(parts.dayNight) ?? 0) + 1)
    }

    const words = scene.blocks.reduce((sum, block) => sum + countWords(block.text), 0)
    return {
      sceneNumber: scene.sceneNumber,
      heading: scene.heading,
      words,
      pages: Math.max(1, Math.ceil(words / wordsPerPage)),
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
