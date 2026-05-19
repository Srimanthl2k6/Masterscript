import type {
  BlockType,
  CatalogEntry,
  ScriptExtension,
  ScriptProject,
} from '../types/screenplay'
import {
  cloneProject,
  collectCharacterSuggestions,
  detectCatalogEntries,
} from './screenplay'

export const standardScriptExtensions: ScriptExtension[] = [
  'V.O.',
  'O.S.',
  "CONT'D",
  'PRE-LAP',
  'FILTERED',
]

export const standardTimesOfDay = [
  'DAY',
  'NIGHT',
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'DAWN',
  'DUSK',
  'LATER',
  'CONTINUOUS',
]

export const standardTransitions = [
  'CUT TO:',
  'SMASH CUT TO:',
  'MATCH CUT TO:',
  'DISSOLVE TO:',
  'FADE OUT:',
  'FADE TO BLACK:',
  'BACK TO:',
]

export const standardShots = [
  'CLOSE ON:',
  'WIDE SHOT:',
  'ANGLE ON:',
  'POV:',
  'INSERT:',
  'ESTABLISHING SHOT:',
  'TRACKING SHOT:',
]

export interface SmartTypeOptions {
  characters: string[]
  locations: string[]
  timesOfDay: string[]
  transitions: string[]
  shots: string[]
  extensions: ScriptExtension[]
}

const normalizeCue = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()

const normalizeLocation = (value: string): string =>
  value
    .trim()
    .replace(/^(INT\.|EXT\.|INT\/EXT\.|EST\.)\s*/i, '')
    .split('-')[0]
    .trim()
    .toUpperCase()

const extractTimeOfDay = (value: string): string | null => {
  const parts = value.split('-')
  const time = parts.at(-1)?.trim().toUpperCase() ?? ''
  return time ? time : null
}

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values.map(normalizeCue).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  )

export const inferContinuousBlockType = (
  text: string,
  previousType: BlockType = 'action',
): BlockType => {
  const compacted = text.trim()
  const upper = compacted.toUpperCase()

  if (!compacted) {
    return 'action'
  }

  if (/^(INT\.|EXT\.|INT\/EXT\.|EST\.)/.test(upper)) {
    return 'scene-heading'
  }

  if (/^SUPER:?/.test(upper)) {
    return 'super'
  }

  if (/^INSERT\b/.test(upper)) {
    return 'insert'
  }

  if (/^INTERCUT\b/.test(upper)) {
    return 'intercut'
  }

  if (upper === 'FLASHBACK' || upper.startsWith('BEGIN FLASHBACK')) {
    return 'flashback'
  }

  if (upper === 'END FLASHBACK') {
    return 'end-flashback'
  }

  if (upper === 'MONTAGE' || upper.startsWith('BEGIN MONTAGE')) {
    return 'montage'
  }

  if (upper === 'END MONTAGE') {
    return 'end-montage'
  }

  if (
    standardTransitions.includes(upper) ||
    /(?:CUT|DISSOLVE|FADE|BACK)\s+TO:$/.test(upper)
  ) {
    return 'transition'
  }

  if (/^\(.+\)$/.test(compacted)) {
    return 'parenthetical'
  }

  if (standardShots.some((shot) => upper.startsWith(shot))) {
    return 'shot'
  }

  if (
    compacted.length <= 44 &&
    /^[A-Z0-9 .\-()']+$/.test(upper) &&
    upper === compacted
  ) {
    return 'character'
  }

  if (previousType === 'character' || previousType === 'parenthetical') {
    return 'dialogue'
  }

  return 'action'
}

export const buildSmartTypeOptions = (project: ScriptProject): SmartTypeOptions => {
  const locations: string[] = []
  const timesOfDay: string[] = []
  const shots: string[] = [...standardShots]

  for (const block of project.blocks) {
    if (block.type === 'scene-heading') {
      const location = normalizeLocation(block.text)
      if (location) {
        locations.push(location)
      }

      const time = extractTimeOfDay(block.text)
      if (time) {
        timesOfDay.push(time)
      }
    }

    if (block.type === 'shot') {
      const shotCue = block.text.trim().match(/^[A-Za-z ]+:/)?.[0]
      if (shotCue) {
        shots.push(shotCue)
      }
    }
  }

  return {
    characters: collectCharacterSuggestions(project),
    locations: uniqueSorted(locations),
    timesOfDay: uniqueSorted([...standardTimesOfDay, ...timesOfDay]),
    transitions: standardTransitions,
    shots: uniqueSorted(shots),
    extensions: standardScriptExtensions,
  }
}

const renameCueText = (text: string, from: string, to: string): string => {
  const source = normalizeCue(from)
  const target = normalizeCue(to)
  const cue = normalizeCue(text)

  if (!source || !target) {
    return text
  }

  if (cue === source) {
    return target
  }

  const extensionMatch = cue.match(/^(.+?)\s+(\((?:V\.O\.|O\.S\.|CONT'D|PRE-LAP|FILTERED)\))$/)
  if (extensionMatch && extensionMatch[1] === source) {
    return `${target} ${extensionMatch[2]}`
  }

  return text
}

export const renameCharacterAcrossProject = (
  project: ScriptProject,
  from: string,
  to: string,
): ScriptProject => {
  const renamed = cloneProject(project)
  const source = normalizeCue(from)
  const target = normalizeCue(to)

  if (!source || !target) {
    return renamed
  }

  for (const block of renamed.blocks) {
    if (block.type === 'character') {
      block.text = renameCueText(block.text, source, target)
    }
  }

  for (const entry of renamed.catalog) {
    if (entry.kind === 'character' && normalizeCue(entry.name) === source) {
      entry.name = target
    }
  }

  for (const entry of renamed.production.breakdown) {
    if (entry.kind === 'cast' && normalizeCue(entry.name) === source) {
      entry.name = target
    }
  }

  return renamed
}

export const rebuildCatalogFromScript = (project: ScriptProject): CatalogEntry[] => {
  const detected = detectCatalogEntries(project)
  const existingBySignature = new Map(
    project.catalog.map((entry) => [`${entry.kind}:${normalizeCue(entry.name)}`, entry]),
  )

  return detected.map((entry) => {
    const signature = `${entry.kind}:${normalizeCue(entry.name)}`
    const existing = existingBySignature.get(signature)
    return existing ? { ...existing, name: normalizeCue(existing.name) } : entry
  })
}

interface DialogueGroup {
  character: number
  members: number[]
}

const collectDialogueGroups = (project: ScriptProject): DialogueGroup[] => {
  const groups: DialogueGroup[] = []
  let active: DialogueGroup | null = null

  project.blocks.forEach((block, index) => {
    if (block.type === 'character') {
      active = { character: index, members: [index] }
      groups.push(active)
      return
    }

    if (active && (block.type === 'parenthetical' || block.type === 'dialogue')) {
      active.members.push(index)
      return
    }

    active = null
  })

  return groups.filter((group) =>
    group.members.some((index) => project.blocks[index]?.type === 'dialogue'),
  )
}

export const markLastTwoDialogueGroupsAsDual = (
  project: ScriptProject,
): ScriptProject => {
  const groups = collectDialogueGroups(project).slice(-2)

  if (groups.length < 2) {
    return project
  }

  const next = cloneProject(project)
  const dualDialogueId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `dual-${Date.now()}`

  groups.forEach((group, groupIndex) => {
    const side = groupIndex === 0 ? 'left' : 'right'
    for (const blockIndex of group.members) {
      next.blocks[blockIndex].dualDialogueId = dualDialogueId
      next.blocks[blockIndex].dualDialogueSide = side
    }
  })

  return next
}
