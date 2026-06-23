import {
  blockTypeOrder,
  type BreakdownEntity,
  type BlockType,
  type CatalogEntry,
  type CatalogKind,
  type RevisionSnapshot,
  type RevisionSnapshotDiff,
  type SceneSummary,
  type ScriptBlock,
  type ScriptProject,
  type ScriptStats,
  type StoryCard,
} from '../types/screenplay'
import { parseSceneHeadingParts } from './sceneHeading'

const wordsPerPage = 250

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

export const createBlock = (type: BlockType, text = ''): ScriptBlock => ({
  id: createId(),
  type,
  text,
  revision: null,
  extension: null,
  dualDialogueId: null,
  dualDialogueSide: null,
  revisionMark: false,
  locked: false,
  omitted: false,
  omittedText: null,
  lockedPageLabel: null,
})

export const createStoryCard = (title = 'New Beat'): StoryCard => ({
  id: createId(),
  title,
  beat: '',
  linkedSceneId: null,
  x: 48,
  y: 48,
  color: '#2f2f2f',
  imageDataUrl: '',
})

export const createEmptyProject = (): ScriptProject => {
  const createdAt = new Date().toISOString()

  return {
    id: createId(),
    schemaVersion: 1,
    meta: {
      title: 'Untitled Screenplay',
      author: '',
      contact: '',
      draftDate: '',
      credits: 'Written by',
      titlePageNotes: '',
      includeTitlePage: true,
      showPageNumbers: true,
      showSceneNumbers: false,
      createdAt,
      updatedAt: createdAt,
      revisionMode: false,
      activeRevision: 'white',
    },
    blocks: [createBlock('scene-heading')],
    revisionSnapshots: [],
    revisionDraftSets: [],
    dialogueStash: [],
    cards: [
      {
        id: createId(),
        title: 'Opening hook',
        beat: 'Set tone, protagonist pressure, and central question.',
        linkedSceneId: null,
        x: 24,
        y: 24,
        color: '#2f2f2f',
        imageDataUrl: '',
      },
    ],
    production: {
      schedule: [],
      breakdown: [],
      shots: [],
      crew: [],
    },
    budget: {
      items: [],
    },
    storyboards: [],
    catalog: [],
    story: {
      outline: [],
      sceneMeta: {},
      notes: {
        script: '',
        scratchpad: '',
        scenes: {},
        inline: [],
      },
    },
    characters: {
      profiles: {},
      relationships: [],
      arcs: {},
    },
    productivity: {
      settings: {
        focusMode: false,
        typewriterMode: false,
        fullscreenMode: false,
      },
      goals: {
        dailyPageGoal: 5,
        projectPageGoal: 100,
        dailyPagesWritten: 0,
      },
      sprints: {
        activeMinutes: 25,
        remainingSeconds: 25 * 60,
        isRunning: false,
        sessions: [],
      },
      streak: {
        current: 0,
        longest: 0,
        lastWritingDate: null,
      },
      tts: {
        speed: 1,
        voiceByCharacter: {},
      },
    },
    tagging: {
      tags: [],
      catalog: [],
    },
    advanced: {
      activeFormat: 'feature',
      formatting: {
        showContinuedHeaders: true,
        showContinuedFooters: true,
        characterContdEnabled: true,
        contdActionBreakLines: 1,
        includeFadeIn: true,
      },
      sceneNumbering: {
        locked: false,
        showNumbers: false,
        numbers: {},
      },
      titlePage: {
        writtenBy: '',
        screenplayBy: '',
        storyBy: '',
        originalStoryBy: '',
        basedOn: '',
        earlierDraftWrittenBy: '',
        wgaRegistrationNumber: '',
        copyrightNotice: `Copyright ${new Date().getFullYear()}`,
        coverImageDataUrl: '',
      },
      submissionLocked: false,
      revisionDistributionLog: [],
      lockedPages: [],
      fixedPageMode: false,
      castStatuses: {},
      timing: {
        weights: {
          action: 0.75,
          dialogue: 1.25,
          mixed: 1,
        },
        manualSceneTimings: {},
      },
      lint: {
        cutToThreshold: 12,
        parentheticalThreshold: 8,
        coldOpenPageLimit: 5,
        actImbalancePercent: 35,
        acknowledgedNonStandardExtensions: [],
      },
      series: {
        bible: '',
        season: 1,
        episodeTitle: '',
        plotThreads: {},
        sharedCharacters: {},
        sharedLocations: {},
      },
      coverage: [],
      writerRoom: {
        parkingLot: [],
        whiteboard: [],
        research: [],
      },
      print: {
        draftInkSaver: false,
        twoUp: false,
        watermarkText: '',
        watermarkPosition: 'center',
        watermarkOpacity: 0.16,
        recipientWatermark: '',
      },
      accessibility: {
        taggedPdf: false,
        closedCaptionTemplate: false,
        audioDescriptionEnabled: false,
      },
      editor: {
        shortcuts: {
          'scene-heading': 'Ctrl+Alt+1',
          action: 'Ctrl+Alt+2',
          character: 'Ctrl+Alt+3',
          dialogue: 'Ctrl+Alt+4',
          parenthetical: 'Ctrl+Alt+5',
          transition: 'Ctrl+Alt+6',
          shot: 'Ctrl+Alt+7',
        },
      },
      legal: {
        draftNotes: {},
      },
    },
  }
}

