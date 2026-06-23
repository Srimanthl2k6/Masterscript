import type {
  AdvancedState,
  CastStatus,
  CoverageRecord,
  ScriptBlock,
  ScriptFormatId,
  ScriptProject,
} from '../types/screenplay'
import {
  cloneProject,
  createBlock,
  createEmptyProject,
  extractScenes,
  normalizeCharacterName,
  toFountain,
} from './screenplay'
import {
  parseSceneHeadingParts,
  sceneHeadingTimesOfDay,
} from './sceneHeading'
import { formatRuns } from './richText'

export interface ScriptFormatPreset {
  id: ScriptFormatId
  label: string
  elements: string[]
  margins: Record<string, number>
  shortcuts: Record<string, string>
  template: Array<{ type: ScriptBlock['type']; text: string }>
}

export interface ScriptCheckResult {
  id: string
  code: string
  severity: 'info' | 'warning' | 'error'
  sceneNumber: number | null
  blockId: string | null
  line: string
  message: string
  suggestion: string
  tooltip?: string
}

export interface LockedPagePlanInput {
  lockedPages: Array<{ label: string; maxLines: number; usedLines: number }>
  changedPageLabels: string[]
}

export interface LockedPagePlan {
  fixedPageMode: boolean
  lockedPages: LockedPagePlanInput['lockedPages']
  blankSpacePages: Array<{ label: string; blankLines: number }>
  overflowPages: Array<{ label: string; sourceLabel: string }>
}

export interface AdvancedSidesPackage {
  day: number
  coverCards: Array<{
    sceneId: string
    sceneHeading: string
    pageCount: number
    cast: string[]
  }>
  blocks: ScriptBlock[]
  shareLinks: string[]
}

export interface OneLinerRow {
  sceneNumber: string
  intExt: string
  location: string
  description: string
  dayNight: string
  castPresent: string[]
  pageCount: number
}

export interface TimingSceneRow {
  sceneId: string
  heading: string
  estimatedMinutes: number
  manualTiming: string
}

export interface TimingReport {
  totalMinutes: number
  scenes: TimingSceneRow[]
}

export interface AdvancedNavigatorRow {
  sceneId: string
  sceneNumber: string
  heading: string
  intExt: string
  dayNight: string
  pageCount: number
  status: string
  color: string
  castInitials: string[]
  wordCount: number
  lineCount: number
  lengthBarPercent: number
  estimatedMinutes: number
}

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

const wordsPerPage = 250

const wordCount = (text: string): number =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

const blockWords = (block: ScriptBlock): number => wordCount(block.text)

export const smartTypeTimesOfDay = sceneHeadingTimesOfDay

export const smartTypeTransitions = [
  'CUT TO:',
  'SMASH CUT TO:',
  'MATCH CUT TO:',
  'JUMP CUT TO:',
  'WHIP PAN TO:',
  'DISSOLVE TO:',
  'FADE TO:',
  'INTERCUT WITH:',
  'FADE OUT.',
  'FADE TO BLACK.',
]

export const smartTypeExtensions = [
  'V.O.',
  'O.S.',
  "CONT'D",
  'PRE-LAP',
  'FILTERED',
  'SINGING',
  'BARELY AUDIBLE',
  'IN UNISON',
  'DUBBED',
]

export const nonStandardExtensions = [
  'FILTERED',
  'SINGING',
  'BARELY AUDIBLE',
  'IN UNISON',
  'DUBBED',
]

export const technicalElementTemplates = [
  { type: 'title-over-black' as const, label: 'TITLE OVER BLACK', text: 'TITLE OVER BLACK' },
  { type: 'over-black' as const, label: 'OVER BLACK:', text: 'OVER BLACK:' },
  { type: 'transition' as const, label: 'FADE IN:', text: 'FADE IN:' },
  { type: 'card' as const, label: 'CARD:', text: 'CARD:' },
  { type: 'title' as const, label: 'TITLE:', text: 'TITLE:' },
  { type: 'chyron' as const, label: 'CHYRON:', text: 'CHYRON:' },
  { type: 'crawl' as const, label: 'CRAWL:', text: 'CRAWL:' },
  { type: 'prelap' as const, label: 'PRELAP:', text: 'PRELAP:' },
  { type: 'insert' as const, label: 'INSERT', text: 'INSERT - DETAIL' },
  { type: 'insert' as const, label: 'BACK TO SCENE', text: 'BACK TO SCENE' },
  { type: 'the-end' as const, label: 'THE END', text: 'THE END' },
]

