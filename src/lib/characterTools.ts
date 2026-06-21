import type {
  CharacterArcStage,
  CharacterProfile,
  CharacterToolsState,
  ScriptProject,
} from '../types/screenplay'
import { paginateProjectForPrint } from './adapters/pagination'
import { renameCharacterAcrossProject } from './formattingEngine'
import {
  cloneProject,
  collectCharacterSuggestions,
  extractScenes,
  normalizeCharacterName,
} from './screenplay'

export interface CharacterStats {
  character: string
  sceneCount: number
  dialogueLines: number
  dialogueWords: number
  pageCount: number
  screenTimePercent: number
}

export interface DialogueDistributionEntry {
  character: string
  words: number
  percent: number
}

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

const normalizeName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toUpperCase()

const defaultCharacterState = (): CharacterToolsState => ({
  profiles: {},
  relationships: [],
  arcs: {},
})

const defaultProfile = (name: string): CharacterProfile => ({
  name: normalizeName(name),
  bio: '',
  notes: '',
  imageDataUrl: '',
  customFields: [],
})

export const ensureCharacterToolsState = (project: ScriptProject): ScriptProject => {
  const next = cloneProject(project)
  next.characters = {
    ...defaultCharacterState(),
    ...next.characters,
    profiles: next.characters?.profiles ?? {},
    relationships: next.characters?.relationships ?? [],
    arcs: next.characters?.arcs ?? {},
  }

  return next
}

export const upsertCharacterProfile = (
  project: ScriptProject,
  name: string,
  updates: Partial<Omit<CharacterProfile, 'name'>>,
): ScriptProject => {
  const next = ensureCharacterToolsState(project)
  const key = normalizeName(name)

  next.characters!.profiles[key] = {
    ...defaultProfile(key),
    ...next.characters!.profiles[key],
    ...updates,
    name: key,
  }

  return next
}

const wordsIn = (value: string): number =>
  value.trim().split(/\s+/).filter(Boolean).length

export const buildCharacterStats = (
  project: ScriptProject,
): Record<string, CharacterStats> => {
  const scenes = extractScenes(project)
  const sceneIds = new Set(scenes.map((scene) => scene.blockId))
  const layout = paginateProjectForPrint(project)
  const stats: Record<string, CharacterStats> = {}
  let activeSceneId: string | null = null
  let activeCharacter: string | null = null

  const ensure = (name: string): CharacterStats => {
    const key = normalizeName(name)
    if (!stats[key]) {
      stats[key] = {
        character: key,
        sceneCount: 0,
        dialogueLines: 0,
        dialogueWords: 0,
        pageCount: 0,
        screenTimePercent: 0,
      }
    }

    return stats[key]
  }

  const scenesByCharacter = new Map<string, Set<string>>()

  for (const block of project.blocks) {
    if (block.type === 'scene-heading') {
      activeSceneId = block.id
      activeCharacter = null
      continue
    }

    if (block.type === 'character') {
      activeCharacter = normalizeCharacterName(block.text)
      ensure(activeCharacter)
      if (!scenesByCharacter.has(activeCharacter)) {
        scenesByCharacter.set(activeCharacter, new Set())
      }
      if (activeSceneId && sceneIds.has(activeSceneId)) {
        scenesByCharacter.get(activeCharacter)?.add(activeSceneId)
      }
      continue
    }

    if (block.type === 'dialogue' && activeCharacter) {
      const entry = ensure(activeCharacter)
      entry.dialogueLines += 1
      entry.dialogueWords += wordsIn(block.text)
    }
  }

  for (const [name, sceneSet] of scenesByCharacter) {
    stats[name].sceneCount = sceneSet.size
  }

  const pageByBlock = new Map(
    layout.pages
      .flatMap((page) => page.lines.map((line) => [line.blockId, page.scriptPageNumber] as const))
      .filter(([blockId, pageNumber]) => blockId && pageNumber !== null),
  )

  for (const name of Object.keys(stats)) {
    const pages = new Set<number>()
    for (const block of project.blocks) {
      if (block.type === 'character' && normalizeCharacterName(block.text) === name) {
        const pageNumber = pageByBlock.get(block.id)
        if (pageNumber) {
          pages.add(pageNumber)
        }
      }
    }
    stats[name].pageCount = pages.size
  }

  const totalSceneAppearances =
    Object.values(stats).reduce((sum, entry) => sum + entry.sceneCount, 0) || 1

  for (const entry of Object.values(stats)) {
    entry.screenTimePercent = Number(
      ((entry.sceneCount / totalSceneAppearances) * 100).toFixed(2),
    )
  }

  return stats
}

export const buildDialogueDistribution = (
  project: ScriptProject,
): DialogueDistributionEntry[] => {
  const stats = buildCharacterStats(project)
  const totalWords = Object.values(stats).reduce(
    (sum, entry) => sum + entry.dialogueWords,
    0,
  )

  if (totalWords === 0) {
    return []
  }

  return Object.values(stats)
    .map((entry) => ({
      character: entry.character,
      words: entry.dialogueWords,
      percent: Number(((entry.dialogueWords / totalWords) * 100).toFixed(2)),
    }))
    .sort((left, right) => right.words - left.words)
}

export const addCharacterRelationship = (
  project: ScriptProject,
  from: string,
  to: string,
  label: string,
): ScriptProject => {
  const next = ensureCharacterToolsState(project)
  next.characters!.relationships.push({
    id: createId(),
    from: normalizeName(from),
    to: normalizeName(to),
    label,
  })
  return next
}

export const removeCharacterRelationship = (
  project: ScriptProject,
  relationshipId: string,
): ScriptProject => {
  const next = ensureCharacterToolsState(project)
  next.characters!.relationships = next.characters!.relationships.filter(
    (relationship) => relationship.id !== relationshipId,
  )
  return next
}

export const setCharacterArcStage = (
  project: ScriptProject,
  character: string,
  sceneId: string,
  stage: CharacterArcStage,
): ScriptProject => {
  const next = ensureCharacterToolsState(project)
  const key = normalizeName(character)
  next.characters!.arcs[key] = {
    ...next.characters!.arcs[key],
    [sceneId]: stage,
  }
  return next
}

export const renameCharacterEverywhere = (
  project: ScriptProject,
  from: string,
  to: string,
): ScriptProject => {
  const renamed = ensureCharacterToolsState(renameCharacterAcrossProject(project, from, to))
  const source = normalizeName(from)
  const target = normalizeName(to)
  const profile = renamed.characters!.profiles[source]

  if (profile) {
    renamed.characters!.profiles[target] = {
      ...profile,
      name: target,
    }
    delete renamed.characters!.profiles[source]
  }

  const arc = renamed.characters!.arcs[source]
  if (arc) {
    renamed.characters!.arcs[target] = arc
    delete renamed.characters!.arcs[source]
  }

  renamed.characters!.relationships = renamed.characters!.relationships.map((edge) => ({
    ...edge,
    from: edge.from === source ? target : edge.from,
    to: edge.to === source ? target : edge.to,
  }))

  return renamed
}

export const ensureProfilesFromScript = (project: ScriptProject): ScriptProject => {
  let next = ensureCharacterToolsState(project)
  for (const character of collectCharacterSuggestions(next)) {
    if (!next.characters!.profiles[character]) {
      next = upsertCharacterProfile(next, character, {})
    }
  }
  return next
}