export const cloneProject = (project: ScriptProject): ScriptProject => {
  if (typeof structuredClone === 'function') {
    return structuredClone(project)
  }

  return JSON.parse(JSON.stringify(project)) as ScriptProject
}

export const cycleBlockType = (type: BlockType): BlockType => {
  const currentIndex = blockTypeOrder.indexOf(type)
  return blockTypeOrder[(currentIndex + 1) % blockTypeOrder.length]
}

export const screenplayKeyboardCycle: BlockType[] = [
  'scene-heading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'shot',
]

export const cycleScreenplayBlockType = (
  type: BlockType,
  direction: 1 | -1 = 1,
): BlockType => {
  const currentIndex = screenplayKeyboardCycle.indexOf(type)
  if (currentIndex < 0) {
    return screenplayKeyboardCycle[0]
  }

  return screenplayKeyboardCycle[
    (currentIndex + direction + screenplayKeyboardCycle.length) %
      screenplayKeyboardCycle.length
  ]
}

export const nextTypeForEnter = (type: BlockType): BlockType => {
  switch (type) {
    case 'scene-heading':
      return 'action'
    case 'action':
      return 'character'
    case 'character':
    case 'parenthetical':
      return 'dialogue'
    case 'transition':
      return 'scene-heading'
    case 'note':
    case 'shot':
      return 'action'
    case 'dialogue':
      return 'character'
    default:
      return 'action'
  }
}

const normalizeSceneHeading = (value: string): string => {
  const heading = value.trim().toUpperCase()
  if (!heading) {
    return 'INT. UNNAMED LOCATION - DAY'
  }

  if (/^(INT\.|EXT\.|INT\/EXT\.|EST\.)/.test(heading)) {
    return heading
  }

  return `INT. ${heading}`
}

const normalizeTransition = (value: string): string => {
  const transition = value.trim().toUpperCase()
  if (!transition) {
    return 'CUT TO:'
  }

  if (transition.endsWith('TO:') || transition.endsWith(':')) {
    return transition
  }

  return `${transition} TO:`
}

const sanitizeParenthetical = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return '(beat)'
  }

  return `(${trimmed.replace(/^\(|\)$/g, '')})`
}

export const toFountain = (project: ScriptProject): string => {
  const lines = project.blocks.map((block) => {
    switch (block.type) {
      case 'scene-heading':
        return normalizeSceneHeading(block.text)
      case 'character':
        return block.text.trim().toUpperCase() || 'UNNAMED'
      case 'parenthetical':
        return sanitizeParenthetical(block.text)
      case 'transition':
        return normalizeTransition(block.text)
      case 'super':
      case 'insert':
      case 'intercut':
      case 'flashback':
      case 'end-flashback':
      case 'montage':
      case 'end-montage':
      case 'card':
      case 'title':
      case 'chyron':
      case 'crawl':
      case 'prelap':
      case 'audio-description':
      case 'recap':
      case 'two-column-av':
      case 'cold-open':
      case 'act-break':
      case 'title-over-black':
      case 'over-black':
      case 'the-end':
        return block.text.trim().toUpperCase()
      case 'note':
        return `[[${block.text.trim()}]]`
      case 'shot':
        return block.text.trim().toUpperCase() || 'SHOT'
      case 'dialogue':
      case 'action':
      default:
        return block.text.trim()
    }
  })

  const header = [`Title: ${project.meta.title}`, '']
  return [...header, ...lines].join('\n\n').trim() + '\n'
}

export const extractScenes = (project: ScriptProject): SceneSummary[] =>
  project.blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === 'scene-heading')
    .map(({ block, index }) => ({
      blockId: block.id,
      index,
      heading: normalizeSceneHeading(block.text),
    }))

const cloneBlocks = (blocks: ScriptBlock[]): ScriptBlock[] =>
  blocks.map((block) => ({ ...block }))