export const scriptFormatPresets: ScriptFormatPreset[] = [
  {
    id: 'feature',
    label: 'Feature Screenplay',
    elements: ['Scene Heading', 'Action', 'Character', 'Dialogue', 'Transition'],
    margins: { left: 1.5, right: 1, dialogueLeft: 2.5, dialogueRight: 2 },
    shortcuts: { scene: 'Ctrl+1', action: 'Ctrl+2', character: 'Ctrl+3' },
    template: [
      { type: 'transition', text: 'FADE IN:' },
      { type: 'scene-heading', text: 'INT. LOCATION - DAY' },
      { type: 'action', text: 'Action begins.' },
    ],
  },
  {
    id: 'tv-one-hour',
    label: 'TV One-Hour Drama',
    elements: ['COLD OPEN', 'TEASER', 'ACT ONE', 'ACT TWO', 'TAG'],
    margins: { left: 1.5, right: 1, actBreak: 2 },
    shortcuts: { act: 'Ctrl+Alt+A', teaser: 'Ctrl+Alt+T' },
    template: [
      { type: 'cold-open', text: 'COLD OPEN' },
      { type: 'scene-heading', text: 'INT. LOCATION - NIGHT' },
    ],
  },
  {
    id: 'multi-cam-sitcom',
    label: 'TV Multi-Camera Sitcom',
    elements: ['Scene Heading', 'Action', 'Dual Dialogue', 'Scene Numbers'],
    margins: { left: 1.25, right: 1, dialogueLeft: 2.2, dialogueRight: 2.2 },
    shortcuts: { dual: 'Ctrl+Alt+D' },
    template: [{ type: 'act-break', text: 'ACT ONE' }],
  },
  {
    id: 'stage-play',
    label: 'Stage Play',
    elements: ['Act', 'Scene', 'Stage Direction', 'Character', 'Dialogue'],
    margins: { left: 1.25, right: 1.25, character: 3 },
    shortcuts: { act: 'Ctrl+Alt+A' },
    template: [{ type: 'act-break', text: 'ACT I' }],
  },
  {
    id: 'audio-drama',
    label: 'Audio Drama / Radio Play',
    elements: ['SFX', 'Music', 'Character', 'Dialogue', 'Narration'],
    margins: { left: 1.2, right: 1.2, sfx: 1.5 },
    shortcuts: { sfx: 'Ctrl+Alt+S' },
    template: [{ type: 'prelap', text: 'SFX: ROOM TONE' }],
  },
  {
    id: 'comic-book',
    label: 'Comic Book / Graphic Novel',
    elements: ['Page', 'Panel', 'Caption', 'Dialogue', 'SFX'],
    margins: { left: 1, right: 1, panel: 1.5 },
    shortcuts: { panel: 'Ctrl+Alt+P' },
    template: [{ type: 'card', text: 'PAGE ONE' }],
  },
  {
    id: 'two-column-av',
    label: 'Two-Column AV',
    elements: ['Video', 'Audio'],
    margins: { left: 0.75, right: 0.75, gutter: 0.3 },
    shortcuts: { av: 'Ctrl+Alt+V' },
    template: [{ type: 'two-column-av', text: 'VIDEO | AUDIO' }],
  },
  {
    id: 'documentary',
    label: 'Documentary',
    elements: ['Interview', 'B-Roll', 'Voiceover', 'Lower Third', 'Archive'],
    margins: { left: 1, right: 1, lowerThird: 1.4 },
    shortcuts: { chyron: 'Ctrl+Alt+C' },
    template: [{ type: 'chyron', text: 'CHYRON: NAME / TITLE' }],
  },
]

const deepMerge = <T extends Record<string, unknown>>(target: T, patch: Partial<T>): T => {
  const merged = { ...target }
  for (const [key, value] of Object.entries(patch)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      merged[key as keyof T] = deepMerge(
        target[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      ) as T[keyof T]
    } else if (value !== undefined) {
      merged[key as keyof T] = value as T[keyof T]
    }
  }
  return merged
}

export const ensureAdvancedState = (project: ScriptProject): ScriptProject => {
  const fallback = createEmptyProject().advanced
  const next = cloneProject(project)
  next.advanced = deepMerge(fallback as unknown as Record<string, unknown>, {
    ...(next.advanced as unknown as Record<string, unknown> | undefined),
  }) as unknown as AdvancedState
  return next
}

export const updateAdvancedSettings = (
  project: ScriptProject,
  patch: Partial<AdvancedState>,
): ScriptProject => {
  const next = ensureAdvancedState(project)
  next.advanced = deepMerge(
    next.advanced as unknown as Record<string, unknown>,
    patch as unknown as Record<string, unknown>,
  ) as unknown as AdvancedState
  return next
}