export const createRevisionSnapshot = (
  project: ScriptProject,
  label?: string,
): RevisionSnapshot => {
  const createdAt = new Date().toISOString()
  const defaultLabel = `Snapshot ${createdAt.slice(0, 16).replace('T', ' ')}`

  return {
    id: createId(),
    label: label?.trim() ? label.trim() : defaultLabel,
    createdAt,
    blocks: cloneBlocks(project.blocks),
  }
}

export const summarizeRevisionSnapshotDiff = (
  snapshot: RevisionSnapshot,
  currentBlocks: ScriptBlock[],
): RevisionSnapshotDiff => {
  const snapshotById = new Map(
    snapshot.blocks.map((block) => [
      block.id,
      `${block.type}|${block.text}|${block.revision ?? ''}`,
    ]),
  )

  const currentById = new Map(
    currentBlocks.map((block) => [
      block.id,
      `${block.type}|${block.text}|${block.revision ?? ''}`,
    ]),
  )

  let added = 0
  let removed = 0
  let changed = 0
  let unchanged = 0

  for (const [id, currentSignature] of currentById) {
    if (!snapshotById.has(id)) {
      added += 1
      continue
    }

    if (snapshotById.get(id) === currentSignature) {
      unchanged += 1
    } else {
      changed += 1
    }
  }

  for (const id of snapshotById.keys()) {
    if (!currentById.has(id)) {
      removed += 1
    }
  }

  return {
    added,
    removed,
    changed,
    unchanged,
  }
}

export const getScriptStats = (project: ScriptProject): ScriptStats => {
  const wordCount = project.blocks
    .map((block) => block.text.trim())
    .filter(Boolean)
    .flatMap((text) => text.split(/\s+/))
    .filter(Boolean).length

  const dialogueLines = project.blocks.filter((block) => block.type === 'dialogue').length
  const sceneCount = project.blocks.filter(
    (block) => block.type === 'scene-heading' && block.text.trim().length > 0,
  ).length

  return {
    sceneCount,
    dialogueLines,
    wordCount,
    estimatedPages: Math.max(1, Math.ceil(wordCount / wordsPerPage)),
  }
}

const parseSceneLocation = (heading: string): string => {
  return parseSceneHeadingParts(normalizeSceneHeading(heading)).location
}

export type CharacterVoiceCue = 'V.O.' | 'O.S.'

export const normalizeCharacterName = (value: string): string =>
  value
    .trim()
    .replace(/\s*\([^)]*\)?\s*$/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()

export const insertCharacterVoiceCue = (
  value: string,
  cue: CharacterVoiceCue,
): { text: string; cursor: number } => {
  const openParenIndex = value.lastIndexOf('(')
  const base =
    openParenIndex >= 0 && !value.slice(openParenIndex).includes(')')
      ? value.slice(0, openParenIndex).trimEnd()
      : value.trimEnd()
  const text = `${base}${base ? ' ' : ''}(${cue})`

  return {
    text,
    cursor: text.length,
  }
}

export const collectCharacterSuggestions = (project: ScriptProject): string[] => {
  const names = new Set<string>()

  const pushUnique = (value: string) => {
    const normalized = normalizeCharacterName(value)
    if (!normalized) {
      return
    }

    names.add(normalized)
  }

  for (const block of project.blocks) {
    if (block.type === 'character') {
      pushUnique(block.text)
    }
  }

  for (const entry of project.catalog) {
    if (entry.kind === 'character') {
      pushUnique(entry.name)
    }
  }

  for (const entry of project.production.breakdown) {
    if (entry.kind === 'cast') {
      pushUnique(entry.name)
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right))
}

export const generateProductionBreakdown = (
  project: ScriptProject,
): BreakdownEntity[] => {
  const characterScenes = new Map<string, Set<string>>()
  const locationScenes = new Map<string, Set<string>>()
  let activeSceneId: string | null = null

  for (const block of project.blocks) {
    if (block.type === 'scene-heading') {
      activeSceneId = block.id
      const location = parseSceneLocation(block.text)
      if (location) {
        if (!locationScenes.has(location)) {
          locationScenes.set(location, new Set<string>())
        }

        locationScenes.get(location)?.add(block.id)
      }
      continue
    }

    if (block.type === 'character') {
      const name = normalizeCharacterName(block.text)
      if (!name) {
        continue
      }

      if (!characterScenes.has(name)) {
        characterScenes.set(name, new Set<string>())
      }

      if (activeSceneId) {
        characterScenes.get(name)?.add(activeSceneId)
      }
    }
  }

  const castEntries: BreakdownEntity[] = [...characterScenes.entries()].map(
    ([name, sceneIds]) => ({
      id: createId(),
      kind: 'cast',
      name,
      sceneIds: [...sceneIds],
      notes: '',
    }),
  )

  const locationEntries: BreakdownEntity[] = [...locationScenes.entries()].map(
    ([name, sceneIds]) => ({
      id: createId(),
      kind: 'location',
      name,
      sceneIds: [...sceneIds],
      notes: '',
    }),
  )

  return [...castEntries, ...locationEntries]
}