export const parseSlugLine = (input: string) => {
  const normalized = normalizeSlugLine(input)
  const parsed = parseSceneHeadingParts(normalized)
  const remainder = normalized.replace(/^(INT\.\/EXT\.|INT\/EXT\.|I\/E|INT\.|EXT\.|EST\.)\s*/, '')
  const withoutTime = parsed.timeOfDay
    ? remainder.replace(
        new RegExp(`(?:\\s+-\\s+|\\.\\s*|\\s+)${parsed.timeOfDay}\\.?(?:\\s*SCENE\\s+[A-Z0-9]+\\.?)?$`),
        '',
      )
    : remainder
  const locationParts = withoutTime.split(/\s+-\s+/)

  return {
    intExt: parsed.intExt,
    location: parsed.location || locationParts[0]?.replace(/[.\s]+$/, '') || '',
    subLocation: locationParts.slice(1).join(' - ').replace(/[.\s]+$/, ''),
    timeOfDay: parsed.timeOfDay,
    normalized,
  }
}

export const normalizeSlugLine = (input: string): string => {
  const upper = input.trim().replace(/\s+/g, ' ').toUpperCase()
  const normalizedPrefix = upper
    .replace(/^INT\.\s+I\/E\s+/, 'INT./EXT. ')
    .replace(/^INT\.\s+INT\/EXT\s+/, 'INT./EXT. ')
    .replace(/^I\/E\b/, 'INT./EXT.')
    .replace(/^INT\/EXT\b/, 'INT./EXT.')
    .replace(/^INT-EXT\b/, 'INT./EXT.')
  const parts = normalizedPrefix.split(/\s+-\s+/)
  const time = parts.at(-1) ?? ''
  if (smartTypeTimesOfDay.includes(time)) {
    return [...parts.slice(0, -1), time].join(' - ')
  }

  const timeMatch = smartTypeTimesOfDay.find((candidate) => normalizedPrefix.endsWith(candidate))
  return timeMatch ? normalizedPrefix.replace(new RegExp(`${timeMatch}$`), timeMatch) : normalizedPrefix
}