export const buildDayOutOfDaysReport = (project: ScriptProject): string => {
  const cast = project.production.breakdown.filter((entry) => entry.kind === 'cast')
  const scheduledDays = project.production.schedule.map((entry) => entry.day)
  const maxDay = Math.max(0, ...scheduledDays)

  if (cast.length === 0 || maxDay === 0) {
    return 'Day-Out-of-Days\n\nNo cast breakdown or schedule days are available yet.'
  }

  const header = ['Character', ...Array.from({ length: maxDay }, (_, idx) => `D${idx + 1}`)]
  const rows = cast.map((entry) => {
    const row = [entry.name]
    for (let day = 1; day <= maxDay; day += 1) {
      const sceneIdsForDay = project.production.schedule
        .filter((scheduleEntry) => scheduleEntry.day === day)
        .map((scheduleEntry) => scheduleEntry.sceneId)
        .filter((sceneId): sceneId is string => sceneId !== null)

      const appears = entry.sceneIds.some((sceneId) => sceneIdsForDay.includes(sceneId))
      row.push(appears ? 'X' : '-')
    }

    return row.join(' | ')
  })

  return ['Day-Out-of-Days', '', header.join(' | '), ...rows].join('\n')
}

export const buildCharacterDialogueReport = (project: ScriptProject): string => {
  const cast = collectCharacterSuggestions(project)
  if (cast.length === 0) {
    return 'Character Dialogue Report\n\nNo character dialogue data is available yet.'
  }

  const stats = new Map<
    string,
    {
      appearances: number
      dialogueLines: number
      dialogueWords: number
    }
  >()

  const ensure = (name: string) => {
    if (!stats.has(name)) {
      stats.set(name, {
        appearances: 0,
        dialogueLines: 0,
        dialogueWords: 0,
      })
    }

    return stats.get(name)
  }

  for (const name of cast) {
    ensure(name)
  }

  let activeCharacter: string | null = null

  for (const block of project.blocks) {
    if (block.type === 'character') {
      const normalized = normalizeCharacterName(block.text)
      if (!normalized) {
        activeCharacter = null
        continue
      }

      activeCharacter = normalized
      const entry = ensure(normalized)
      if (entry) {
        entry.appearances += 1
      }
      continue
    }

    if (block.type === 'dialogue' && activeCharacter) {
      const words = block.text
        .trim()
        .split(/\s+/)
        .filter(Boolean).length

      const entry = ensure(activeCharacter)
      if (entry) {
        entry.dialogueLines += 1
        entry.dialogueWords += words
      }
    }
  }

  const header = ['Character', 'Appearances', 'Dialogue Lines', 'Dialogue Words'].join(' | ')

  const rows = [...stats.entries()]
    .sort((left, right) => {
      if (right[1].dialogueLines !== left[1].dialogueLines) {
        return right[1].dialogueLines - left[1].dialogueLines
      }

      if (right[1].dialogueWords !== left[1].dialogueWords) {
        return right[1].dialogueWords - left[1].dialogueWords
      }

      return left[0].localeCompare(right[0])
    })
    .map(
      ([name, entry]) =>
        `${name} | ${entry.appearances} | ${entry.dialogueLines} | ${entry.dialogueWords}`,
    )

  return ['Character Dialogue Report', '', header, ...rows].join('\n')
}

export const detectCatalogEntries = (project: ScriptProject): CatalogEntry[] => {
  const detected: CatalogEntry[] = []
  const seen = new Set<string>()

  const pushUnique = (kind: CatalogKind, name: string) => {
    const cleanedName = name.trim()
    if (!cleanedName) {
      return
    }

    const signature = `${kind}:${cleanedName.toUpperCase()}`
    if (seen.has(signature)) {
      return
    }

    seen.add(signature)
    detected.push({
      id: createId(),
      kind,
      name: cleanedName,
      notes: '',
    })
  }

  for (const block of project.blocks) {
    if (block.type === 'character') {
      pushUnique('character', normalizeCharacterName(block.text))
    }

    if (block.type === 'scene-heading') {
      pushUnique('location', parseSceneLocation(block.text))
    }
  }

  return detected
}