const inferBlockType = (line: string): ScriptBlock['type'] => {
  const trimmed = line.trim()
  if (/^(INT\.|EXT\.|I\/E|INT\/EXT|INT\.\/EXT\.|EST\.)/i.test(trimmed)) {
    return 'scene-heading'
  }
  if (smartTypeTransitions.includes(trimmed.toUpperCase())) {
    return 'transition'
  }
  if (/^[A-Z0-9 ()'.-]{2,}$/.test(trimmed) && trimmed.length < 32) {
    return 'character'
  }
  return 'action'
}

const importLines = (text: string): ScriptProject => {
  const project = createEmptyProject()
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const titleLine = lines.find((line) => /^Title:/i.test(line))
  if (titleLine) {
    project.meta.title = titleLine.replace(/^Title:\s*/i, '').trim() || project.meta.title
  }
  project.blocks = lines
    .filter((line) => !/^Title:/i.test(line))
    .map((line) => {
      const type = inferBlockType(line)
      return createBlock(type, type === 'scene-heading' ? normalizeSlugLine(line) : line)
    })
  return project
}

export const importPlainTextProject = (text: string): ScriptProject => importLines(text)

export const importRtfProject = (rtf: string): ScriptProject =>
  importLines(
    rtf
      .replace(/\\par[d]?/g, '\n')
      .replace(/\\'[0-9a-f]{2}/gi, '')
      .replace(/[{}]/g, '')
      .replace(/\\[a-z]+\d*\s?/gi, '')
      .trim(),
  )

export const importHtmlProject = (html: string): ScriptProject =>
  importLines(
    html
      .replace(/<\/(p|h[1-6]|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&'),
  )

export const importPdfTextProject = (text: string): ScriptProject => importLines(text)

export const importCeltxProject = (content: string): ScriptProject =>
  importLines(content.replace(/<[^>]+>/g, '\n'))

export const exportTxtProject = (project: ScriptProject): string => toFountain(project)

export const exportRtfProject = (project: ScriptProject): string => {
  const families = [
    'Courier Prime',
    ...new Set(
      project.blocks.flatMap((block) =>
        (block.formatRanges ?? [])
          .map((range) => range.format.fontFamily)
          .filter((family): family is string => Boolean(family)),
      ),
    ),
  ]
  const fontTable = families
    .map((family, index) => `{\\f${index} ${family.replace(/[{}\\;]/g, '')};}`)
    .join('')
  return `{\\rtf1\\ansi{\\fonttbl${fontTable}}\n${project.blocks
    .map((block) =>
      `${formatRuns(block.text, block.formatRanges)
        .map((run) => {
          const text = run.text.replace(/\\/g, '\\\\').replace(/[{}]/g, '\\$&')
          const fontIndex = run.format.fontFamily
            ? Math.max(0, families.indexOf(run.format.fontFamily))
            : 0
          const prefix = [
            `\\f${fontIndex}`,
            run.format.bold ? '\\b' : '',
            run.format.italic ? '\\i' : '',
            run.format.underline ? '\\ul' : '',
            run.format.letterSpacing ? '\\expndtw48' : '',
          ].join('')
          return `{${prefix} ${text}}`
        })
        .join('')}\\par`,
    )
    .join('\n')}\n}`
}

export const exportHtmlProject = (project: ScriptProject): string =>
  `<main>${project.blocks
    .map(
      (block) =>
        `<article data-type="${block.type}">${formatRuns(
          block.text,
          block.formatRanges,
        )
          .map((run) => {
            const text = run.text
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
            const style = [
              run.format.bold ? 'font-weight:700' : '',
              run.format.italic ? 'font-style:italic' : '',
              run.format.underline ? 'text-decoration:underline' : '',
              run.format.letterSpacing ? 'letter-spacing:0.08em' : '',
              run.format.fontFamily
                ? `font-family:${run.format.fontFamily.replace(/[;"<>]/g, '')}`
                : '',
            ].filter(Boolean).join(';')
            return style ? `<span style="${style}">${text}</span>` : text
          })
          .join('')}</article>`,
    )
    .join('')}</main>`

const csvCell = (value: string | number | string[]): string => {
  const text = Array.isArray(value) ? value.join('; ') : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const exportSceneListCsv = (project: ScriptProject): string => {
  const rows = extractScenes(project).map((scene, index) => {
    const parsed = parseSlugLine(scene.heading)
    return [index + 1, parsed.normalized, parsed.intExt, parsed.location, parsed.timeOfDay]
  })
  return [['Scene', 'Heading', 'INT/EXT', 'Location', 'Time'], ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n')
}

export const exportReportWorkbookXml = (
  sheetName: string,
  rows: Array<Array<string | number>>,
): string =>
  `<?xml version="1.0"?><Workbook><Worksheet ss:Name="${sheetName}"><Table>${rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => `<Cell><Data ss:Type="String">${String(cell)}</Data></Cell>`)
          .join('')}</Row>`,
    )
    .join('')}</Table></Worksheet></Workbook>`

const sceneRanges = (project: ScriptProject) => {
  const scenes = extractScenes(project)
  return scenes.map((scene, index) => {
    const next = scenes[index + 1]
    return {
      ...scene,
      sceneNumber: index + 1,
      blocks: project.blocks.slice(scene.index, next?.index ?? project.blocks.length),
    }
  })
}

const sceneNumberForBlock = (project: ScriptProject, blockId: string): number | null => {
  const ranges = sceneRanges(project)
  const found = ranges.find((scene) => scene.blocks.some((block) => block.id === blockId))
  return found?.sceneNumber ?? null
}

const canonicalLocation = (location: string): string =>
  location
    .replace(/^THE\s+/i, '')
    .replace(/\s+AREA$/i, '')
    .trim()
    .toUpperCase()

const castInBlocks = (blocks: ScriptBlock[]): string[] =>
  [
    ...new Set(
      blocks
        .filter((block) => block.type === 'character')
        .map((block) => normalizeCharacterName(block.text))
        .filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right))

const pageCountForBlocks = (blocks: ScriptBlock[]): number =>
  Math.max(1, Math.ceil(blocks.reduce((sum, block) => sum + blockWords(block), 0) / wordsPerPage))

export const buildScriptCheck = (project: ScriptProject): ScriptCheckResult[] => {
  const hydrated = ensureAdvancedState(project)
  const results: ScriptCheckResult[] = []
  const ranges = sceneRanges(hydrated)
  const locationsByCanonical = new Map<string, Set<string>>()

  for (const scene of ranges) {
    const parsed = parseSlugLine(scene.heading)
    const canonical = canonicalLocation(parsed.location)
    if (canonical) {
      const entries = locationsByCanonical.get(canonical) ?? new Set<string>()
      entries.add(parsed.location)
      locationsByCanonical.set(canonical, entries)
    }
  }

  for (const [canonical, variants] of locationsByCanonical.entries()) {
    if (variants.size > 1) {
      results.push({
        id: createId(),
        code: 'SLUG_INCONSISTENCY',
        severity: 'warning',
        sceneNumber: null,
        blockId: null,
        line: [...variants].join(', '),
        message: 'Same location appears with inconsistent slug wording.',
        suggestion: canonical,
      })
    }
  }

  ranges.forEach((scene, index) => {
    const parsed = parseSlugLine(scene.heading)
    const previous = ranges[index - 1] ? parseSlugLine(ranges[index - 1].heading) : null
    if (
      parsed.timeOfDay === 'CONTINUOUS' &&
      previous &&
      parsed.location !== previous.location
    ) {
      results.push({
        id: createId(),
        code: 'CONTINUOUS_LOCATION_GAP',
        severity: 'warning',
        sceneNumber: scene.sceneNumber,
        blockId: scene.blockId,
        line: scene.heading,
        message: 'CONTINUOUS follows a different location.',
        suggestion: 'Use LATER/SAME TIME or revise the location continuity.',
      })
    }
  })

  const cutToCount = hydrated.blocks.filter(
    (block) => block.type === 'transition' && block.text.trim().toUpperCase() === 'CUT TO:',
  ).length
  if (cutToCount > hydrated.advanced.lint.cutToThreshold) {
    results.push({
      id: createId(),
      code: 'CUT_TO_OVERUSE',
      severity: 'info',
      sceneNumber: null,
      blockId: null,
      line: 'CUT TO:',
      message: 'CUT TO: is usually redundant in spec scripts.',
      suggestion: 'Remove routine CUT TO: transitions.',
    })
  }

  const parentheticals = hydrated.blocks.filter((block) => block.type === 'parenthetical')
  if (parentheticals.length > hydrated.advanced.lint.parentheticalThreshold) {
    results.push({
      id: createId(),
      code: 'PARENTHETICAL_OVERUSE',
      severity: 'info',
      sceneNumber: null,
      blockId: null,
      line: `${parentheticals.length} parentheticals`,
      message: 'Parentheticals may be overused.',
      suggestion: 'Keep only essential delivery notes.',
    })
  }

  for (const block of parentheticals) {
    if (block.text.length > 48 || block.text.includes('\n')) {
      results.push({
        id: createId(),
        code: 'PARENTHETICAL_TOO_LONG',
        severity: 'warning',
        sceneNumber: sceneNumberForBlock(hydrated, block.id),
        blockId: block.id,
        line: block.text,
        message: 'Parenthetical exceeds one line.',
        suggestion: 'Move complex direction into action.',
      })
    }
  }

  for (const block of hydrated.blocks) {
    const extension = block.text.match(/\(([^)]+)\)/)?.[1]?.toUpperCase()
    if (
      extension &&
      nonStandardExtensions.includes(extension) &&
      !hydrated.advanced.lint.acknowledgedNonStandardExtensions.includes(extension)
    ) {
      results.push({
        id: createId(),
        code: 'NON_STANDARD_EXTENSION',
        severity: 'info',
        sceneNumber: sceneNumberForBlock(hydrated, block.id),
        blockId: block.id,
        line: block.text,
        message: `${extension} is non-standard.`,
        suggestion: 'Confirm the production convention before using it.',
        tooltip: 'Non-standard extensions can confuse readers unless the production expects them.',
      })
    }
  }

  const dialogueEmotionPattern = /\bI am (sad|angry|scared|happy|lonely|afraid)\b/i
  for (const block of hydrated.blocks.filter((candidate) => candidate.type === 'dialogue')) {
    if (dialogueEmotionPattern.test(block.text)) {
      results.push({
        id: createId(),
        code: 'ON_THE_NOSE_DIALOGUE',
        severity: 'info',
        sceneNumber: sceneNumberForBlock(hydrated, block.id),
        blockId: block.id,
        line: block.text,
        message: 'Dialogue directly states an emotion.',
        suggestion: 'Consider subtext or behavior instead.',
      })
    }
  }

  return results
}

export const buildTitlePageWarnings = (project: ScriptProject) => {
  const advanced = ensureAdvancedState(project).advanced
  return advanced.titlePage.writtenBy && advanced.titlePage.screenplayBy
    ? [
        {
          code: 'WGA_CREDIT_MIX',
          message: 'Written By and Screenplay By are distinct WGA credit forms.',
          tooltip:
            'Written By is generally for writers credited with both story and screenplay; Screenplay By is used when story credit is separate.',
        },
      ]
    : []
}

export const addRevisionDistribution = (
  project: ScriptProject,
  event: Omit<AdvancedState['revisionDistributionLog'][number], 'id'>,
): ScriptProject => {
  const next = ensureAdvancedState(project)
  next.advanced.revisionDistributionLog.push({ id: createId(), ...event })
  return next
}

export const buildRevisionDistributionCsv = (project: ScriptProject): string =>
  [['Date', 'Color', 'Pages', 'Recipients'], ...ensureAdvancedState(project).advanced.revisionDistributionLog.map((event) => [
    event.date,
    event.color,
    event.pages.join('; '),
    event.recipients,
  ])]
    .map((row) => row.map(csvCell).join(','))
    .join('\n')

export const buildRevisionSlugList = (project: ScriptProject): string[] =>
  ensureAdvancedState(project).advanced.revisionDistributionLog.map(
    (event) => `${event.color[0].toUpperCase()}${event.color.slice(1)} - ${event.date}`,
  )

export const createPdfExportProject = (
  project: ScriptProject,
  mode: 'clean' | 'dirty',
): ScriptProject => {
  const next = cloneProject(project)
  if (mode === 'clean') {
    next.blocks = next.blocks.map((block) => ({ ...block, revisionMark: false }))
  }
  return next
}

export const assignProductionSceneNumbers = (project: ScriptProject): ScriptProject => {
  const next = ensureAdvancedState(project)
  if (next.advanced.sceneNumbering.locked) {
    return next
  }
  extractScenes(next).forEach((scene, index) => {
    next.advanced.sceneNumbering.numbers[scene.blockId] =
      next.advanced.sceneNumbering.numbers[scene.blockId] ?? `${index + 1}`
  })
  return next
}

export const beginProductionDraft = (project: ScriptProject): ScriptProject => {
  const next = assignProductionSceneNumbers(project)
  next.advanced.sceneNumbering.locked = true
  next.advanced.sceneNumbering.showNumbers = true
  next.meta.revisionMode = true
  next.meta.activeRevision = 'white'
  if (next.revisionDraftSets.length === 0) {
    next.revisionDraftSets.push({
      id: createId(),
      label: 'White Production Draft',
      color: 'white',
      createdAt: new Date().toISOString(),
    })
  }
  return next
}

export const createLockedPagePlan = (
  project: ScriptProject,
  input: LockedPagePlanInput,
): LockedPagePlan => {
  ensureAdvancedState(project)
  return {
    fixedPageMode: true,
    lockedPages: input.lockedPages,
    blankSpacePages: input.lockedPages
      .map((page) => ({ label: page.label, blankLines: Math.max(0, page.maxLines - page.usedLines) }))
      .filter((page) => page.blankLines > 0),
    overflowPages: input.changedPageLabels.map((label) => ({
      label,
      sourceLabel: label.replace(/[A-Z]+$/, ''),
    })),
  }
}

export const buildPrintExportSettings = (project: ScriptProject) =>
  ensureAdvancedState(project).advanced.print

export const buildAdvancedSidesPackage = (
  project: ScriptProject,
  day: number,
  character?: string,
): AdvancedSidesPackage => {
  const hydrated = ensureAdvancedState(project)
  const scheduledSceneIds = hydrated.production.schedule
    .filter((entry) => entry.day === day && entry.sceneId)
    .map((entry) => entry.sceneId as string)
  const ranges = sceneRanges(hydrated).filter((scene) => scheduledSceneIds.includes(scene.blockId))
  const filteredRanges =
    character && ranges.some((scene) => castInBlocks(scene.blocks).includes(character))
      ? ranges.filter((scene) => castInBlocks(scene.blocks).includes(character))
      : ranges
  const links = hydrated.advanced.fixedPageMode ? [`fixed-page-day-${day}`] : []

  return {
    day,
    coverCards: filteredRanges.map((scene) => ({
      sceneId: scene.blockId,
      sceneHeading: normalizeSlugLine(scene.heading),
      pageCount: pageCountForBlocks(scene.blocks),
      cast: castInBlocks(scene.blocks),
    })),
    blocks: filteredRanges.flatMap((scene) => scene.blocks),
    shareLinks: links,
  }
}

export const createDigitalSidesLink = (
  projectId: string,
  options: { expiresAt?: string } = {},
): string =>
  `masterscript://sides/${encodeURIComponent(projectId)}?token=${createId()}${
    options.expiresAt ? `&expires=${encodeURIComponent(options.expiresAt)}` : ''
  }`

export const buildOneLinerSchedule = (project: ScriptProject): OneLinerRow[] =>
  sceneRanges(ensureAdvancedState(project)).map((scene) => {
    const parsed = parseSlugLine(scene.heading)
    return {
      sceneNumber:
        project.advanced?.sceneNumbering?.numbers?.[scene.blockId] ?? String(scene.sceneNumber),
      intExt: parsed.intExt,
      location: parsed.location,
      description:
        scene.blocks.find((block) => block.type === 'action')?.text.slice(0, 80) ?? '',
      dayNight: parsed.timeOfDay,
      castPresent: castInBlocks(scene.blocks),
      pageCount: pageCountForBlocks(scene.blocks),
    }
  })

export const buildTimingReport = (project: ScriptProject): TimingReport => {
  const hydrated = ensureAdvancedState(project)
  const scenes = sceneRanges(hydrated).map((scene) => {
    const actionWords = scene.blocks
      .filter((block) => block.type === 'action')
      .reduce((sum, block) => sum + blockWords(block), 0)
    const dialogueWords = scene.blocks
      .filter((block) => block.type === 'dialogue')
      .reduce((sum, block) => sum + blockWords(block), 0)
    const actionPages = actionWords / wordsPerPage
    const dialoguePages = dialogueWords / wordsPerPage
    const mixedPages = Math.max(0, (scene.blocks.reduce((sum, block) => sum + blockWords(block), 0) / wordsPerPage) - actionPages - dialoguePages)
    const estimatedMinutes = Number(
      (
        actionPages * hydrated.advanced.timing.weights.action +
        dialoguePages * hydrated.advanced.timing.weights.dialogue +
        mixedPages * hydrated.advanced.timing.weights.mixed
      ).toFixed(2),
    )
    return {
      sceneId: scene.blockId,
      heading: normalizeSlugLine(scene.heading),
      estimatedMinutes,
      manualTiming: hydrated.advanced.timing.manualSceneTimings[scene.blockId] ?? '',
    }
  })
  return {
    totalMinutes: Number(scenes.reduce((sum, scene) => sum + scene.estimatedMinutes, 0).toFixed(2)),
    scenes,
  }
}

export const buildAdvancedNavigatorRows = (project: ScriptProject): AdvancedNavigatorRow[] => {
  const hydrated = ensureAdvancedState(project)
  const timing = new Map(buildTimingReport(hydrated).scenes.map((scene) => [scene.sceneId, scene]))
  const maxPages = Math.max(1, ...sceneRanges(hydrated).map((scene) => pageCountForBlocks(scene.blocks)))
  return sceneRanges(hydrated).map((scene) => {
    const parsed = parseSlugLine(scene.heading)
    const pageCount = pageCountForBlocks(scene.blocks)
    const text = scene.blocks.map((block) => block.text).join('\n')
    return {
      sceneId: scene.blockId,
      sceneNumber:
        hydrated.advanced.sceneNumbering.numbers[scene.blockId] ?? String(scene.sceneNumber),
      heading: normalizeSlugLine(scene.heading),
      intExt: parsed.intExt,
      dayNight: parsed.timeOfDay,
      pageCount,
      status: hydrated.story.sceneMeta[scene.blockId]?.status ?? 'Draft',
      color: hydrated.story.sceneMeta[scene.blockId]?.color ?? '#2f2f2f',
      castInitials: castInBlocks(scene.blocks).map((name) =>
        name
          .split(/\s+/)
          .map((part) => part[0])
          .join(''),
      ),
      wordCount: wordCount(text),
      lineCount: text.split(/\n/).length,
      lengthBarPercent: Math.round((pageCount / maxPages) * 100),
      estimatedMinutes: timing.get(scene.blockId)?.estimatedMinutes ?? 0,
    }
  })
}

export const buildSeriesReviewFlags = (project: ScriptProject): string[] => {
  const advanced = ensureAdvancedState(project).advanced
  return [
    ...Object.values(advanced.series.sharedCharacters)
      .filter((entry) => entry.renamedTo)
      .map((entry) => `Character ${entry.name} renamed to ${entry.renamedTo}; review episodes.`),
    ...Object.values(advanced.series.sharedLocations)
      .filter((entry) => entry.renamedTo)
      .map((entry) => `Location ${entry.name} renamed to ${entry.renamedTo}; review episodes.`),
  ]
}

export const addParkingLotScene = (
  project: ScriptProject,
  title: string,
  blocks: ScriptBlock[],
): ScriptProject => {
  const next = ensureAdvancedState(project)
  next.advanced.writerRoom.parkingLot.push({ id: createId(), title, blocks })
  return next
}

export const addCoverageRecord = (
  project: ScriptProject,
  record: Omit<CoverageRecord, 'id'>,
): ScriptProject => {
  const next = ensureAdvancedState(project)
  next.advanced.coverage.push({ id: createId(), ...record })
  return next
}

export const buildCoveragePdfLines = (record: CoverageRecord): string[] => [
  `Logline: ${record.logline}`,
  `Format: ${record.format}`,
  `Genre: ${record.genre}`,
  `Setting: ${record.setting}`,
  `Time Period: ${record.timePeriod}`,
  `Recommendation: ${record.recommendation}`,
  `Story: ${record.comments.story}`,
  `Character: ${record.comments.character}`,
  `Dialogue: ${record.comments.dialogue}`,
  `Format Comments: ${record.comments.format}`,
]

export const buildTableReadExportOptions = () => ({
  fontSize: 14,
  fontFamily: 'Courier',
  widerMargins: true,
  extraSceneSpacing: true,
  pageNumbersReset: true,
  sceneNumbers: false,
  characterNameAtPageTop: true,
})

export const buildAccessibilityExports = (project: ScriptProject) => ({
  formats: [
    'audio-description',
    'tagged-pdf',
    'closed-caption',
  ],
  taggedPdfEnabled: ensureAdvancedState(project).advanced.accessibility.taggedPdf,
})

export const buildLegalWorkflowLinks = (project: ScriptProject) => {
  const title = encodeURIComponent(project.meta.title)
  const author = encodeURIComponent(project.meta.author)
  return {
    wgaUrl: `https://www.wgawregistry.org/register.aspx?title=${title}&author=${author}`,
    copyrightUrl: `https://www.copyright.gov/registration/?title=${title}`,
    poorMansCopyrightTooltip:
      "Mailing yourself a copy does not create registration rights or substitute for WGA/copyright registration.",
  }
}

export const getCharacterCastingGroups = (project: ScriptProject): Record<CastStatus, string[]> => {
  const statuses = ensureAdvancedState(project).advanced.castStatuses
  const groups: Record<CastStatus, string[]> = {
    'Series Regular': [],
    Recurring: [],
    'Guest Star': [],
    'Co-Star': [],
    'Day Player': [],
    'Under-5': [],
  }
  for (const [name, status] of Object.entries(statuses)) {
    groups[status]?.push(name)
  }
  return groups
}

export const buildRevisedPagesOnlyLabels = (project: ScriptProject): string[] =>
  ensureAdvancedState(project)
    .blocks.filter((block) => block.revisionMark)
    .map((block) => block.lockedPageLabel ?? String(sceneNumberForBlock(project, block.id) ?? 1))

export const buildTableReadDraftText = (project: ScriptProject): string =>
  toFountain(createPdfExportProject(project, 'clean'))

export const buildSubmissionLockProject = (project: ScriptProject, locked: boolean): ScriptProject =>
  updateAdvancedSettings(project, { submissionLocked: locked })

export const buildScriptTimingSummary = (project: ScriptProject): string => {
  const timing = buildTimingReport(project)
  return `${timing.totalMinutes} min estimated runtime`
}

export const currentYearCopyright = (): string => `Copyright ${new Date().getFullYear()}`

export const buildFormatTemplateProject = (formatId: ScriptFormatId): ScriptProject => {
  const preset = scriptFormatPresets.find((format) => format.id === formatId) ?? scriptFormatPresets[0]
  const project = createEmptyProject()
  project.advanced.activeFormat = preset.id
  project.blocks = preset.template.map((block) => createBlock(block.type, block.text))
  return project
}

export const buildWatermarkDescriptor = (project: ScriptProject) => {
  const print = ensureAdvancedState(project).advanced.print
  return {
    text: [print.watermarkText, print.recipientWatermark].filter(Boolean).join(' | '),
    position: print.watermarkPosition,
    opacity: print.watermarkOpacity,
  }
}

export const addDraftNote = (
  project: ScriptProject,
  draftId: string,
  note: string,
): ScriptProject => {
  const next = ensureAdvancedState(project)
  next.advanced.legal.draftNotes[draftId] = note
  return next
}

export const addWhiteboardItem = (
  project: ScriptProject,
  item: Omit<AdvancedState['writerRoom']['whiteboard'][number], 'id'>,
): ScriptProject => {
  const next = ensureAdvancedState(project)
  next.advanced.writerRoom.whiteboard.push({ id: createId(), ...item })
  return next
}

export const addResearchItem = (
  project: ScriptProject,
  item: Omit<AdvancedState['writerRoom']['research'][number], 'id'>,
): ScriptProject => {
  const next = ensureAdvancedState(project)
  next.advanced.writerRoom.research.push({ id: createId(), ...item })
  return next
}

export const buildColdOpenLengthWarning = (project: ScriptProject): ScriptCheckResult | null => {
  const hydrated = ensureAdvancedState(project)
  const coldOpenIndex = hydrated.blocks.findIndex((block) => block.type === 'cold-open')
  if (coldOpenIndex < 0) {
    return null
  }
  const actIndex = hydrated.blocks.findIndex(
    (block, index) => index > coldOpenIndex && block.type === 'act-break',
  )
  const blocks = hydrated.blocks.slice(coldOpenIndex, actIndex < 0 ? hydrated.blocks.length : actIndex)
  const pages = pageCountForBlocks(blocks)
  return pages > hydrated.advanced.lint.coldOpenPageLimit
    ? {
        id: createId(),
        code: 'COLD_OPEN_TOO_LONG',
        severity: 'warning',
        sceneNumber: null,
        blockId: hydrated.blocks[coldOpenIndex].id,
        line: hydrated.blocks[coldOpenIndex].text,
        message: 'Cold open exceeds configured page limit.',
        suggestion: `Target ${hydrated.advanced.lint.coldOpenPageLimit} pages or fewer.`,
      }
    : null
}
