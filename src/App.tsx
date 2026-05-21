import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import CommandPalette, { type CommandResult } from './components/CommandPalette'
import { useCollaborationSession, type CollaborationStatus } from './lib/collaboration/useCollaborationSession'
import {
  buildCollaborationInvite,
  hasCollaborationMeta,
  parseCollaborationInvite,
  type CollaborationInviteDetails,
} from './lib/collaboration/collaborationInvite'
import { DESKTOP_DOWNLOAD_LINKS, shouldShowDownloadButton } from './lib/download'
import { paginateProjectForPrint } from './lib/adapters/pagination'
import type { AdapterWarning } from './lib/adapters/types'
import { paginateBlocksForEditor } from './lib/editorPagination'
import {
  buildSmartTypeOptions,
  inferContinuousBlockType,
  markLastTwoDialogueGroupsAsDual,
  rebuildCatalogFromScript,
} from './lib/formattingEngine'
import { buildCardsFromTemplate, storyTemplates } from './lib/planningTemplates'
import {
  buildCharacterDialogueReport,
  collectCharacterSuggestions,
  createRevisionSnapshot,
  createBlock,
  createEmptyProject,
  createStoryCard,
  cloneProject,
  cycleScreenplayBlockType,
  detectCatalogEntries,
  extractScenes,
  generateProductionBreakdown,
  getScriptStats,
  nextTypeForEnter,
  screenplayKeyboardCycle,
  summarizeRevisionSnapshotDiff,
  toFountain,
} from './lib/screenplay'
import {
  beginNextRevisionSet,
  lockScene,
  omitScene,
  stashDialogueSelection,
  swapStashIntoDialogue,
  unlockScene,
  unomitScene,
  updateBlockTextWithRevisionTracking,
} from './lib/revisionProduction'
import {
  buildHierarchicalOutline,
  ensureStoryDevelopmentState,
  reorderScenesByOutline,
  setSceneDevelopmentMeta,
  setSceneNote,
  updateCorkboardCard,
} from './lib/storyDevelopment'
import {
  addCharacterRelationship,
  buildCharacterStats,
  buildDialogueDistribution,
  ensureProfilesFromScript,
  renameCharacterEverywhere,
  setCharacterArcStage,
  upsertCharacterProfile,
} from './lib/characterTools'
import {
  assignCharacterVoices,
  buildReadThroughQueue,
  calculateGoalProgress,
  logSprintSession,
  setProductivityMode,
  updateWritingStreak,
} from './lib/productivity'
import {
  addShotToScene,
  buildCallSheet,
  buildDoodGrid,
  buildDoodGridCsv,
  buildScriptSides,
  buildShotListCsv,
  buildShotListRows,
  buildStoryboardExportPages,
  buildStripboard,
  exportTextReportToPdf,
  reorderStripboard,
} from './lib/productionTools'
import {
  autoTagScript,
  buildBreakdownCsv,
  buildBreakdownSheet,
  buildTagCatalog,
  departmentTagCategories,
  departmentTagColors,
  tagScriptSelection,
  updateTagCatalogItem,
} from './lib/taggingBreakdown'
import {
  buildAnalyticsDashboard,
  buildCharacterReport,
  buildDepartmentReport,
  buildDialogueReport,
  buildLocationReport,
  buildPageSceneSummary,
  buildReportCsv,
  buildSceneReport,
} from './lib/reportsAnalytics'
import {
  addCoverageRecord,
  addParkingLotScene,
  addRevisionDistribution,
  beginProductionDraft as beginAdvancedProductionDraft,
  buildAccessibilityExports,
  buildAdvancedNavigatorRows,
  buildAdvancedSidesPackage,
  buildCoveragePdfLines,
  buildFormatTemplateProject,
  buildLegalWorkflowLinks,
  buildOneLinerSchedule,
  buildPrintExportSettings,
  buildRevisionDistributionCsv,
  buildRevisionSlugList,
  buildScriptCheck,
  buildSeriesReviewFlags,
  buildTableReadDraftText,
  buildTableReadExportOptions,
  buildTimingReport,
  buildTitlePageWarnings,
  buildWatermarkDescriptor,
  createDigitalSidesLink,
  createPdfExportProject,
  currentYearCopyright,
  exportHtmlProject,
  exportReportWorkbookXml,
  exportRtfProject,
  exportSceneListCsv,
  exportTxtProject,
  scriptFormatPresets,
  smartTypeExtensions,
  smartTypeTimesOfDay,
  smartTypeTransitions,
  technicalElementTemplates,
  updateAdvancedSettings,
} from './lib/advancedMasterScript'
import {
  blockTypeOrder,
  blockTypeLabels,
  revisionColors,
  type CastStatus,
  type BlockType,
  type BreakdownKind,
  type CatalogEntry,
  type DepartmentTagCategory,
  type RevisionSnapshot,
  type RevisionColor,
  type SceneStatus,
  type CharacterArcStage,
  type CharacterCustomField,
  type ProductivitySettings,
  type ScriptBlock,
  type ScriptFormatId,
  type ScriptProject,
} from './types/screenplay'

type AppView = 'home' | 'workspace'

type WorkspaceTab =
  | 'draft'
  | 'preview'
  | 'planning'
  | 'productivity'
  | 'production'
  | 'breakdown'
  | 'reports'
  | 'advanced'
  | 'budget'
  | 'storyboards'
  | 'catalog'

type AutosaveState = 'idle' | 'saving' | 'saved' | 'error'
type ThemeMode = 'dark' | 'light'
const collaborationStatusLabels: Record<CollaborationStatus, string> = {
  offline: 'Offline',
  hosting: 'Hosting',
  connected: 'Connected',
  disconnected: 'Disconnected',
  reconnecting: 'Reconnecting',
}

type ReportView =
  | 'scene'
  | 'character'
  | 'location'
  | 'department'
  | 'dialogue'
  | 'summary'
  | 'analytics'
type ReportCell = string | number | string[]

interface CurrentReport {
  title: string
  headers: string[]
  rows: ReportCell[][]
}

interface HistoryState {
  past: ScriptProject[]
  present: ScriptProject
  future: ScriptProject[]
}

interface SearchHit {
  id: string
  label: string
  detail: string
  typeLabel: string
  targetTab: WorkspaceTab
  sceneId?: string | null
  focusId?: string
}

interface FindMatch {
  blockId: string
  blockType: BlockType
  matchText: string
  index: number
  preview: string
}

interface SnapshotOption {
  id: string
  label: string
  createdAt: string
  blockCount: number
}

interface SnapshotCompareRow {
  id: string
  status: 'unchanged' | 'changed' | 'added' | 'removed'
  snapshotText: string
  currentText: string
}

interface QueuedSelection {
  id: string
  start: number
  end: number
}

const historyLimit = 80
const autosaveKey = 'masterscript-autosave-v1'
const themeKey = 'masterscript-theme-v1'
const recentProjectsKey = 'masterscript-recent-v1'
const recentProjectSnapshotsKey = 'masterscript-recent-project-snapshots-v1'
const defaultPreviewZoom = 0.82
const useContinuousDraftEditor = false

const blockTypePlaceholders: Record<BlockType, string> = {
  'scene-heading': 'INT. LOCATION - DAY',
  action: 'Describe what the audience sees and hears.',
  character: 'CHARACTER NAME',
  dialogue: 'What does the character say?',
  parenthetical: '(how the line is delivered)',
  transition: 'CUT TO:',
  shot: 'SHOT: Camera or shot detail',
  super: 'SUPER: TITLE OR TEXT',
  insert: 'INSERT - DETAIL',
  intercut: 'INTERCUT WITH:',
  flashback: 'FLASHBACK',
  'end-flashback': 'END FLASHBACK',
  montage: 'MONTAGE',
  'end-montage': 'END MONTAGE',
  card: 'CARD: On-screen text',
  title: 'TITLE: On-screen title',
  chyron: 'CHYRON: Name / location',
  crawl: 'CRAWL: Scrolling text',
  prelap: 'PRELAP: Sound from next scene',
  'audio-description': 'Audio description line',
  recap: 'PREVIOUSLY ON...',
  'two-column-av': 'VIDEO | AUDIO',
  'cold-open': 'COLD OPEN',
  'act-break': 'ACT ONE',
  'title-over-black': 'TITLE OVER BLACK',
  'over-black': 'OVER BLACK:',
  'the-end': 'THE END',
  note: '[[Production note]]',
}

const continuousIndentByType: Record<BlockType, number> = {
  'scene-heading': 0,
  action: 0,
  character: 18,
  dialogue: 10,
  parenthetical: 14,
  transition: 32,
  shot: 0,
  super: 0,
  insert: 0,
  intercut: 0,
  flashback: 0,
  'end-flashback': 0,
  montage: 0,
  'end-montage': 0,
  card: 0,
  title: 0,
  chyron: 0,
  crawl: 0,
  prelap: 0,
  'audio-description': 0,
  recap: 0,
  'two-column-av': 0,
  'cold-open': 0,
  'act-break': 0,
  'title-over-black': 0,
  'over-black': 0,
  'the-end': 18,
  note: 0,
}

const alignContinuousText = (text: string, type: BlockType): string => {
  const indent = continuousIndentByType[type]
  if (indent <= 0) {
    return text
  }

  const spacer = ' '.repeat(indent)
  return text
    .split('\n')
    .map((line) => (line.trim().length === 0 ? '' : `${spacer}${line}`))
    .join('\n')
}

const normalizeContinuousSegmentText = (value: string): string =>
  value
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()

const continuousDraftPlaceholder = [
  alignContinuousText(blockTypePlaceholders['scene-heading'], 'scene-heading'),
  alignContinuousText(blockTypePlaceholders.action, 'action'),
  alignContinuousText(blockTypePlaceholders.character, 'character'),
  alignContinuousText(blockTypePlaceholders.dialogue, 'dialogue'),
].join('\n\n')

const shortcutBlockTypes: BlockType[] = [
  'scene-heading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'shot',
]

const defaultScreenplayShortcuts: Record<string, string> = {
  'scene-heading': 'Ctrl+Alt+1',
  action: 'Ctrl+Alt+2',
  character: 'Ctrl+Alt+3',
  dialogue: 'Ctrl+Alt+4',
  parenthetical: 'Ctrl+Alt+5',
  transition: 'Ctrl+Alt+6',
  shot: 'Ctrl+Alt+7',
}

const shortcutSignature = (shortcut: string): string =>
  shortcut
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join('+')

const shortcutFromKeyEvent = (
  event: Pick<
    KeyboardEvent<HTMLElement>,
    'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'
  >,
): string | null => {
  if (['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) {
    return null
  }

  const key =
    event.key.length === 1
      ? event.key.toUpperCase()
      : event.key === ' '
        ? 'Space'
        : event.key

  const hasModifier = event.ctrlKey || event.altKey || event.metaKey || event.shiftKey
  const isFunctionKey = /^F\d{1,2}$/i.test(key)
  if (!hasModifier && !isFunctionKey) {
    return null
  }

  return [
    event.ctrlKey ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Meta' : '',
    key,
  ]
    .filter(Boolean)
    .join('+')
}

interface RecentProjectEntry {
  label: string
  source: 'project' | 'import'
  updatedAt: string
  projectId?: string
}

const isLikelyLocalProjectPath = (value: string): boolean =>
  (/^[a-z]:[\\/]/i.test(value) || value.startsWith('\\\\')) &&
  /\.msproj\.json$/i.test(value)

const hostedLanRoomsKey = 'masterscript-hosted-lan-rooms-v1'

const readHostedLanRoomIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(hostedLanRoomsKey)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [])
  } catch {
    return new Set()
  }
}

const rememberHostedLanRoom = (roomId: string) => {
  try {
    const rooms = readHostedLanRoomIds()
    rooms.add(roomId)
    localStorage.setItem(hostedLanRoomsKey, JSON.stringify([...rooms]))
  } catch {
    // Local host ownership only affects auto-reconnect convenience.
  }
}

const isHostedLanRoom = (roomId: string): boolean => readHostedLanRoomIds().has(roomId)

const buildProjectCollaborationInvite = (project: ScriptProject): string => {
  if (!hasCollaborationMeta(project)) {
    return ''
  }

  return buildCollaborationInvite({
    mode: project.meta.collaborationMode ?? 'webrtc',
    roomId: project.meta.collaborationRoomId ?? '',
    inviteKey: project.meta.collaborationInviteKey ?? '',
    lanServerUrl: project.meta.collaborationLanServerUrl,
  })
}

const readRecentProjectSnapshots = (): Record<string, ScriptProject> => {
  try {
    const raw = localStorage.getItem(recentProjectSnapshotsKey)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => isScriptProject(value)),
    ) as Record<string, ScriptProject>
  } catch {
    return {}
  }
}

const writeRecentProjectSnapshot = (project: ScriptProject) => {
  try {
    const snapshots = readRecentProjectSnapshots()
    const nextEntries = [
      [project.id, project] as const,
      ...Object.entries(snapshots).filter(([id]) => id !== project.id),
    ].slice(0, 12)

    localStorage.setItem(
      recentProjectSnapshotsKey,
      JSON.stringify(Object.fromEntries(nextEntries)),
    )
  } catch {
    // Ignore snapshot persistence failures; autosave still covers the current project.
  }
}

const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'draft', label: 'Draft' },
  { id: 'preview', label: 'Preview' },
  { id: 'planning', label: 'Planning' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'production', label: 'Production' },
  { id: 'breakdown', label: 'Breakdown' },
  { id: 'reports', label: 'Reports' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'budget', label: 'Budget' },
  { id: 'storyboards', label: 'Storyboards' },
  { id: 'catalog', label: 'Catalog' },
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isScriptProject = (value: unknown): value is ScriptProject => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    isRecord(value.meta) &&
    Array.isArray(value.blocks) &&
    Array.isArray(value.cards)
  )
}

const createUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

const formatTimer = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatReportCell = (value: ReportCell): string =>
  Array.isArray(value) ? value.join(', ') : String(value)

const reorderById = <T extends { id: string }>(
  items: T[],
  fromId: string,
  toId: string,
): T[] => {
  const fromIndex = items.findIndex((item) => item.id === fromId)
  const toIndex = items.findIndex((item) => item.id === toId)

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items
  }

  const reordered = [...items]
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)
  return reordered
}

const hydrateProject = (candidate: ScriptProject): ScriptProject => {
  const fallback = createEmptyProject()
  return {
    ...fallback,
    ...candidate,
    schemaVersion: 1,
    meta: {
      ...fallback.meta,
      ...candidate.meta,
    },
    blocks:
      candidate.blocks?.map((block) => ({
        ...createBlock('action'),
        ...block,
      })) ?? fallback.blocks,
    revisionSnapshots:
      candidate.revisionSnapshots?.map((snapshot) => ({
        ...snapshot,
        blocks: snapshot.blocks?.map((block) => ({ ...createBlock('action'), ...block })) ?? [],
      })) ?? fallback.revisionSnapshots,
    revisionDraftSets: candidate.revisionDraftSets ?? fallback.revisionDraftSets,
    dialogueStash: candidate.dialogueStash ?? fallback.dialogueStash,
    cards: candidate.cards ?? [],
    production: {
      schedule: candidate.production?.schedule ?? [],
      breakdown: candidate.production?.breakdown ?? [],
      shots: candidate.production?.shots ?? [],
      crew: candidate.production?.crew ?? [],
    },
    budget: {
      items: candidate.budget?.items ?? [],
    },
    storyboards: candidate.storyboards ?? [],
    catalog: candidate.catalog ?? [],
    story: candidate.story ?? fallback.story,
    characters: candidate.characters ?? fallback.characters,
    productivity: candidate.productivity ?? fallback.productivity,
    tagging: candidate.tagging ?? fallback.tagging,
    advanced: {
      ...fallback.advanced,
      ...candidate.advanced,
      formatting: {
        ...fallback.advanced.formatting,
        ...candidate.advanced?.formatting,
      },
      sceneNumbering: {
        ...fallback.advanced.sceneNumbering,
        ...candidate.advanced?.sceneNumbering,
      },
      titlePage: {
        ...fallback.advanced.titlePage,
        ...candidate.advanced?.titlePage,
      },
      timing: {
        ...fallback.advanced.timing,
        ...candidate.advanced?.timing,
        weights: {
          ...fallback.advanced.timing.weights,
          ...candidate.advanced?.timing?.weights,
        },
      },
      lint: {
        ...fallback.advanced.lint,
        ...candidate.advanced?.lint,
      },
      series: {
        ...fallback.advanced.series,
        ...candidate.advanced?.series,
      },
      writerRoom: {
        ...fallback.advanced.writerRoom,
        ...candidate.advanced?.writerRoom,
      },
      print: {
        ...fallback.advanced.print,
        ...candidate.advanced?.print,
      },
      accessibility: {
        ...fallback.advanced.accessibility,
        ...candidate.advanced?.accessibility,
      },
      editor: {
        ...fallback.advanced.editor,
        ...candidate.advanced?.editor,
        shortcuts: {
          ...fallback.advanced.editor.shortcuts,
          ...candidate.advanced?.editor?.shortcuts,
        },
      },
      legal: {
        ...fallback.advanced.legal,
        ...candidate.advanced?.legal,
      },
    },
  }
}

const triggerDownload = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const triggerBinaryDownload = (
  content: ArrayBuffer,
  filename: string,
  mime: string,
) => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const pickTextFile = (accept: string): Promise<{ name: string; content: string } | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          resolve(null)
          return
        }

        resolve({
          name: file.name,
          content: reader.result,
        })
      }
      reader.onerror = () => resolve(null)
      reader.readAsText(file)
    }

    input.click()
  })

const pickBinaryFile = (
  accept: string,
): Promise<{ name: string; content: ArrayBuffer } | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        if (!(reader.result instanceof ArrayBuffer)) {
          resolve(null)
          return
        }

        resolve({
          name: file.name,
          content: reader.result,
        })
      }
      reader.onerror = () => resolve(null)
      reader.readAsArrayBuffer(file)
    }

    input.click()
  })

const inferTitleFromPath = (pathLike: string): string => {
  const fileName = pathLike.split(/[\\/]/).pop() ?? pathLike
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  const cleaned = withoutExtension.replace(/[-_]+/g, ' ').trim()
  return cleaned || 'Imported Screenplay'
}

const shouldApplyImportedTitleFallback = (title: string): boolean => {
  const normalized = title.trim().toLowerCase()
  return (
    normalized.length === 0 ||
    normalized === 'imported screenplay' ||
    normalized === 'untitled screenplay'
  )
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64.replace(/\s+/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}

const getInitialThemeMode = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(themeKey)
    return stored === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildFindRegex = (
  query: string,
  caseSensitive: boolean,
  global: boolean,
): RegExp => {
  const flags = `${global ? 'g' : ''}${caseSensitive ? '' : 'i'}`
  return new RegExp(escapeRegExp(query), flags)
}

const replaceFirstOccurrence = (
  source: string,
  query: string,
  replacement: string,
  caseSensitive: boolean,
): { text: string; replaced: boolean } => {
  if (!query) {
    return { text: source, replaced: false }
  }

  const matcher = buildFindRegex(query, caseSensitive, false)
  if (!matcher.test(source)) {
    return { text: source, replaced: false }
  }

  return {
    text: source.replace(matcher, replacement),
    replaced: true,
  }
}

const replaceAllOccurrences = (
  source: string,
  query: string,
  replacement: string,
  caseSensitive: boolean,
): { text: string; replacedCount: number } => {
  if (!query) {
    return { text: source, replacedCount: 0 }
  }

  const matcher = buildFindRegex(query, caseSensitive, true)
  const allMatches = source.match(matcher)
  const replacedCount = allMatches?.length ?? 0

  if (replacedCount === 0) {
    return { text: source, replacedCount: 0 }
  }

  return {
    text: source.replace(matcher, replacement),
    replacedCount,
  }
}

const formatBlockPreview = (block: { type: BlockType; text: string } | null): string => {
  if (!block) {
    return '—'
  }

  const text = block.text.trim().replace(/\s+/g, ' ')
  const clipped = text.length > 88 ? `${text.slice(0, 88)}…` : text
  return `${blockTypeLabels[block.type]}: ${clipped || '(empty)'}`
}

const toContinuousDraftText = (blocks: ScriptBlock[]): string =>
  blocks
    .map((block) => {
      const text = normalizeContinuousSegmentText(block.text)
      if (!text) {
        return ''
      }

      let formatted = text
      if (
        block.type === 'scene-heading' ||
        block.type === 'character' ||
        block.type === 'transition' ||
        block.type === 'shot' ||
        block.type === 'super' ||
        block.type === 'insert' ||
        block.type === 'intercut' ||
        block.type === 'flashback' ||
        block.type === 'end-flashback' ||
        block.type === 'montage' ||
        block.type === 'end-montage'
      ) {
        formatted = formatted.toUpperCase()
      }

      return alignContinuousText(formatted, block.type)
    })
    .filter(Boolean)
    .join('\n\n')

const parseContinuousDraftText = (
  value: string,
  previousBlocks: ScriptBlock[],
): ScriptBlock[] => {
  const segments = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n{2,}/)
    .map((entry) => normalizeContinuousSegmentText(entry))
    .filter(Boolean)

  if (segments.length === 0) {
    return [createBlock('action', '')]
  }

  let previousType: BlockType = 'action'
  return segments.map((segment, index) => {
    const inferredType = inferContinuousBlockType(segment, previousType)
    previousType = inferredType

    const existing = previousBlocks[index]
    if (existing) {
      return {
        ...existing,
        type: inferredType,
        text: segment,
      }
    }

    return createBlock(inferredType, segment)
  })
}

const getContinuousInsertTemplate = (type: BlockType): string => {
  switch (type) {
    case 'scene-heading':
      return 'INT. LOCATION - DAY'
    case 'action':
      return 'Action line.'
    case 'character':
      return 'CHARACTER'
    case 'dialogue':
      return 'Dialogue line.'
    case 'parenthetical':
      return '(beat)'
    case 'transition':
      return 'CUT TO:'
    case 'shot':
      return 'SHOT:'
    case 'super':
      return 'SUPER: TITLE CARD'
    case 'insert':
      return 'INSERT - DETAIL'
    case 'intercut':
      return 'INTERCUT WITH:'
    case 'flashback':
      return 'FLASHBACK'
    case 'end-flashback':
      return 'END FLASHBACK'
    case 'montage':
      return 'MONTAGE'
    case 'end-montage':
      return 'END MONTAGE'
    case 'note':
    default:
      return '[[Note]]'
  }
}

function App() {
  const [appView, setAppView] = useState<AppView>('home')
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: createEmptyProject(),
    future: [],
  }))
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('draft')
  const [statusMessage, setStatusMessage] = useState('Local-first mode active')
  const [savedPath, setSavedPath] = useState('Autosave only')
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialThemeMode())
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null)
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [draggingScheduleId, setDraggingScheduleId] = useState<string | null>(null)
  const [draggingOutlineSceneId, setDraggingOutlineSceneId] = useState<string | null>(null)
  const [selectedShootDay, setSelectedShootDay] = useState(1)
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    storyTemplates[0]?.id ?? '',
  )
  const [selectedCharacterName, setSelectedCharacterName] = useState('')
  const [relationshipTo, setRelationshipTo] = useState('')
  const [relationshipLabel, setRelationshipLabel] = useState('')
  const [selectedTagCategory, setSelectedTagCategory] =
    useState<DepartmentTagCategory>('Props')
  const [tagPhrase, setTagPhrase] = useState('')
  const [selectedReportView, setSelectedReportView] = useState<ReportView>('scene')
  const [selectedReportDepartment, setSelectedReportDepartment] =
    useState<DepartmentTagCategory>('Props')
  const [selectedCastStatusCharacter, setSelectedCastStatusCharacter] = useState('')
  const [selectedCastStatus, setSelectedCastStatus] = useState<CastStatus>('Series Regular')
  const [sprintStartWords, setSprintStartWords] = useState(0)
  const [readThroughIndex, setReadThroughIndex] = useState(0)
  const [readThroughState, setReadThroughState] = useState<
    'stopped' | 'playing' | 'paused'
  >('stopped')
  const [renameFrom, setRenameFrom] = useState('')
  const [renameTo, setRenameTo] = useState('')
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false)
  const [isSnapshotHistoryOpen, setIsSnapshotHistoryOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [findCaseSensitive, setFindCaseSensitive] = useState(false)
  const [findCursor, setFindCursor] = useState(0)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [continuousEnterType, setContinuousEnterType] = useState<BlockType>('character')
  const [previewZoom, setPreviewZoom] = useState(defaultPreviewZoom)
  const [previewPageIndex, setPreviewPageIndex] = useState(0)
  const [sceneFilterQuery, setSceneFilterQuery] = useState('')
  const [recentProjects, setRecentProjects] = useState<RecentProjectEntry[]>(() => {
    try {
      const raw = localStorage.getItem(recentProjectsKey)
      if (!raw) {
        return []
      }

      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        return []
      }

      return parsed
        .filter(
          (item): item is RecentProjectEntry =>
            isRecord(item) &&
            typeof item.label === 'string' &&
            typeof item.source === 'string' &&
            typeof item.updatedAt === 'string',
        )
        .map((item) => ({
          label: item.label,
          source: item.source,
          updatedAt: item.updatedAt,
          projectId:
            isRecord(item) && typeof item.projectId === 'string'
              ? item.projectId
              : undefined,
        }))
        .slice(0, 8)
    } catch {
      return []
    }
  })
  const [isCollaborationPanelOpen, setIsCollaborationPanelOpen] = useState(false)
  const [collaborationServerInput, setCollaborationServerInput] = useState('')
  const [collaborationRoomInput, setCollaborationRoomInput] = useState('')
  const [collaborationInviteInput, setCollaborationInviteInput] = useState('')
  const [startScreenInviteInput, setStartScreenInviteInput] = useState('')
  const [collaborationJoinStatus, setCollaborationJoinStatus] = useState('')
  const [isBootstrappingCollaboration, setIsBootstrappingCollaboration] = useState(false)

  const project = history.present
  const scenes = useMemo(() => extractScenes(project), [project])
  const storyState = project.story
  const storyOutline = useMemo(
    () => (storyState.outline.length > 0 ? storyState.outline : buildHierarchicalOutline(project)),
    [project, storyState.outline],
  )
  const stats = useMemo(() => getScriptStats(project), [project])
  const productivityState = project.productivity
  const goalProgress = useMemo(
    () => calculateGoalProgress(project, stats.estimatedPages),
    [project, stats.estimatedPages],
  )
  const readThroughQueue = useMemo(() => buildReadThroughQueue(project), [project])
  const stripboardRows = useMemo(() => buildStripboard(project), [project])
  const doodGrid = useMemo(() => buildDoodGrid(project), [project])
  const availableShootDays = useMemo(
    () =>
      [...new Set(project.production.schedule.map((entry) => entry.day))]
        .filter((day) => day > 0)
        .sort((left, right) => left - right),
    [project.production.schedule],
  )
  const resolvedShootDay = availableShootDays.includes(selectedShootDay)
    ? selectedShootDay
    : availableShootDays[0] ?? 1
  const callSheetPreview = useMemo(
    () => buildCallSheet(project, resolvedShootDay),
    [project, resolvedShootDay],
  )
  const scriptSidesPreview = useMemo(
    () => buildScriptSides(project, resolvedShootDay),
    [project, resolvedShootDay],
  )
  const tagCatalogGroups = useMemo(() => buildTagCatalog(project), [project])
  const autoTagSuggestions = useMemo(() => autoTagScript(project).slice(0, 40), [project])
  const analyticsDashboard = useMemo(() => buildAnalyticsDashboard(project), [project])
  const scriptCheckResults = useMemo(() => buildScriptCheck(project), [project])
  const advancedTiming = useMemo(() => buildTimingReport(project), [project])
  const advancedNavigatorRows = useMemo(() => buildAdvancedNavigatorRows(project), [project])
  const oneLinerRows = useMemo(() => buildOneLinerSchedule(project), [project])
  const titlePageWarnings = useMemo(() => buildTitlePageWarnings(project), [project])
  const revisionSlugList = useMemo(() => buildRevisionSlugList(project), [project])
  const legalWorkflowLinks = useMemo(() => buildLegalWorkflowLinks(project), [project])
  const accessibilityExports = useMemo(() => buildAccessibilityExports(project), [project])
  const seriesReviewFlags = useMemo(() => buildSeriesReviewFlags(project), [project])
  const printExportSettings = useMemo(() => buildPrintExportSettings(project), [project])
  const watermarkDescriptor = useMemo(() => buildWatermarkDescriptor(project), [project])
  const currentReport = useMemo<CurrentReport>(() => {
    switch (selectedReportView) {
      case 'character':
        return {
          title: 'Character Report',
          headers: ['Character', 'Scenes', 'Scene Count', 'Pages', 'Screen %'],
          rows: buildCharacterReport(project).map((row) => [
            row.character,
            row.scenes,
            row.sceneCount,
            row.totalPages,
            row.screenTimePercent,
          ]),
        }
      case 'location':
        return {
          title: 'Location Report',
          headers: ['Location', 'INT/EXT', 'Day/Night', 'Scenes', 'Pages'],
          rows: buildLocationReport(project).map((row) => [
            row.location,
            row.intExt,
            row.dayNight,
            row.scenes,
            row.totalPages,
          ]),
        }
      case 'department':
        return {
          title: `${selectedReportDepartment} Report`,
          headers: ['Category', 'Item', 'Scenes', 'Cost', 'Notes'],
          rows: buildDepartmentReport(project, selectedReportDepartment).map((row) => [
            row.category,
            row.item,
            row.scenes,
            row.cost,
            row.notes,
          ]),
        }
      case 'dialogue':
        return {
          title: 'Dialogue Report',
          headers: ['Character', 'Lines', 'Words', '% Total'],
          rows: buildDialogueReport(project).map((row) => [
            row.character,
            row.lines,
            row.words,
            row.percent,
          ]),
        }
      case 'summary': {
        const summary = buildPageSceneSummary(project)
        return {
          title: 'Page and Scene Count Summary',
          headers: ['Metric', 'Value'],
          rows: [
            ['Scenes', summary.sceneCount],
            ['Estimated Pages', summary.estimatedPages],
            ['Dialogue Lines', summary.dialogueLines],
            ['Words', summary.wordCount],
            ['Tagged Items', summary.taggedItems],
          ],
        }
      }
      case 'analytics':
        return {
          title: 'Script Analytics Dashboard',
          headers: ['Metric', 'Value'],
          rows: [
            ['Dialogue Words', analyticsDashboard.dialogueVsAction.dialogueWords],
            ['Action Words', analyticsDashboard.dialogueVsAction.actionWords],
            ['Dialogue %', analyticsDashboard.dialogueVsAction.dialoguePercent],
            ['Action %', analyticsDashboard.dialogueVsAction.actionPercent],
            ...analyticsDashboard.intExt.map((item) => [`INT/EXT ${item.label}`, item.value]),
            ...analyticsDashboard.dayNight.map((item) => [`Day/Night ${item.label}`, item.value]),
          ],
        }
      case 'scene':
      default:
        return {
          title: 'Scene Report',
          headers: ['#', 'Heading', 'INT/EXT', 'Day/Night', 'Cast', 'Pages'],
          rows: buildSceneReport(project).map((row) => [
            row.sceneNumber,
            row.heading,
            row.intExt,
            row.dayNight,
            row.castPresent,
            row.pageCount,
          ]),
        }
    }
  }, [analyticsDashboard, project, selectedReportDepartment, selectedReportView])
  const appShellClass = [
    'app-shell',
    'dot-grid',
    productivityState.settings.focusMode ? 'focus-mode' : '',
    productivityState.settings.typewriterMode ? 'typewriter-mode' : '',
    productivityState.settings.fullscreenMode ? 'fullscreen-writing' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const budgetTotal = useMemo(
    () => project.budget.items.reduce((sum, item) => sum + item.amount, 0),
    [project.budget.items],
  )
  const characterSuggestions = useMemo(
    () => collectCharacterSuggestions(project),
    [project],
  )
  const characterStats = useMemo(() => buildCharacterStats(project), [project])
  const dialogueDistribution = useMemo(() => buildDialogueDistribution(project), [project])
  const dialoguePieSegments = useMemo(() => {
    let offset = 25
    return dialogueDistribution.map((entry, index) => {
      const segment = {
        ...entry,
        offset,
        color: ['#f5f5f5', '#bdbdbd', '#8c8c8c', '#666666', '#a3a3a3'][index % 5],
      }
      offset -= entry.percent
      return segment
    })
  }, [dialogueDistribution])
  const resolvedCharacterName = selectedCharacterName || characterSuggestions[0] || ''
  const selectedCharacterProfile = resolvedCharacterName
    ? project.characters?.profiles[resolvedCharacterName]
    : null
  const selectedCharacterStats = resolvedCharacterName
    ? characterStats[resolvedCharacterName]
    : null
  const smartTypeOptions = useMemo(() => buildSmartTypeOptions(project), [project])
  const smartTypeGroups = useMemo(
    () => [
      { label: 'Characters', values: smartTypeOptions.characters },
      {
        label: 'Locations',
        values: smartTypeOptions.locations.map((location) => `INT. ${location} - DAY`),
      },
      { label: 'Times', values: smartTypeOptions.timesOfDay },
      { label: 'Transitions', values: smartTypeOptions.transitions },
      { label: 'Shots', values: smartTypeOptions.shots },
      { label: 'Extensions', values: smartTypeOptions.extensions.map((entry) => `(${entry})`) },
    ],
    [smartTypeOptions],
  )
  const detectedCatalog = useMemo(() => detectCatalogEntries(project), [project])
  const printLayout = useMemo(() => paginateProjectForPrint(project), [project])
  const previewPages = printLayout.pages
  const editorPages = useMemo(
    () => paginateBlocksForEditor(project, printLayout),
    [project, printLayout],
  )
  const blockIndexById = useMemo(
    () => new Map(project.blocks.map((block, index) => [block.id, index])),
    [project.blocks],
  )
  const previewPageCount = previewPages.length
  const resolvedPreviewPageIndex = Math.min(
    previewPageIndex,
    Math.max(previewPageCount - 1, 0),
  )
  const previewPage = previewPages[resolvedPreviewPageIndex] ?? null
  const continuousDraftText = useMemo(
    () => toContinuousDraftText(project.blocks),
    [project.blocks],
  )

  const sceneById = useMemo(
    () => new Map(scenes.map((scene) => [scene.blockId, scene.heading])),
    [scenes],
  )

  const sceneNumberById = useMemo(
    () => new Map(scenes.map((scene, index) => [scene.blockId, index + 1])),
    [scenes],
  )
  const sceneNumberLabelById = useMemo(
    () =>
      new Map(
        scenes.map((scene, index) => [
          scene.blockId,
          project.advanced.sceneNumbering.numbers[scene.blockId] ?? String(index + 1),
        ]),
      ),
    [project.advanced.sceneNumbering.numbers, scenes],
  )

  const resolvedSelectedSceneId =
    selectedSceneId && scenes.some((scene) => scene.blockId === selectedSceneId)
      ? selectedSceneId
      : scenes[0]?.blockId ?? null

  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.blockId === resolvedSelectedSceneId) ?? null,
    [resolvedSelectedSceneId, scenes],
  )
  const selectedSceneDevelopment = resolvedSelectedSceneId
    ? storyState.sceneMeta[resolvedSelectedSceneId]
    : null
  const selectedSceneNote =
    resolvedSelectedSceneId ? storyState.notes.scenes[resolvedSelectedSceneId] ?? '' : ''
  const selectedSceneShotRows = useMemo(
    () => buildShotListRows(project, resolvedSelectedSceneId ?? undefined),
    [project, resolvedSelectedSceneId],
  )
  const selectedBreakdownSheet = useMemo(
    () => buildBreakdownSheet(project, resolvedSelectedSceneId),
    [project, resolvedSelectedSceneId],
  )

  const selectedBlock = useMemo(
    () => project.blocks.find((block) => block.id === selectedBlockId) ?? null,
    [project.blocks, selectedBlockId],
  )

  const filteredScenes = useMemo(() => {
    const query = sceneFilterQuery.trim().toLowerCase()
    if (!query) {
      return scenes
    }

    return scenes.filter((scene) => {
      const sceneNumber = String(sceneNumberById.get(scene.blockId) ?? '')
      return (
        scene.heading.toLowerCase().includes(query) ||
        sceneNumber.includes(query)
      )
    })
  }, [sceneFilterQuery, sceneNumberById, scenes])

  const activeBlockId = selectedBlock?.id ?? project.blocks[0]?.id ?? null
  const activeEditorBlock = selectedBlock ?? project.blocks[0] ?? null
  const activeBlockIndex = activeBlockId
    ? project.blocks.findIndex((block) => block.id === activeBlockId)
    : -1
  const screenplayElementShortcuts = useMemo(
    () =>
      shortcutBlockTypes.map((type) => ({
        type,
        shortcut:
          project.advanced.editor.shortcuts[type] ??
          defaultScreenplayShortcuts[type] ??
          '',
      })),
    [project.advanced.editor.shortcuts],
  )

  const activeCharacterSuggestions = useMemo(() => {
    if (!selectedBlock || selectedBlock.type !== 'character') {
      return [] as string[]
    }

    const query = selectedBlock.text.trim().toUpperCase()
    return characterSuggestions
      .filter((name) => name !== query)
      .filter((name) => (query ? name.includes(query) : true))
      .slice(0, 8)
  }, [characterSuggestions, selectedBlock])

  const snapshotOptions = useMemo<SnapshotOption[]>(
    () =>
      project.revisionSnapshots.map((snapshot) => ({
        id: snapshot.id,
        label: snapshot.label,
        createdAt: snapshot.createdAt,
        blockCount: snapshot.blocks.length,
      })),
    [project.revisionSnapshots],
  )

  const selectedSnapshot = useMemo<RevisionSnapshot | null>(() => {
    if (!selectedSnapshotId) {
      return project.revisionSnapshots[0] ?? null
    }

    return (
      project.revisionSnapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ??
      project.revisionSnapshots[0] ??
      null
    )
  }, [project.revisionSnapshots, selectedSnapshotId])

  const selectedSnapshotDiff = useMemo(
    () =>
      selectedSnapshot
        ? summarizeRevisionSnapshotDiff(selectedSnapshot, project.blocks)
        : null,
    [project.blocks, selectedSnapshot],
  )

  const selectedSnapshotCompareRows = useMemo<SnapshotCompareRow[]>(() => {
    if (!selectedSnapshot) {
      return []
    }

    const currentById = new Map(project.blocks.map((block) => [block.id, block]))
    const rows: SnapshotCompareRow[] = []

    for (const snapshotBlock of selectedSnapshot.blocks) {
      const currentBlock = currentById.get(snapshotBlock.id)
      if (!currentBlock) {
        rows.push({
          id: `removed-${snapshotBlock.id}`,
          status: 'removed',
          snapshotText: formatBlockPreview(snapshotBlock),
          currentText: '—',
        })
        continue
      }

      const unchanged =
        currentBlock.type === snapshotBlock.type &&
        currentBlock.text === snapshotBlock.text &&
        currentBlock.revision === snapshotBlock.revision

      rows.push({
        id: `match-${snapshotBlock.id}`,
        status: unchanged ? 'unchanged' : 'changed',
        snapshotText: formatBlockPreview(snapshotBlock),
        currentText: formatBlockPreview(currentBlock),
      })

      currentById.delete(snapshotBlock.id)
    }

    for (const addedBlock of currentById.values()) {
      rows.push({
        id: `added-${addedBlock.id}`,
        status: 'added',
        snapshotText: '—',
        currentText: formatBlockPreview(addedBlock),
      })
    }

    return rows.slice(0, 80)
  }, [project.blocks, selectedSnapshot])

  const findMatches = useMemo<FindMatch[]>(() => {
    const trimmedQuery = findQuery.trim()
    if (!trimmedQuery) {
      return []
    }

    const matches: FindMatch[] = []

    for (const block of project.blocks) {
      const regex = buildFindRegex(trimmedQuery, findCaseSensitive, true)
      let match = regex.exec(block.text)

      while (match) {
        const matchedText = match[0] ?? ''
        const start = Math.max(0, match.index - 20)
        const end = Math.min(block.text.length, match.index + matchedText.length + 30)
        const prefix = start > 0 ? '...' : ''
        const suffix = end < block.text.length ? '...' : ''
        const preview = `${prefix}${block.text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`

        matches.push({
          blockId: block.id,
          blockType: block.type,
          matchText: matchedText,
          index: match.index,
          preview,
        })

        if (matchedText.length === 0) {
          regex.lastIndex += 1
        }

        match = regex.exec(block.text)
      }
    }

    return matches
  }, [findCaseSensitive, findQuery, project.blocks])

  const revisionCounts = useMemo(() => {
    const counts = revisionColors.reduce(
      (accumulator, color) => {
        accumulator[color] = 0
        return accumulator
      },
      {} as Record<RevisionColor, number>,
    )

    for (const block of project.blocks) {
      if (block.revision) {
        counts[block.revision] += 1
      }
    }

    return counts
  }, [project.blocks])

  const searchHits = useMemo(() => {
    const normalizedQuery = commandQuery.trim().toLowerCase()
    const commandHits: SearchHit[] = [
      {
        id: 'command-import-fdx',
        label: 'Import FDX',
        detail: 'Import Final Draft screenplay (.fdx)',
        typeLabel: 'Command',
        targetTab: 'draft',
      },
      {
        id: 'command-import-fountain',
        label: 'Import Fountain',
        detail: 'Import screenplay from Fountain (.fountain)',
        typeLabel: 'Command',
        targetTab: 'draft',
      },
      {
        id: 'command-export-fdx',
        label: 'Export FDX',
        detail: 'Export current screenplay as Final Draft (.fdx)',
        typeLabel: 'Command',
        targetTab: 'draft',
      },
      {
        id: 'command-import-docx',
        label: 'Import DOCX',
        detail: 'Import screenplay from Word document (.docx)',
        typeLabel: 'Command',
        targetTab: 'draft',
      },
      {
        id: 'command-export-docx',
        label: 'Export DOCX',
        detail: 'Export screenplay as Word document (.docx)',
        typeLabel: 'Command',
        targetTab: 'draft',
      },
      {
        id: 'command-export-pdf',
        label: 'Export PDF',
        detail: 'Export screenplay as PDF document (.pdf)',
        typeLabel: 'Command',
        targetTab: 'draft',
      },
      {
        id: 'command-open-preview',
        label: 'Open Print Preview',
        detail: 'Review paginated screenplay pages before export',
        typeLabel: 'Command',
        targetTab: 'preview',
      },
      {
        id: 'command-print-preview',
        label: 'Print Screenplay',
        detail: 'Open browser print preview for all screenplay pages',
        typeLabel: 'Command',
        targetTab: 'preview',
      },
      {
        id: 'command-find-replace',
        label: 'Find and Replace',
        detail: 'Find text across screenplay blocks and replace matches',
        typeLabel: 'Command',
        targetTab: 'draft',
      },
      {
        id: 'command-toggle-theme',
        label: 'Toggle Theme',
        detail: 'Switch between dark and light workspace themes',
        typeLabel: 'Command',
        targetTab: activeTab,
      },
      {
        id: 'command-export-character-report',
        label: 'Export Character Report',
        detail: 'Export character and dialogue usage report (.txt)',
        typeLabel: 'Command',
        targetTab: 'production',
      },
      {
        id: 'command-save-snapshot',
        label: 'Save Revision Snapshot',
        detail: 'Capture current screenplay blocks as a revision checkpoint',
        typeLabel: 'Command',
        targetTab: 'draft',
      },
      {
        id: 'command-open-snapshot-history',
        label: 'Open Snapshot History',
        detail: `Review and restore revision snapshots (${project.revisionSnapshots.length})`,
        typeLabel: 'Command',
        targetTab: 'draft',
      },
      {
        id: 'command-open-productivity',
        label: 'Open Productivity',
        detail: 'Open focus modes, sprint timer, goals, streaks, and TTS read-through',
        typeLabel: 'Command',
        targetTab: 'productivity',
      },
    ]

    const filteredCommandHits = commandHits.filter((hit) => {
      if (!normalizedQuery) {
        return true
      }

      const searchable = `${hit.label} ${hit.detail} ${hit.typeLabel}`.toLowerCase()
      return searchable.includes(normalizedQuery)
    })

    const allHits: SearchHit[] = []

    const includeHit = (hit: SearchHit) => {
      if (!normalizedQuery) {
        allHits.push(hit)
        return
      }

      const searchable = `${hit.label} ${hit.detail} ${hit.typeLabel}`.toLowerCase()
      if (searchable.includes(normalizedQuery)) {
        allHits.push(hit)
      }
    }

    scenes.forEach((scene, index) => {
      includeHit({
        id: `scene-${scene.blockId}`,
        label: `S${index + 1} - ${scene.heading}`,
        detail: 'Jump to screenplay scene heading',
        typeLabel: 'Scene',
        targetTab: 'draft',
        sceneId: scene.blockId,
        focusId: scene.blockId,
      })
    })

    project.cards.forEach((card, index) => {
      includeHit({
        id: `card-${card.id}`,
        label: card.title || `Beat ${index + 1}`,
        detail: card.beat || 'Open beat card in planning board',
        typeLabel: 'Beat',
        targetTab: 'planning',
        sceneId: card.linkedSceneId,
        focusId: card.id,
      })
    })

    project.catalog.forEach((entry) => {
      includeHit({
        id: `catalog-${entry.id}`,
        label: entry.name || 'Unnamed catalog entry',
        detail: entry.notes || `Catalog: ${entry.kind}`,
        typeLabel: entry.kind === 'character' ? 'Character' : 'Location',
        targetTab: 'catalog',
        focusId: entry.id,
      })
    })

    project.production.schedule.forEach((entry) => {
      includeHit({
        id: `schedule-${entry.id}`,
        label: `Day ${entry.day} - ${entry.location || 'No location'}`,
        detail:
          entry.sceneId && sceneById.has(entry.sceneId)
            ? sceneById.get(entry.sceneId) ?? ''
            : 'Unassigned scene',
        typeLabel: 'Schedule',
        targetTab: 'production',
        sceneId: entry.sceneId,
        focusId: entry.id,
      })
    })

    const remainingSlots = Math.max(0, 60 - filteredCommandHits.length)
    return [...filteredCommandHits, ...allHits.slice(0, remainingSlots)]
  }, [
    activeTab,
    commandQuery,
    project.cards,
    project.catalog,
    project.revisionSnapshots.length,
    project.production.schedule,
    sceneById,
    scenes,
  ])

  const commandResults = useMemo<CommandResult[]>(
    () =>
      searchHits.map((hit) => ({
        id: hit.id,
        label: hit.label,
        detail: hit.detail,
        typeLabel: hit.typeLabel,
      })),
    [searchHits],
  )

  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const continuousDraftRef = useRef<HTMLTextAreaElement | null>(null)
  const itemRefs = useRef<Record<string, HTMLElement | null>>({})
  const pendingFocusId = useRef<string | null>(null)
  const pendingBlockSelection = useRef<QueuedSelection | null>(null)
  const pendingContinuousCursor = useRef<number | null>(null)
  const pendingScrollId = useRef<string | null>(null)
  const autoFocusedProjectId = useRef<string | null>(null)
  const applyingCollaborationProjectRef = useRef(false)
  const lastAutoConnectRef = useRef<{ projectId: string; roomId: string } | null>(null)
  const autoConnectCollaborationRef = useRef<
    (targetProject: ScriptProject, projectPath?: string) => Promise<void>
  >(async () => undefined)
  const collaborationBootstrapAbortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const findInputRef = useRef<HTMLInputElement | null>(null)
  const keyboardActionsRef = useRef<{
    saveProject: () => Promise<void>
    openProject: () => Promise<void>
    createNewProject: () => void
  }>({
    saveProject: async () => {
      return Promise.resolve()
    },
    openProject: async () => {
      return Promise.resolve()
    },
    createNewProject: () => {
      return
    },
  })

  const persistProjectImmediately = useCallback(async (targetProject: ScriptProject) => {
    if (window.masterscript) {
      await window.masterscript.autosave(targetProject)
    } else {
      localStorage.setItem(autosaveKey, JSON.stringify(targetProject))
    }
    writeRecentProjectSnapshot(targetProject)
  }, [])

  const persistProjectToKnownPath = useCallback(
    async (targetProject: ScriptProject, explicitPath = savedPath) => {
      if (
        !window.masterscript?.saveProjectPath ||
        !isLikelyLocalProjectPath(explicitPath)
      ) {
        return
      }

      await window.masterscript.saveProjectPath(explicitPath, targetProject)
    },
    [savedPath],
  )

  const applyRemoteCollaborationProject = useCallback((remoteProject: ScriptProject) => {
    const hydrated = hydrateProject(remoteProject)
    applyingCollaborationProjectRef.current = true
    setHistory({ past: [], present: hydrated, future: [] })
    setStatusMessage('Collaboration update received')
  }, [])

  const applyLocalCollaborationProject = useCallback((updatedProject: ScriptProject) => {
    const hydrated = hydrateProject(updatedProject)
    applyingCollaborationProjectRef.current = true
    setHistory((previous) => ({
      ...previous,
      present: hydrated,
    }))
    writeRecentProjectSnapshot(hydrated)
  }, [])

  const collaboration = useCollaborationSession({
    onRemoteProject: applyRemoteCollaborationProject,
    onLocalProjectUpdated: applyLocalCollaborationProject,
    autosaveProject: persistProjectImmediately,
  })

  const autoConnectCollaboration = useCallback(
    async (targetProject: ScriptProject, projectPath?: string) => {
      const roomId = targetProject.meta.collaborationRoomId?.trim()
      const inviteKey = targetProject.meta.collaborationInviteKey?.trim()
      if (!roomId || !inviteKey) {
        return
      }

      const previous = lastAutoConnectRef.current
      if (previous?.projectId === targetProject.id && previous.roomId === roomId) {
        return
      }
      lastAutoConnectRef.current = { projectId: targetProject.id, roomId }

      try {
        setStatusMessage('Reconnecting collaboration room...')
        const mode = targetProject.meta.collaborationMode ?? 'webrtc'
        const result =
          mode === 'lan'
            ? isHostedLanRoom(roomId)
              ? await collaboration.startLanHost(targetProject, { background: true })
              : await collaboration.joinLan(
                  targetProject,
                  targetProject.meta.collaborationLanServerUrl ?? '',
                  roomId,
                  inviteKey,
                  { background: true },
                )
            : await collaboration.startWebRtc(targetProject, roomId, inviteKey, {
                background: true,
              })

        if (result.sessionInfo.mode === 'lan-host') {
          rememberHostedLanRoom(result.sessionInfo.roomId)
        }
        await persistProjectToKnownPath(result.project, projectPath)
        setStatusMessage(`Collaboration room active: ${result.sessionInfo.roomId}`)
      } catch (error) {
        lastAutoConnectRef.current = null
        setStatusMessage(
          error instanceof Error
            ? error.message
            : 'Collaboration auto-connect failed; local editing is still available',
        )
      }
    },
    [collaboration, persistProjectToKnownPath],
  )

  useEffect(() => {
    autoConnectCollaborationRef.current = autoConnectCollaboration
  }, [autoConnectCollaboration])

  const currentCollaborationInvite = useMemo(() => {
    if (collaboration.sessionInfo) {
      const mode =
        collaboration.sessionInfo.mode === 'lan-host' ||
        collaboration.sessionInfo.mode === 'lan-join'
          ? 'lan'
          : 'webrtc'

      try {
        return buildCollaborationInvite({
          mode,
          roomId: collaboration.sessionInfo.roomId,
          inviteKey: collaboration.sessionInfo.inviteCode,
          lanServerUrl:
            mode === 'lan'
              ? collaboration.sessionInfo.serverUrl || project.meta.collaborationLanServerUrl
              : undefined,
        })
      } catch {
        return ''
      }
    }

    try {
      return buildProjectCollaborationInvite(project)
    } catch {
      return ''
    }
  }, [collaboration.sessionInfo, project])

  const focusQueuedBlock = useCallback(() => {
    const focusId = pendingFocusId.current
    if (!focusId) {
      return
    }

    const node = textareaRefs.current[focusId]
    if (!node) {
      return
    }

    const selection =
      pendingBlockSelection.current?.id === focusId
        ? pendingBlockSelection.current
        : null
    const start = selection ? Math.min(selection.start, node.value.length) : node.value.length
    const end = selection ? Math.min(selection.end, node.value.length) : start

    node.focus()
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    node.setSelectionRange(start, end)
    pendingFocusId.current = null
    pendingBlockSelection.current = null
  }, [])

  const queueFocus = useCallback(
    (id: string, selection?: Omit<QueuedSelection, 'id'>) => {
      pendingFocusId.current = id
      pendingBlockSelection.current = selection ? { id, ...selection } : null
      setHighlightedId(id)
      window.requestAnimationFrame(focusQueuedBlock)
    },
    [focusQueuedBlock],
  )

  const queueScroll = (id: string) => {
    pendingScrollId.current = id
    setHighlightedId(id)
  }

  const pushRecentProject = (
    label: string,
    source: RecentProjectEntry['source'],
    projectId?: string,
  ) => {
    const cleaned = label.trim()
    if (!cleaned) {
      return
    }

    setRecentProjects((previous) => {
      const nextItem: RecentProjectEntry = {
        label: cleaned,
        source,
        projectId,
        updatedAt: new Date().toISOString(),
      }

      const deduped = previous.filter((entry) =>
        projectId ? entry.projectId !== projectId : entry.label !== cleaned,
      )
      return [nextItem, ...deduped].slice(0, 8)
    })
  }

  const commit = (
    updater: (draft: ScriptProject) => void,
    nextStatus = 'Project updated',
  ) => {
    setHistory((previous) => {
      const nextProject = cloneProject(previous.present)
      updater(nextProject)
      nextProject.meta.updatedAt = new Date().toISOString()
      return {
        past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
        present: nextProject,
        future: [],
      }
    })
    setStatusMessage(nextStatus)
  }

  const undo = () => {
    setHistory((previous) => {
      if (previous.past.length === 0) {
        return previous
      }

      const prior = previous.past[previous.past.length - 1]
      return {
        past: previous.past.slice(0, -1),
        present: prior,
        future: [previous.present, ...previous.future],
      }
    })
    setStatusMessage('Undid latest change')
  }

  const redo = () => {
    setHistory((previous) => {
      if (previous.future.length === 0) {
        return previous
      }

      const upcoming = previous.future[0]
      return {
        past: [...previous.past, previous.present],
        present: upcoming,
        future: previous.future.slice(1),
      }
    })
    setStatusMessage('Redid change')
  }

  useEffect(() => {
    let active = true

    const restoreAutosave = async () => {
      try {
        if (window.masterscript) {
          const result = await window.masterscript.readAutosave()
          if (active && result.ok && result.project) {
            const recovered = hydrateProject(result.project)
            setHistory({ past: [], present: recovered, future: [] })
            setStatusMessage('Recovered desktop autosave')
            setAutosaveState('saved')
            void autoConnectCollaborationRef.current(recovered)
          }
          return
        }

        const raw = localStorage.getItem(autosaveKey)
        if (!raw) {
          return
        }

        const parsed = JSON.parse(raw) as unknown
        if (active && isScriptProject(parsed)) {
          const recovered = hydrateProject(parsed)
          setHistory({ past: [], present: recovered, future: [] })
          setStatusMessage('Recovered browser autosave')
          setAutosaveState('saved')
          void autoConnectCollaborationRef.current(recovered)
        }
      } catch {
        if (active) {
          setStatusMessage('Autosave recovery skipped due to parse issue')
          setAutosaveState('error')
        }
      }
    }

    void restoreAutosave()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    try {
      localStorage.setItem(themeKey, themeMode)
    } catch {
      // Ignore persistence errors and keep in-memory theme preference.
    }
  }, [themeMode])

  useEffect(() => {
    try {
      localStorage.setItem(recentProjectsKey, JSON.stringify(recentProjects))
    } catch {
      // Ignore recent project persistence failures.
    }
  }, [recentProjects])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const persist = async () => {
        try {
          setAutosaveState('saving')
          if (window.masterscript) {
            await window.masterscript.autosave(project)
            if (
              window.masterscript.saveProjectPath &&
              isLikelyLocalProjectPath(savedPath)
            ) {
              await window.masterscript.saveProjectPath(savedPath, project)
            }
          } else {
            localStorage.setItem(autosaveKey, JSON.stringify(project))
          }
          writeRecentProjectSnapshot(project)
          setAutosaveState('saved')
        } catch {
          setAutosaveState('error')
          setStatusMessage('Autosave failed')
        }
      }

      void persist()
    }, 220)

    return () => {
      window.clearTimeout(timer)
    }
  }, [project, savedPath])

  useEffect(() => {
    if (!collaboration.isActive) {
      return
    }

    if (applyingCollaborationProjectRef.current) {
      applyingCollaborationProjectRef.current = false
      return
    }

    collaboration.syncProject(project)
  }, [collaboration, project])

  useEffect(() => {
    focusQueuedBlock()

    if (useContinuousDraftEditor) {
      pendingFocusId.current = null
      pendingBlockSelection.current = null
    }
  }, [focusQueuedBlock, project.blocks])

  useEffect(() => {
    if (appView !== 'workspace' || activeTab !== 'draft') {
      return
    }

    const firstBlock = project.blocks[0]
    if (!firstBlock || autoFocusedProjectId.current === project.id) {
      return
    }

    autoFocusedProjectId.current = project.id
    setSelectedBlockId(firstBlock.id)
    if (firstBlock.type === 'scene-heading') {
      setSelectedSceneId(firstBlock.id)
    }
    queueFocus(firstBlock.id, { start: 0, end: 0 })
  }, [activeTab, appView, project.blocks, project.id, queueFocus])

  useEffect(() => {
    if (pendingContinuousCursor.current === null) {
      return
    }

    const node = continuousDraftRef.current
    if (!node) {
      return
    }

    const cursor = Math.min(pendingContinuousCursor.current, node.value.length)
    node.focus()
    node.setSelectionRange(cursor, cursor)
    pendingContinuousCursor.current = null
  }, [continuousDraftText])

  useEffect(() => {
    if (!pendingScrollId.current) {
      return
    }

    const node = itemRefs.current[pendingScrollId.current]
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      pendingScrollId.current = null
    }
  }, [
    activeTab,
    project.cards,
    project.catalog,
    project.production.schedule,
    project.storyboards,
  ])

  useEffect(() => {
    if (!highlightedId) {
      return
    }

    const timer = window.setTimeout(() => {
      setHighlightedId(null)
    }, 1600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [highlightedId])

  useEffect(() => {
    if (!isFindReplaceOpen) {
      return
    }

    window.requestAnimationFrame(() => {
      findInputRef.current?.focus()
      findInputRef.current?.select()
    })
  }, [isFindReplaceOpen])

  useEffect(() => {
    if (!isFindReplaceOpen) {
      return
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsFindReplaceOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isFindReplaceOpen])

  useEffect(() => {
    if (!isSnapshotHistoryOpen) {
      return
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsSnapshotHistoryOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isSnapshotHistoryOpen])

  const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const title = event.target.value
    commit((draft) => {
      draft.meta.title = title
    }, 'Project title updated')
  }

  const updatePrintMetaText = (
    key: 'author' | 'contact' | 'draftDate' | 'credits' | 'titlePageNotes',
    value: string,
    historyLabel: string,
  ) => {
    commit((draft) => {
      draft.meta[key] = value
    }, historyLabel)
  }

  const updatePrintMetaFlag = (
    key: 'includeTitlePage' | 'showPageNumbers' | 'showSceneNumbers',
    value: boolean,
    historyLabel: string,
  ) => {
    commit((draft) => {
      draft.meta[key] = value
    }, historyLabel)
  }

  const onContinuousDraftChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value
    commit((draft) => {
      const previousById = new Map(draft.blocks.map((block) => [block.id, block]))
      const parsedBlocks = parseContinuousDraftText(value, draft.blocks)
      draft.blocks = parsedBlocks.map((block) => {
        const previous = previousById.get(block.id)
        if (previous?.locked) {
          return previous
        }

        if (
          draft.meta.revisionMode &&
          (!previous || previous.text !== block.text || previous.type !== block.type)
        ) {
          return {
            ...block,
            revision: draft.meta.activeRevision,
            revisionMark: true,
          }
        }

        return block
      })
    })
  }

  const cycleContinuousEnterType = (direction: 1 | -1) => {
    const currentIndex = blockTypeOrder.indexOf(continuousEnterType)
    const nextIndex =
      (currentIndex + direction + blockTypeOrder.length) % blockTypeOrder.length
    const nextType = blockTypeOrder[nextIndex]
    setContinuousEnterType(nextType)
    setStatusMessage(`Enter now inserts ${blockTypeLabels[nextType]}`)
  }

  const insertContinuousTemplateAtCursor = (
    textarea: HTMLTextAreaElement,
    type: BlockType,
  ) => {
    const source = textarea.value
    const start = textarea.selectionStart ?? source.length
    const end = textarea.selectionEnd ?? start
    const before = source.slice(0, start)
    const after = source.slice(end)
    const template = getContinuousInsertTemplate(type)

    const separatorBefore =
      before.length === 0 ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const separatorAfter =
      after.length === 0 ? '' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'

    const inserted = `${separatorBefore}${template}${separatorAfter}`
    const nextText = `${before}${inserted}${after}`
    const nextCursor = before.length + separatorBefore.length + template.length

    pendingContinuousCursor.current = nextCursor
    commit((draft) => {
      draft.blocks = parseContinuousDraftText(nextText, draft.blocks)
    }, `Inserted ${blockTypeLabels[type]} line`)
  }

  const insertContinuousTextAtCursor = (text: string) => {
    const textarea = continuousDraftRef.current
    if (!textarea) {
      return
    }

    const source = textarea.value
    const start = textarea.selectionStart ?? source.length
    const end = textarea.selectionEnd ?? start
    const before = source.slice(0, start)
    const after = source.slice(end)
    const nextText = `${before}${text}${after}`
    pendingContinuousCursor.current = start + text.length

    commit((draft) => {
      draft.blocks = parseContinuousDraftText(nextText, draft.blocks)
    }, `Inserted SmartType: ${text}`)
  }

  const onContinuousDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const withMod = event.ctrlKey || event.metaKey

    if (withMod && /^[1-8]$/.test(event.key)) {
      event.preventDefault()
      const index = Number(event.key) - 1
      const nextType = blockTypeOrder[index]
      if (nextType) {
        setContinuousEnterType(nextType)
        setStatusMessage(`Enter now inserts ${blockTypeLabels[nextType]}`)
      }
      return
    }

    if (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      cycleContinuousEnterType(event.key === 'ArrowDown' ? 1 : -1)
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      cycleContinuousEnterType(event.shiftKey ? -1 : 1)
      return
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      insertContinuousTemplateAtCursor(event.currentTarget, continuousEnterType)
    }
  }

  const onBlockTextChange = (blockId: string, text: string) => {
    const result = updateBlockTextWithRevisionTracking(project, blockId, text)
    if (result.blocked) {
      setStatusMessage('Locked scene or page prevented edit')
      return
    }

    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: {
        ...result.project,
        meta: {
          ...result.project.meta,
          updatedAt: new Date().toISOString(),
        },
      },
      future: [],
    }))
    setStatusMessage('Project updated')
  }

  const getTextareaSelection = (
    textarea: HTMLTextAreaElement,
  ): Omit<QueuedSelection, 'id'> => ({
    start: textarea.selectionStart ?? textarea.value.length,
    end: textarea.selectionEnd ?? textarea.value.length,
  })

  const onBlockTypeChange = (
    blockId: string,
    type: BlockType,
    selection?: Omit<QueuedSelection, 'id'>,
  ) => {
    setSelectedBlockId(blockId)
    if (type === 'scene-heading') {
      setSelectedSceneId(blockId)
    }
    queueFocus(blockId, selection)
    commit((draft) => {
      const target = draft.blocks.find((block) => block.id === blockId)
      if (target) {
        target.type = type
      }
    }, `Changed block to ${blockTypeLabels[type]}`)
  }

  const addBlockAfter = (index: number, type: BlockType) => {
    const newBlock = createBlock(type)
    if (type === 'scene-heading') {
      setSelectedSceneId(newBlock.id)
    }
    setSelectedBlockId(newBlock.id)
    queueFocus(newBlock.id)
    commit((draft) => {
      draft.blocks.splice(index + 1, 0, newBlock)
    }, `Inserted ${blockTypeLabels[type]}`)
  }

  const removeBlock = (blockId: string) => {
    commit((draft) => {
      if (draft.blocks.length === 1) {
        return
      }

      const idx = draft.blocks.findIndex((block) => block.id === blockId)
      if (idx >= 0) {
        draft.blocks.splice(idx, 1)
      }
    }, 'Removed block')
  }

  const setEditorShortcut = (type: BlockType, shortcut: string) => {
    commit((draft) => {
      draft.advanced.editor.shortcuts[type] = shortcut
    }, `Updated ${blockTypeLabels[type]} shortcut`)
  }

  const captureEditorShortcut = (
    event: KeyboardEvent<HTMLInputElement>,
    type: BlockType,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    if (event.key === 'Escape') {
      event.currentTarget.blur()
      return
    }

    const shortcut = shortcutFromKeyEvent(event)
    if (!shortcut) {
      setStatusMessage('Use a modifier combo like Ctrl+Alt+1, or a function key')
      return
    }

    setEditorShortcut(type, shortcut)
  }

  const resetEditorShortcuts = () => {
    commit((draft) => {
      draft.advanced.editor.shortcuts = { ...defaultScreenplayShortcuts }
    }, 'Reset screenplay shortcuts')
  }

  const onBlockDrop = (targetBlockId: string) => {
    if (!draggingBlockId || draggingBlockId === targetBlockId) {
      return
    }

    commit((draft) => {
      draft.blocks = reorderById(draft.blocks, draggingBlockId, targetBlockId)
    }, 'Reordered screenplay blocks')
    setDraggingBlockId(null)
  }

  const onBlockKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
    index: number,
    blockId: string,
    blockType: BlockType,
  ) => {
    const eventShortcut = shortcutFromKeyEvent(event)
    const shortcut = screenplayElementShortcuts.find(
      (item) =>
        eventShortcut !== null &&
        shortcutSignature(item.shortcut) === shortcutSignature(eventShortcut),
    )
    if (shortcut) {
      event.preventDefault()
      onBlockTypeChange(
        blockId,
        shortcut.type,
        getTextareaSelection(event.currentTarget),
      )
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      const nextType = cycleScreenplayBlockType(
        blockType,
        event.shiftKey ? -1 : 1,
      )
      onBlockTypeChange(
        blockId,
        nextType,
        getTextareaSelection(event.currentTarget),
      )
      return
    }

    if (
      event.key === 'Backspace' &&
      event.currentTarget.value.length === 0 &&
      project.blocks.length > 1
    ) {
      event.preventDefault()
      const nextFocusBlock =
        project.blocks[index - 1] ?? project.blocks[index + 1] ?? null
      if (nextFocusBlock) {
        setSelectedBlockId(nextFocusBlock.id)
        if (nextFocusBlock.type === 'scene-heading') {
          setSelectedSceneId(nextFocusBlock.id)
        }
        queueFocus(nextFocusBlock.id)
      }
      removeBlock(blockId)
      return
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      addBlockAfter(index, nextTypeForEnter(blockType))
    }
  }

  const toggleRevisionMode = () => {
    commit((draft) => {
      draft.meta.revisionMode = !draft.meta.revisionMode
    }, 'Toggled revision mode')
  }

  const markRevision = (blockId: string) => {
    if (!project.meta.revisionMode) {
      return
    }

    commit((draft) => {
      const target = draft.blocks.find((block) => block.id === blockId)
      if (target) {
        target.revision = draft.meta.activeRevision
      }
    }, 'Marked revision')
  }

  const setActiveRevisionColor = (color: RevisionColor) => {
    commit((draft) => {
      draft.meta.activeRevision = color
    }, `Active revision color set to ${color}`)
  }

  const clearRevisionColor = (color: RevisionColor) => {
    commit((draft) => {
      for (const block of draft.blocks) {
        if (block.revision === color) {
          block.revision = null
          block.revisionMark = false
        }
      }
    }, `Cleared ${color} revisions`)
  }

  const beginRevisionSet = () => {
    const nextProject = beginNextRevisionSet(project)
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: {
        ...nextProject,
        meta: {
          ...nextProject.meta,
          updatedAt: new Date().toISOString(),
        },
      },
      future: [],
    }))
    setStatusMessage(`Started ${nextProject.meta.activeRevision} revision set`)
  }

  const lockSelectedScene = () => {
    if (!resolvedSelectedSceneId) {
      setStatusMessage('Select a scene before locking')
      return
    }

    const nextProject = lockScene(project, resolvedSelectedSceneId)
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: nextProject,
      future: [],
    }))
    setStatusMessage('Locked selected scene')
  }

  const unlockSelectedScene = () => {
    if (!resolvedSelectedSceneId) {
      setStatusMessage('Select a scene before unlocking')
      return
    }

    const nextProject = unlockScene(project, resolvedSelectedSceneId)
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: nextProject,
      future: [],
    }))
    setStatusMessage('Unlocked selected scene')
  }

  const omitSelectedScene = () => {
    if (!resolvedSelectedSceneId) {
      setStatusMessage('Select a scene before omitting')
      return
    }

    const nextProject = omitScene(project, resolvedSelectedSceneId)
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: nextProject,
      future: [],
    }))
    setStatusMessage('Omitted selected scene')
  }

  const unomitSelectedScene = () => {
    if (!resolvedSelectedSceneId) {
      setStatusMessage('Select a scene before un-omitting')
      return
    }

    const nextProject = unomitScene(project, resolvedSelectedSceneId)
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: nextProject,
      future: [],
    }))
    setStatusMessage('Un-omitted selected scene')
  }

  const stashContinuousSelection = () => {
    const textarea = continuousDraftRef.current
    const selectedText = textarea?.value.slice(
      textarea.selectionStart ?? 0,
      textarea.selectionEnd ?? 0,
    )

    if (!selectedText?.trim()) {
      setStatusMessage('Highlight dialogue text before stashing')
      return
    }

    const target = project.blocks.find(
      (block) => block.type === 'dialogue' && block.text.includes(selectedText),
    )

    if (!target) {
      setStatusMessage('Highlighted text must belong to a dialogue block')
      return
    }

    const start = target.text.indexOf(selectedText)
    const stashed = stashDialogueSelection(
      project,
      target.id,
      start,
      start + selectedText.length,
      'Stashed alternate',
    )
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: stashed.project,
      future: [],
    }))
    setStatusMessage('Stashed selected dialogue')
  }

  const swapStashIntoFirstDialogue = (stashId: string) => {
    const target = project.blocks.find((block) => block.type === 'dialogue')
    if (!target) {
      setStatusMessage('No dialogue block available for stash swap')
      return
    }

    const nextProject = swapStashIntoDialogue(project, stashId, target.id)
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: nextProject,
      future: [],
    }))
    setStatusMessage('Swapped stashed dialogue into script')
  }

  const saveRevisionSnapshot = () => {
    const snapshot = createRevisionSnapshot(project)
    commit((draft) => {
      draft.revisionSnapshots = [snapshot, ...draft.revisionSnapshots].slice(0, 60)
    }, `Saved snapshot "${snapshot.label}"`)
    setSelectedSnapshotId(snapshot.id)
  }

  const openSnapshotHistory = () => {
    setIsSnapshotHistoryOpen(true)
    setSelectedSnapshotId((previous) => {
      if (!previous) {
        return project.revisionSnapshots[0]?.id ?? null
      }

      const exists = project.revisionSnapshots.some((snapshot) => snapshot.id === previous)
      return exists ? previous : project.revisionSnapshots[0]?.id ?? null
    })
  }

  const closeSnapshotHistory = () => {
    setIsSnapshotHistoryOpen(false)
  }

  const restoreRevisionSnapshot = (snapshotId: string) => {
    const snapshot = project.revisionSnapshots.find((entry) => entry.id === snapshotId)
    if (!snapshot) {
      setStatusMessage('Snapshot not found')
      return
    }

    commit((draft) => {
      const target = draft.revisionSnapshots.find((entry) => entry.id === snapshotId)
      if (!target) {
        return
      }

      draft.blocks = target.blocks.map((block) => ({ ...block }))
    }, `Restored snapshot "${snapshot.label}"`)

    setActiveTab('draft')

    const firstBlockId = snapshot.blocks[0]?.id
    if (firstBlockId) {
      setSelectedBlockId(firstBlockId)
      queueFocus(firstBlockId)
    }

    const firstSceneId = snapshot.blocks.find((block) => block.type === 'scene-heading')?.id
    setSelectedSceneId(firstSceneId ?? null)
  }

  const deleteRevisionSnapshot = (snapshotId: string) => {
    const target = project.revisionSnapshots.find((entry) => entry.id === snapshotId)
    if (!target) {
      setStatusMessage('Snapshot not found')
      return
    }

    commit((draft) => {
      draft.revisionSnapshots = draft.revisionSnapshots.filter((entry) => entry.id !== snapshotId)
    }, `Deleted snapshot "${target.label}"`)

    setSelectedSnapshotId((previous) => (previous === snapshotId ? null : previous))
  }

  const saveProject = async () => {
    const serialized = JSON.stringify(project, null, 2)

    if (window.masterscript) {
      const result = await window.masterscript.saveProject(project, project.meta.title)
      if (result.ok) {
        setSavedPath(result.path ?? 'Saved with desktop file picker')
        setStatusMessage('Project saved to disk')
        if (result.path) {
          writeRecentProjectSnapshot(project)
          pushRecentProject(result.path, 'project', project.id)
        }
      }
      return
    }

    triggerDownload(
      serialized,
      `${project.meta.title || 'untitled'}.msproj.json`,
      'application/json',
    )
    writeRecentProjectSnapshot(project)
    pushRecentProject(`${project.meta.title || 'untitled'}.msproj.json`, 'project', project.id)
    setStatusMessage('Project downloaded as JSON')
  }

  const openProject = async () => {
    if (window.masterscript) {
      const result = await window.masterscript.openProject()
      if (result.ok && result.project) {
        const loadedProject = hydrateProject(result.project)
        await collaboration.stop()
        setHistory({ past: [], present: loadedProject, future: [] })
        setAppView('workspace')
        setSavedPath(result.path ?? 'Opened from desktop picker')
        if (result.path) {
          writeRecentProjectSnapshot(loadedProject)
          pushRecentProject(result.path, 'project', loadedProject.id)
        }
        setStatusMessage('Project loaded from disk')
        void autoConnectCollaboration(loadedProject, result.path)
      }
      return
    }

    fileInputRef.current?.click()
  }

  const openAutosavedRecentFallback = async (entry: RecentProjectEntry) => {
    try {
      if (window.masterscript) {
        const result = await window.masterscript.readAutosave()
        if (result.ok && result.project) {
          const recovered = hydrateProject(result.project)
          await collaboration.stop()
          setHistory({ past: [], present: recovered, future: [] })
          setAppView('workspace')
          setSavedPath(entry.label)
          writeRecentProjectSnapshot(recovered)
          pushRecentProject(entry.label, entry.source, recovered.id)
          setStatusMessage('Opened the latest autosaved version for this recent item')
          void autoConnectCollaboration(recovered, entry.label)
          return true
        }
      } else {
        const raw = localStorage.getItem(autosaveKey)
        if (raw) {
          const parsed = JSON.parse(raw) as unknown
          if (isScriptProject(parsed)) {
            const recovered = hydrateProject(parsed)
            await collaboration.stop()
            setHistory({ past: [], present: recovered, future: [] })
            setAppView('workspace')
            setSavedPath(entry.label)
            writeRecentProjectSnapshot(recovered)
            pushRecentProject(entry.label, entry.source, recovered.id)
            setStatusMessage('Opened the latest autosaved version for this recent item')
            void autoConnectCollaboration(recovered, entry.label)
            return true
          }
        }
      }
    } catch {
      return false
    }

    return false
  }

  const openRecentProject = async (entry: RecentProjectEntry) => {
    if (entry.projectId) {
      const snapshot = readRecentProjectSnapshots()[entry.projectId]
      if (snapshot) {
        const loadedProject = hydrateProject(snapshot)
        await collaboration.stop()
        setHistory({ past: [], present: loadedProject, future: [] })
        setAppView('workspace')
        setSavedPath(entry.label)
        writeRecentProjectSnapshot(loadedProject)
        pushRecentProject(entry.label, entry.source, loadedProject.id)
        setStatusMessage('Recent project snapshot loaded')
        void autoConnectCollaboration(loadedProject, entry.label)
        return
      }
    }

    if (entry.source !== 'project') {
      const openedFallback = await openAutosavedRecentFallback(entry)
      if (!openedFallback) {
        setStatusMessage('That older import entry has no saved project snapshot. Import it again or open the saved project file.')
      }
      return
    }

    if (!isLikelyLocalProjectPath(entry.label)) {
      if (window.masterscript) {
        setStatusMessage('This recent item was not saved to a project file path yet')
        return
      }

      setStatusMessage('Browser mode cannot reopen downloaded files automatically. Use Open Project.')
      fileInputRef.current?.click()
      return
    }

    if (!window.masterscript?.openProjectPath) {
      setStatusMessage('Use Open Project to select this recent file')
      fileInputRef.current?.click()
      return
    }

    try {
      const result = await window.masterscript.openProjectPath(entry.label)
      if (result.ok && result.project) {
        const loadedProject = hydrateProject(result.project)
        await collaboration.stop()
        setHistory({ past: [], present: loadedProject, future: [] })
        setAppView('workspace')
        setSavedPath(result.path ?? entry.label)
        writeRecentProjectSnapshot(loadedProject)
        pushRecentProject(result.path ?? entry.label, 'project', loadedProject.id)
        setStatusMessage('Recent project loaded')
        void autoConnectCollaboration(loadedProject, result.path ?? entry.label)
        return
      }

      setStatusMessage(result.error ?? 'Could not open recent project')
    } catch {
      setStatusMessage('Could not open recent project. The file may have moved or been deleted.')
    }
  }

  const onProjectFilePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const [selectedFile] = event.target.files ?? []
    if (!selectedFile) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      try {
        if (typeof reader.result !== 'string') {
          return
        }

        const parsed = JSON.parse(reader.result) as unknown
        if (!isScriptProject(parsed)) {
          setStatusMessage('File format was not recognized')
          return
        }

        const loadedProject = hydrateProject(parsed)
        void collaboration.stop()
        setHistory({
          past: [],
          present: loadedProject,
          future: [],
        })
        setAppView('workspace')
        setSavedPath(selectedFile.name)
        writeRecentProjectSnapshot(loadedProject)
        pushRecentProject(selectedFile.name, 'project', loadedProject.id)
        setStatusMessage('Project loaded from local file')
        void autoConnectCollaboration(loadedProject)
      } catch {
        setStatusMessage('Could not parse selected project file')
      }
    }

    reader.readAsText(selectedFile)
    event.target.value = ''
  }

  const createNewProject = () => {
    const fresh = createEmptyProject()
    void collaboration.stop()
    setHistory({ past: [], present: fresh, future: [] })
    setAppView('workspace')
    setActiveTab('draft')
    setPreviewPageIndex(0)
    setSavedPath('Autosave only')
    writeRecentProjectSnapshot(fresh)
    pushRecentProject(fresh.meta.title, 'project', fresh.id)
    setStatusMessage('Started a new project')
    setAutosaveState('idle')
  }

  const openCollaborationPanel = () => {
    setCollaborationServerInput(collaboration.sessionInfo?.serverUrl ?? '')
    setCollaborationRoomInput(collaboration.sessionInfo?.roomId ?? '')
    setCollaborationInviteInput(currentCollaborationInvite)
    setIsCollaborationPanelOpen(true)
  }

  const closeCollaborationPanel = () => {
    setIsCollaborationPanelOpen(false)
  }

  const parsePanelInvite = (): CollaborationInviteDetails | null => {
    const value = collaborationInviteInput.trim()
    if (!value.startsWith('masterscript://')) {
      return null
    }

    return parseCollaborationInvite(value)
  }

  const syncCollaborationPanelFromResult = (
    result: Awaited<ReturnType<typeof collaboration.startWebRtc>>,
  ) => {
    setCollaborationServerInput(result.sessionInfo.serverUrl)
    setCollaborationRoomInput(result.sessionInfo.roomId)
    const mode =
      result.sessionInfo.mode === 'lan-host' || result.sessionInfo.mode === 'lan-join'
        ? 'lan'
        : 'webrtc'
    setCollaborationInviteInput(
      buildCollaborationInvite({
        mode,
        roomId: result.sessionInfo.roomId,
        inviteKey: result.sessionInfo.inviteCode,
        lanServerUrl: mode === 'lan' ? result.sessionInfo.serverUrl : undefined,
      }),
    )
  }

  const hostLanCollaboration = async () => {
    try {
      const result = await collaboration.startLanHost(project)
      rememberHostedLanRoom(result.sessionInfo.roomId)
      await persistProjectToKnownPath(result.project)
      syncCollaborationPanelFromResult(result)
      setStatusMessage(`Hosting LAN session at ${result.sessionInfo.serverUrl}`)
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Could not start LAN collaboration',
      )
    }
  }

  const joinLanCollaboration = async () => {
    try {
      const invite = parsePanelInvite()
      const result = await collaboration.joinLan(
        project,
        invite?.mode === 'lan' ? invite.lanServerUrl ?? '' : collaborationServerInput,
        invite?.mode === 'lan' ? invite.roomId : collaborationRoomInput,
        invite?.mode === 'lan' ? invite.inviteKey : collaborationInviteInput,
      )
      await persistProjectToKnownPath(result.project)
      syncCollaborationPanelFromResult(result)
      setStatusMessage(`Joining LAN session ${result.sessionInfo.roomId}`)
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Could not join LAN collaboration',
      )
    }
  }

  const startWebRtcCollaboration = async () => {
    try {
      const invite = parsePanelInvite()
      if (invite?.mode === 'lan') {
        setStatusMessage('Use Join LAN or Use New Invite for LAN collaboration links')
        return
      }

      const result = await collaboration.startWebRtc(
        project,
        invite?.roomId ?? collaborationRoomInput,
        invite?.inviteKey,
      )
      await persistProjectToKnownPath(result.project)
      syncCollaborationPanelFromResult(result)
      setStatusMessage(`WebRTC collaboration room active: ${result.sessionInfo.roomId}`)
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Could not start WebRTC collaboration',
      )
    }
  }

  const applyNewCollaborationInvite = async () => {
    try {
      const invite = parseCollaborationInvite(collaborationInviteInput)
      const result =
        invite.mode === 'lan'
          ? await collaboration.joinLan(
              project,
              invite.lanServerUrl ?? '',
              invite.roomId,
              invite.inviteKey,
            )
          : await collaboration.startWebRtc(project, invite.roomId, invite.inviteKey)

      await persistProjectToKnownPath(result.project)
      syncCollaborationPanelFromResult(result)
      setStatusMessage(`Collaboration invite applied: ${result.sessionInfo.roomId}`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not use invite')
    }
  }

  const copyCollaborationInvite = async () => {
    const invite = collaborationInviteInput || currentCollaborationInvite
    if (!invite) {
      setStatusMessage('Start collaboration before copying an invite')
      return
    }

    await navigator.clipboard?.writeText(invite)
    setStatusMessage('Collaboration invite copied')
  }

  const joinCollaborationFromStartScreen = async () => {
    const invite = startScreenInviteInput.trim()
    if (!invite) {
      setCollaborationJoinStatus('Paste a collaboration invite first')
      return
    }

    const abortController = new AbortController()
    collaborationBootstrapAbortRef.current = abortController
    setIsBootstrappingCollaboration(true)
    setCollaborationJoinStatus('Bootstrapping collaboration project...')

    try {
      const result = await collaboration.bootstrapFromInvite(invite, {
        signal: abortController.signal,
        onStatus: setCollaborationJoinStatus,
      })
      const hydrated = hydrateProject(result.project)
      setCollaborationJoinStatus('Project synced. Choose where to save it.')

      let nextSavedPath = `${hydrated.meta.title || 'untitled'}.msproj.json`
      if (window.masterscript) {
        const saveResult = await window.masterscript.saveProject(
          hydrated,
          hydrated.meta.title,
        )
        if (!saveResult.ok) {
          await collaboration.stop({ flush: false })
          setCollaborationJoinStatus('Collaboration join cancelled')
          return
        }
        nextSavedPath = saveResult.path ?? 'Saved with desktop file picker'
      } else {
        localStorage.setItem(autosaveKey, JSON.stringify(hydrated))
        triggerDownload(
          JSON.stringify(hydrated, null, 2),
          nextSavedPath,
          'application/json',
        )
      }

      await collaboration.finishBootstrap(hydrated)
      setHistory({ past: [], present: hydrated, future: [] })
      setAppView('workspace')
      setActiveTab('draft')
      setPreviewPageIndex(0)
      setSavedPath(nextSavedPath)
      writeRecentProjectSnapshot(hydrated)
      pushRecentProject(nextSavedPath, 'project', hydrated.id)
      setStartScreenInviteInput('')
      setCollaborationJoinStatus('')
      setStatusMessage('Saved local collaboration copy.')
    } catch (error) {
      setCollaborationJoinStatus(
        error instanceof Error ? error.message : 'Could not join collaboration',
      )
    } finally {
      collaborationBootstrapAbortRef.current = null
      setIsBootstrappingCollaboration(false)
    }
  }

  const cancelCollaborationBootstrap = () => {
    collaborationBootstrapAbortRef.current?.abort()
  }

  const stopCollaboration = async () => {
    await collaboration.stop()
    setStatusMessage('Collaboration stopped; local autosave flushed')
  }

  const toggleThemeMode = () => {
    setThemeMode((previous) => (previous === 'dark' ? 'light' : 'dark'))
    setStatusMessage(`Switched to ${themeMode === 'dark' ? 'light' : 'dark'} theme`)
  }

  const exportFountain = async () => {
    const fountain = toFountain(project)
    if (window.masterscript) {
      const result = await window.masterscript.exportFountain(
        project.meta.title,
        fountain,
      )
      if (result.ok) {
        setStatusMessage('Fountain export created')
      }
      return
    }

    triggerDownload(
      fountain,
      `${project.meta.title || 'untitled'}.fountain`,
      'text/plain;charset=utf-8',
    )
    setStatusMessage('Fountain export downloaded')
  }

  const applyImportedProject = (
    importedProject: ScriptProject,
    sourceLabel: string,
    warnings: AdapterWarning[],
    path?: string,
  ) => {
    const hydrated = hydrateProject(importedProject)

    if (path && shouldApplyImportedTitleFallback(hydrated.meta.title)) {
      hydrated.meta.title = inferTitleFromPath(path)
    }

    void collaboration.stop()
    setHistory({
      past: [],
      present: hydrated,
      future: [],
    })
    setAppView('workspace')
    writeRecentProjectSnapshot(hydrated)
    if (path) {
      setSavedPath(path)
      pushRecentProject(path, 'import', hydrated.id)
    } else {
      pushRecentProject(`${sourceLabel} import`, 'import', hydrated.id)
    }

    const warningSuffix =
      warnings.length > 0
        ? ` (${warnings.length} warning${warnings.length === 1 ? '' : 's'})`
        : ''

    const warningDetail = warnings[0]?.message ? ` - ${warnings[0].message}` : ''
    setStatusMessage(`Imported from ${sourceLabel}${warningSuffix}${warningDetail}`)
    if (hasCollaborationMeta(hydrated)) {
      void autoConnectCollaboration(hydrated, path)
    }
  }

  const importFountain = async () => {
    try {
      const { importFountainProject } = await import('./lib/adapters/fountain')

      if (window.masterscript?.importFountain) {
        const result = await window.masterscript.importFountain()
        if (!result.ok || !result.content) {
          return
        }

        const parsed = importFountainProject(result.content)
        applyImportedProject(parsed.data, 'Fountain', parsed.warnings, result.path)
        return
      }

      const selected = await pickTextFile('.fountain,.txt')
      if (!selected) {
        return
      }

      const parsed = importFountainProject(selected.content)
      applyImportedProject(parsed.data, 'Fountain', parsed.warnings, selected.name)
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Fountain import failed unexpectedly',
      )
    }
  }

  const importFdx = async () => {
    try {
      const { importFdxProject } = await import('./lib/adapters/fdx')

      if (window.masterscript?.importFdx) {
        const result = await window.masterscript.importFdx()
        if (!result.ok || !result.content) {
          return
        }

        const parsed = importFdxProject(result.content)
        applyImportedProject(parsed.data, 'FDX', parsed.warnings, result.path)
        return
      }

      const selected = await pickTextFile('.fdx,.xml,.txt')
      if (!selected) {
        return
      }

      const parsed = importFdxProject(selected.content)
      applyImportedProject(parsed.data, 'FDX', parsed.warnings, selected.name)
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'FDX import failed unexpectedly',
      )
    }
  }

  const exportFdx = async () => {
    try {
      const { exportProjectToFdx } = await import('./lib/adapters/fdx')
      const xml = exportProjectToFdx(project)
      if (window.masterscript?.exportFdx) {
        const result = await window.masterscript.exportFdx(project.meta.title, xml)
        if (result.ok) {
          setStatusMessage('FDX export created')
        }
        return
      }

      triggerDownload(xml, `${project.meta.title || 'untitled'}.fdx`, 'application/xml')
      setStatusMessage('FDX export downloaded')
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'FDX export failed unexpectedly',
      )
    }
  }

  const importDocx = async () => {
    try {
      const { importDocxProject } = await import('./lib/adapters/docx')

      if (window.masterscript?.importDocx) {
        const result = await window.masterscript.importDocx()
        if (!result.ok || !result.base64) {
          return
        }

        const parsed = await importDocxProject(base64ToArrayBuffer(result.base64))
        applyImportedProject(parsed.data, 'DOCX', parsed.warnings, result.path)
        return
      }

      const selected = await pickBinaryFile('.docx')
      if (!selected) {
        return
      }

      const parsed = await importDocxProject(selected.content)
      applyImportedProject(parsed.data, 'DOCX', parsed.warnings, selected.name)
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'DOCX import failed unexpectedly',
      )
    }
  }

  const exportDocx = async () => {
    try {
      const { exportProjectToDocx } = await import('./lib/adapters/docx')
      const output = await exportProjectToDocx(project)

      if (window.masterscript?.exportDocx) {
        const base64 = arrayBufferToBase64(output)
        const result = await window.masterscript.exportDocx(project.meta.title, base64)
        if (result.ok) {
          setStatusMessage('DOCX export created')
        }
        return
      }

      triggerBinaryDownload(
        output,
        `${project.meta.title || 'untitled'}.docx`,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
      setStatusMessage('DOCX export downloaded')
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'DOCX export failed unexpectedly',
      )
    }
  }

  const exportPdf = async () => {
    try {
      const { exportProjectToPdf } = await import('./lib/adapters/pdf')
      const output = await exportProjectToPdf(project)

      if (window.masterscript?.exportPdf) {
        const base64 = arrayBufferToBase64(output)
        const result = await window.masterscript.exportPdf(project.meta.title, base64)
        if (result.ok) {
          setStatusMessage('PDF export created')
        }
        return
      }

      triggerBinaryDownload(output, `${project.meta.title || 'untitled'}.pdf`, 'application/pdf')
      setStatusMessage('PDF export downloaded')
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'PDF export failed unexpectedly',
      )
    }
  }

  const openFindReplace = () => {
    setActiveTab('draft')
    setIsCommandPaletteOpen(false)
    setCommandQuery('')
    setFindCursor(0)
    setIsFindReplaceOpen(true)
  }

  const closeFindReplace = () => {
    setIsFindReplaceOpen(false)
  }

  const focusFindMatch = (match: FindMatch) => {
    setActiveTab('draft')
    setSelectedBlockId(match.blockId)
    if (match.blockType === 'scene-heading') {
      setSelectedSceneId(match.blockId)
    }
    queueFocus(match.blockId)
  }

  const jumpToNextFindMatch = () => {
    const trimmedQuery = findQuery.trim()
    if (!trimmedQuery) {
      setStatusMessage('Enter text in Find to search screenplay blocks')
      return
    }

    if (findMatches.length === 0) {
      setStatusMessage('No matches found for current Find query')
      return
    }

    const safeIndex = findCursor % findMatches.length
    const match = findMatches[safeIndex]
    focusFindMatch(match)
    setFindCursor((safeIndex + 1) % findMatches.length)
    setStatusMessage(
      `Find match ${safeIndex + 1} of ${findMatches.length}: ${match.preview || match.matchText}`,
    )
  }

  const replaceNextFindMatch = () => {
    const trimmedQuery = findQuery.trim()
    if (!trimmedQuery) {
      setStatusMessage('Enter text in Find before replacing')
      return
    }

    if (findMatches.length === 0) {
      setStatusMessage('No matches available to replace')
      return
    }

    const safeIndex = findCursor % findMatches.length
    const activeMatch = findMatches[safeIndex]
    let didReplace = false

    commit((draft) => {
      const target = draft.blocks.find((block) => block.id === activeMatch.blockId)
      if (!target) {
        return
      }

      const result = replaceFirstOccurrence(
        target.text,
        trimmedQuery,
        replaceQuery,
        findCaseSensitive,
      )

      if (result.replaced) {
        didReplace = true
        target.text = result.text
      }
    }, 'Replaced current find match')

    if (!didReplace) {
      setStatusMessage('Could not replace match in current selection')
      return
    }

    focusFindMatch(activeMatch)
    setFindCursor(0)
  }

  const replaceAllFindMatches = () => {
    const trimmedQuery = findQuery.trim()
    if (!trimmedQuery) {
      setStatusMessage('Enter text in Find before replacing all matches')
      return
    }

    let replacedCount = 0
    commit((draft) => {
      for (const block of draft.blocks) {
        const replacement = replaceAllOccurrences(
          block.text,
          trimmedQuery,
          replaceQuery,
          findCaseSensitive,
        )

        if (replacement.replacedCount > 0) {
          block.text = replacement.text
          replacedCount += replacement.replacedCount
        }
      }
    }, 'Replaced all find matches')

    if (replacedCount === 0) {
      setStatusMessage('No matches were replaced')
      return
    }

    setFindCursor(0)
    setStatusMessage(`Replaced ${replacedCount} match${replacedCount === 1 ? '' : 'es'}`)
  }

  const addCard = () => {
    commit((draft) => {
      draft.cards.push(createStoryCard())
    }, 'Added beat card')
  }

  const insertTemplateCards = () => {
    const generatedCards = buildCardsFromTemplate(selectedTemplateId)
    if (generatedCards.length === 0) {
      setStatusMessage('Template was not found')
      return
    }

    commit((draft) => {
      draft.cards.push(...generatedCards)
    }, `Inserted ${generatedCards.length} template beats`)
    setActiveTab('planning')
  }

  const updateCard = (
    cardId: string,
    updater: (card: (typeof project.cards)[number]) => void,
  ) => {
    commit((draft) => {
      const target = draft.cards.find((card) => card.id === cardId)
      if (target) {
        updater(target)
      }
    }, 'Updated beat card')
  }

  const onCardDrop = (targetCardId: string) => {
    if (!draggingCardId || draggingCardId === targetCardId) {
      return
    }

    commit((draft) => {
      draft.cards = reorderById(draft.cards, draggingCardId, targetCardId)
    }, 'Reordered beat cards')
    setDraggingCardId(null)
  }

  const removeCard = (cardId: string) => {
    commit((draft) => {
      draft.cards = draft.cards.filter((card) => card.id !== cardId)
    }, 'Removed beat card')
  }

  const applyStoryProject = (nextProject: ScriptProject, message: string) => {
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: {
        ...nextProject,
        meta: {
          ...nextProject.meta,
          updatedAt: new Date().toISOString(),
        },
      },
      future: [],
    }))
    setStatusMessage(message)
  }

  const applyProductivityProject = useCallback(
    (nextProject: ScriptProject, message: string) => {
      setHistory((previous) => ({
        past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
        present: {
          ...nextProject,
          meta: {
            ...nextProject.meta,
            updatedAt: new Date().toISOString(),
          },
        },
        future: [],
      }))
      setStatusMessage(message)
    },
    [],
  )

  const applyProductionProject = (nextProject: ScriptProject, message: string) => {
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: {
        ...nextProject,
        meta: {
          ...nextProject.meta,
          updatedAt: new Date().toISOString(),
        },
      },
      future: [],
    }))
    setStatusMessage(message)
  }

  const applyTaggingProject = (nextProject: ScriptProject, message: string) => {
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: {
        ...nextProject,
        meta: {
          ...nextProject.meta,
          updatedAt: new Date().toISOString(),
        },
      },
      future: [],
    }))
    setStatusMessage(message)
  }

  const applyAdvancedProject = (nextProject: ScriptProject, message: string) => {
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: {
        ...nextProject,
        meta: {
          ...nextProject.meta,
          updatedAt: new Date().toISOString(),
        },
      },
      future: [],
    }))
    setStatusMessage(message)
  }

  const toggleProductivityMode = (
    key: keyof ProductivitySettings,
    value: boolean,
  ) => {
    if (key === 'fullscreenMode' && typeof document !== 'undefined') {
      if (value && !document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.()
      }

      if (!value && document.fullscreenElement) {
        void document.exitFullscreen?.()
      }
    }

    applyProductivityProject(
      setProductivityMode(project, key, value),
      'Updated writing mode',
    )
  }

  const updateProductivityGoal = (
    key: 'dailyPageGoal' | 'projectPageGoal' | 'dailyPagesWritten',
    value: number,
  ) => {
    commit((draft) => {
      draft.productivity.goals[key] = Math.max(0, value)
    }, 'Updated writing goals')
  }

  const updateSprintMinutes = (value: number) => {
    commit((draft) => {
      const minutes = Math.max(1, Math.round(value) || 1)
      draft.productivity.sprints.activeMinutes = minutes
      if (!draft.productivity.sprints.isRunning) {
        draft.productivity.sprints.remainingSeconds = minutes * 60
      }
    }, 'Updated sprint length')
  }

  const startSprintTimer = () => {
    setSprintStartWords(stats.wordCount)
    commit((draft) => {
      const minutes = Math.max(1, draft.productivity.sprints.activeMinutes || 25)
      draft.productivity.sprints.activeMinutes = minutes
      draft.productivity.sprints.remainingSeconds = minutes * 60
      draft.productivity.sprints.isRunning = true
    }, 'Sprint timer started')
  }

  const finishSprintTimer = useCallback(() => {
    const nextProject = logSprintSession(project, {
      minutes: project.productivity.sprints.activeMinutes,
      wordsStarted: sprintStartWords,
      wordsEnded: stats.wordCount,
      endedAt: new Date().toISOString(),
    })
    applyProductivityProject(nextProject, 'Sprint session logged')
    setSprintStartWords(stats.wordCount)
  }, [applyProductivityProject, project, sprintStartWords, stats.wordCount])

  const logWritingToday = () => {
    const today = new Date().toISOString().slice(0, 10)
    applyProductivityProject(
      updateWritingStreak(project, today),
      'Writing streak updated',
    )
  }

  const assignBrowserVoices = () => {
    const voices =
      typeof window !== 'undefined' && 'speechSynthesis' in window
        ? window.speechSynthesis.getVoices().map((voice) => voice.name)
        : []
    applyProductivityProject(
      assignCharacterVoices(project, voices.length > 0 ? voices : ['Default']),
      'Assigned TTS voices',
    )
  }

  const updateTtsSpeed = (value: number) => {
    commit((draft) => {
      draft.productivity.tts.speed = Math.min(2, Math.max(0.5, value || 1))
    }, 'Updated read-through speed')
  }

  const speakReadThroughItem = (index: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setStatusMessage('Text-to-speech is not available in this browser')
      return
    }

    const item = readThroughQueue[index]
    if (!item) {
      setReadThroughState('stopped')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(item.text)
    utterance.rate = project.productivity.tts.speed

    const assignedVoice = project.productivity.tts.voiceByCharacter[item.speaker]
    const voice = window.speechSynthesis
      .getVoices()
      .find((candidate) => candidate.name === assignedVoice)
    if (voice) {
      utterance.voice = voice
    }

    utterance.onstart = () => {
      setReadThroughIndex(index)
      setReadThroughState('playing')
      setSelectedBlockId(item.blockId)
      setHighlightedId(item.blockId)
    }
    utterance.onend = () => {
      const nextIndex = index + 1
      if (nextIndex < readThroughQueue.length) {
        window.setTimeout(() => speakReadThroughItem(nextIndex), 60)
        return
      }

      setReadThroughState('stopped')
      setReadThroughIndex(0)
    }
    utterance.onerror = () => {
      setReadThroughState('stopped')
      setStatusMessage('Read-through stopped')
    }

    window.speechSynthesis.speak(utterance)
  }

  const startReadThrough = () => {
    if (readThroughQueue.length === 0) {
      setStatusMessage('No narration or dialogue is available for read-through')
      return
    }

    speakReadThroughItem(Math.min(readThroughIndex, readThroughQueue.length - 1))
  }

  const pauseReadThrough = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
      setReadThroughState('playing')
      return
    }

    window.speechSynthesis.pause()
    setReadThroughState('paused')
  }

  const stopReadThrough = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setReadThroughState('stopped')
    setReadThroughIndex(0)
  }

  useEffect(() => {
    if (!productivityState.sprints.isRunning) {
      return
    }

    if (productivityState.sprints.remainingSeconds <= 0) {
      finishSprintTimer()
      return
    }

    const timer = window.setTimeout(() => {
      setHistory((previous) => {
        const nextProject = cloneProject(previous.present)
        if (!nextProject.productivity.sprints.isRunning) {
          return previous
        }

        nextProject.productivity.sprints.remainingSeconds = Math.max(
          0,
          nextProject.productivity.sprints.remainingSeconds - 1,
        )
        return {
          ...previous,
          present: nextProject,
        }
      })
    }, 1000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    finishSprintTimer,
    productivityState.sprints.isRunning,
    productivityState.sprints.remainingSeconds,
  ])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const updateCardCorkboard = (
    cardId: string,
    updates: { x?: number; y?: number; color?: string; imageDataUrl?: string },
  ) => {
    applyStoryProject(updateCorkboardCard(project, cardId, updates), 'Updated corkboard card')
  }

  const updateSelectedSceneDevelopment = (
    updates: Parameters<typeof setSceneDevelopmentMeta>[2],
  ) => {
    if (!resolvedSelectedSceneId) {
      setStatusMessage('Select a scene before editing scene metadata')
      return
    }

    applyStoryProject(
      setSceneDevelopmentMeta(project, resolvedSelectedSceneId, updates),
      'Updated scene development metadata',
    )
  }

  const updateStoryNote = (
    kind: 'script' | 'scratchpad' | 'scene' | 'inline',
    text: string,
  ) => {
    applyStoryProject(
      setSceneNote(project, kind, text, resolvedSelectedSceneId),
      'Updated story notes',
    )
  }

  const syncGeneratedOutline = () => {
    const nextProject = ensureStoryDevelopmentState(project)
    nextProject.story.outline = buildHierarchicalOutline(nextProject)
    applyStoryProject(nextProject, 'Synced outline from script scenes')
  }

  const reorderOutlineScene = (targetSceneId: string) => {
    if (!draggingOutlineSceneId || draggingOutlineSceneId === targetSceneId) {
      return
    }

    const currentOrder = scenes.map((scene) => scene.blockId)
    const nextOrder = reorderById(
      currentOrder.map((id) => ({ id })),
      draggingOutlineSceneId,
      targetSceneId,
    ).map((entry) => entry.id)
    applyStoryProject(reorderScenesByOutline(project, nextOrder), 'Reordered scenes from outline')
    setDraggingOutlineSceneId(null)
  }

  const addScheduleEntry = () => {
    commit((draft) => {
      draft.production.schedule.push({
        id: createUuid(),
        day: 1,
        sceneId: resolvedSelectedSceneId ?? scenes[0]?.blockId ?? null,
        location: '',
        notes: '',
      })
    }, 'Added schedule row')
  }

  const updateScheduleEntry = (
    entryId: string,
    updater: (entry: (typeof project.production.schedule)[number]) => void,
  ) => {
    commit((draft) => {
      const target = draft.production.schedule.find((entry) => entry.id === entryId)
      if (target) {
        updater(target)
      }
    }, 'Updated schedule row')
  }

  const removeScheduleEntry = (entryId: string) => {
    commit((draft) => {
      draft.production.schedule = draft.production.schedule.filter(
        (entry) => entry.id !== entryId,
      )
    }, 'Removed schedule row')
  }

  const reorderScheduleEntry = (targetEntryId: string) => {
    if (!draggingScheduleId || draggingScheduleId === targetEntryId) {
      return
    }

    applyProductionProject(
      reorderStripboard(project, draggingScheduleId, targetEntryId),
      'Reordered stripboard',
    )
    setDraggingScheduleId(null)
  }

  const regenerateProductionBreakdown = () => {
    const generated = generateProductionBreakdown(project)
    commit((draft) => {
      draft.production.breakdown = generated
    }, `Generated ${generated.length} production breakdown entities`)
  }

  const addBreakdownEntity = (kind: BreakdownKind) => {
    commit((draft) => {
      draft.production.breakdown.push({
        id: createUuid(),
        kind,
        name: '',
        sceneIds: [],
        notes: '',
      })
    }, `Added ${kind} breakdown entity`)
  }

  const updateBreakdownEntry = (
    entryId: string,
    updater: (entry: (typeof project.production.breakdown)[number]) => void,
  ) => {
    commit((draft) => {
      const target = draft.production.breakdown.find((entry) => entry.id === entryId)
      if (target) {
        updater(target)
      }
    }, 'Updated breakdown entry')
  }

  const removeBreakdownEntry = (entryId: string) => {
    commit((draft) => {
      draft.production.breakdown = draft.production.breakdown.filter(
        (entry) => entry.id !== entryId,
      )
    }, 'Removed breakdown entry')
  }

  const exportDayOutOfDays = () => {
    const report = buildDoodGridCsv(project)
    triggerDownload(
      report,
      `${project.meta.title || 'untitled'}-day-out-of-days.csv`,
      'text/csv;charset=utf-8',
    )
    setStatusMessage('Day-out-of-days CSV downloaded')
  }

  const exportCallSheetPdf = async () => {
    const sheet = buildCallSheet(project, resolvedShootDay)
    const lines = [
      `Shoot Day ${sheet.day}`,
      '',
      'Scenes',
      ...sheet.scenes.map(
        (scene) =>
          `S${scene.sceneNumber ?? '-'} | ${scene.heading} | ${scene.location} | ${scene.notes}`,
      ),
      '',
      `Cast: ${sheet.cast.join(', ') || 'None'}`,
      '',
      'Crew',
      ...sheet.crew.map((crew) => `${crew.name} | ${crew.role} | ${crew.contact}`),
    ]
    const output = await exportTextReportToPdf(`Call Sheet - Day ${resolvedShootDay}`, lines)
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-call-sheet-day-${resolvedShootDay}.pdf`,
      'application/pdf',
    )
    setStatusMessage('Call sheet PDF downloaded')
  }

  const exportScriptSidesPdf = async () => {
    const sides = buildScriptSides(project, resolvedShootDay)
    const lines = sides.scenes.flatMap((scene) => [
      scene.heading,
      ...scene.blocks.map((block) => `${block.revisionMark ? '* ' : ''}${block.text}`),
      '',
    ])
    const output = await exportTextReportToPdf(`Script Sides - Day ${resolvedShootDay}`, lines)
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-sides-day-${resolvedShootDay}.pdf`,
      'application/pdf',
    )
    setStatusMessage('Script sides PDF downloaded')
  }

  const captureContinuousSelection = () => {
    const node = continuousDraftRef.current
    if (!node || node.selectionStart === node.selectionEnd) {
      return
    }

    const selectedText = node.value.slice(node.selectionStart, node.selectionEnd).trim()
    if (selectedText) {
      setTagPhrase(selectedText)
      setStatusMessage('Selected text ready for tagging')
    }
  }

  const applyManualTag = () => {
    const phrase = tagPhrase.trim()
    if (!phrase) {
      setStatusMessage('Enter or select text before tagging')
      return
    }

    const candidates = selectedBlock
      ? [selectedBlock, ...project.blocks.filter((block) => block.id !== selectedBlock.id)]
      : project.blocks
    const target = candidates.find((block) =>
      block.text.toLowerCase().includes(phrase.toLowerCase()),
    )

    if (!target) {
      setStatusMessage('Tagged phrase was not found in the script')
      return
    }

    const start = target.text.toLowerCase().indexOf(phrase.toLowerCase())
    applyTaggingProject(
      tagScriptSelection(project, {
        blockId: target.id,
        start,
        end: start + phrase.length,
        category: selectedTagCategory,
        label: phrase,
      }),
      `Tagged ${phrase} as ${selectedTagCategory}`,
    )
  }

  const confirmAutoTag = (suggestion: (typeof autoTagSuggestions)[number]) => {
    applyTaggingProject(
      tagScriptSelection(project, {
        blockId: suggestion.blockId,
        start: suggestion.start,
        end: suggestion.end,
        category: suggestion.category,
        label: suggestion.text,
      }),
      `Tagged ${suggestion.text} as ${suggestion.category}`,
    )
  }

  const updateTagCatalog = (
    itemId: string,
    updates: Parameters<typeof updateTagCatalogItem>[2],
  ) => {
    applyTaggingProject(
      updateTagCatalogItem(project, itemId, updates),
      'Updated tag catalog item',
    )
  }

  const exportBreakdownCsv = () => {
    const report = buildBreakdownCsv(project, resolvedSelectedSceneId)
    triggerDownload(
      report,
      `${project.meta.title || 'untitled'}-breakdown.csv`,
      'text/csv;charset=utf-8',
    )
    setStatusMessage('Breakdown CSV downloaded')
  }

  const exportBreakdownPdf = async () => {
    const lines = [
      selectedBreakdownSheet.sceneHeading,
      '',
      ...departmentTagCategories.flatMap((category) => {
        const items = selectedBreakdownSheet.categories[category] ?? []
        if (items.length === 0) {
          return []
        }

        return [
          category,
          ...items.map(
            (item) =>
              `${item.name} | ${item.occurrences.length} occurrence(s) | Cost ${item.cost} | ${item.notes}`,
          ),
          '',
        ]
      }),
    ]
    const output = await exportTextReportToPdf('Breakdown Sheet', lines)
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-breakdown.pdf`,
      'application/pdf',
    )
    setStatusMessage('Breakdown PDF downloaded')
  }

  const exportCurrentReportCsv = () => {
    const report = buildReportCsv(currentReport.headers, currentReport.rows)
    triggerDownload(
      report,
      `${project.meta.title || 'untitled'}-${currentReport.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}.csv`,
      'text/csv;charset=utf-8',
    )
    setStatusMessage('Report CSV downloaded')
  }

  const exportCurrentReportPdf = async () => {
    const lines = [
      currentReport.headers.join(' | '),
      ...currentReport.rows.map((row) => row.map(formatReportCell).join(' | ')),
    ]
    const output = await exportTextReportToPdf(currentReport.title, lines)
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-${currentReport.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}.pdf`,
      'application/pdf',
    )
    setStatusMessage('Report PDF downloaded')
  }

  const setAdvancedFormat = (formatId: ScriptFormatId) => {
    applyAdvancedProject(
      updateAdvancedSettings(project, { activeFormat: formatId }),
      'Updated script format',
    )
  }

  const insertFormatTemplate = () => {
    const templateProject = buildFormatTemplateProject(project.advanced.activeFormat)
    commit((draft) => {
      draft.blocks = [...draft.blocks, ...templateProject.blocks]
    }, 'Inserted format template blocks')
  }

  const updateAdvancedTitleField = (
    key: keyof typeof project.advanced.titlePage,
    value: string,
  ) => {
    applyAdvancedProject(
      updateAdvancedSettings(project, {
        titlePage: {
          ...project.advanced.titlePage,
          [key]: value,
        },
      }),
      'Updated production title page',
    )
  }

  const updatePrintWatermarkField = (
    key: keyof typeof project.advanced.print,
    value: string | number | boolean,
  ) => {
    applyAdvancedProject(
      updateAdvancedSettings(project, {
        print: {
          ...project.advanced.print,
          [key]: value,
        },
      }),
      'Updated print settings',
    )
  }

  const logRevisionDistributionNow = () => {
    applyAdvancedProject(
      addRevisionDistribution(project, {
        date: new Date().toISOString().slice(0, 10),
        color: project.meta.activeRevision,
        pages: previewPages
          .filter((page) => page.kind === 'script')
          .map((page) => String(page.scriptPageNumber ?? 1)),
        recipients: 'Production distribution',
      }),
      'Logged revision distribution',
    )
  }

  const exportRevisionLogCsv = () => {
    triggerDownload(
      buildRevisionDistributionCsv(project),
      `${project.meta.title || 'untitled'}-revision-distribution.csv`,
      'text/csv;charset=utf-8',
    )
    setStatusMessage('Revision distribution CSV downloaded')
  }

  const exportRevisionLogPdf = async () => {
    const lines = project.advanced.revisionDistributionLog.map(
      (event) =>
        `${event.date} | ${event.color} | ${event.pages.join(', ')} | ${event.recipients}`,
    )
    const output = await exportTextReportToPdf('Revision Distribution Log', lines)
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-revision-distribution.pdf`,
      'application/pdf',
    )
    setStatusMessage('Revision distribution PDF downloaded')
  }

  const beginProductionDraftAction = () => {
    if (!window.confirm('Begin production draft? This assigns and locks scene numbers.')) {
      return
    }

    applyAdvancedProject(beginAdvancedProductionDraft(project), 'Production draft started')
  }

  const exportCleanPdf = async () => {
    const { exportProjectToPdf } = await import('./lib/adapters/pdf')
    const output = await exportProjectToPdf(createPdfExportProject(project, 'clean'))
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-clean.pdf`,
      'application/pdf',
    )
    setStatusMessage('Clean PDF downloaded')
  }

  const exportDirtyPdf = async () => {
    const { exportProjectToPdf } = await import('./lib/adapters/pdf')
    const output = await exportProjectToPdf(createPdfExportProject(project, 'dirty'))
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-dirty.pdf`,
      'application/pdf',
    )
    setStatusMessage('Dirty PDF downloaded')
  }

  const exportScriptCheckPdf = async () => {
    const lines = scriptCheckResults.map(
      (item) =>
        `${item.severity.toUpperCase()} | ${item.code} | Scene ${item.sceneNumber ?? '-'} | ${item.message} | ${item.suggestion}`,
    )
    const output = await exportTextReportToPdf('Script Check Notes', lines)
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-script-check.pdf`,
      'application/pdf',
    )
    setStatusMessage('Script check PDF downloaded')
  }

  const exportOneLinerCsv = () => {
    const rows = [
      ['Scene #', 'INT/EXT', 'Location', 'Description', 'Day/Night', 'Cast', 'Pages'],
      ...oneLinerRows.map((row) => [
        row.sceneNumber,
        row.intExt,
        row.location,
        row.description,
        row.dayNight,
        row.castPresent.join('; '),
        row.pageCount,
      ]),
    ]
    triggerDownload(
      rows.map((row) => row.map(String).join(',')).join('\n'),
      `${project.meta.title || 'untitled'}-one-liner.csv`,
      'text/csv;charset=utf-8',
    )
    setStatusMessage('One-liner CSV downloaded')
  }

  const exportOneLinerPdf = async () => {
    const lines = oneLinerRows.map(
      (row) =>
        `${row.sceneNumber} | ${row.intExt} | ${row.location} | ${row.dayNight} | ${row.castPresent.join(', ')} | ${row.pageCount} pg | ${row.description}`,
    )
    const output = await exportTextReportToPdf('One-Liner Schedule', lines)
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-one-liner.pdf`,
      'application/pdf',
    )
    setStatusMessage('One-liner PDF downloaded')
  }

  const exportTableReadPdf = async () => {
    const options = buildTableReadExportOptions()
    const lines = [
      `Table Read Draft | ${options.fontSize}pt Courier | scene numbers omitted`,
      '',
      ...buildTableReadDraftText(project).split(/\r?\n/),
    ]
    const output = await exportTextReportToPdf('Table Read Draft', lines)
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-table-read.pdf`,
      'application/pdf',
    )
    setStatusMessage('Table read PDF downloaded')
  }

  const exportAdditionalFormat = (kind: 'txt' | 'rtf' | 'html' | 'scene-csv' | 'workbook') => {
    if (kind === 'txt') {
      triggerDownload(exportTxtProject(project), `${project.meta.title || 'untitled'}.txt`, 'text/plain;charset=utf-8')
    } else if (kind === 'rtf') {
      triggerDownload(exportRtfProject(project), `${project.meta.title || 'untitled'}.rtf`, 'application/rtf')
    } else if (kind === 'html') {
      triggerDownload(exportHtmlProject(project), `${project.meta.title || 'untitled'}.html`, 'text/html;charset=utf-8')
    } else if (kind === 'scene-csv') {
      triggerDownload(exportSceneListCsv(project), `${project.meta.title || 'untitled'}-scenes.csv`, 'text/csv;charset=utf-8')
    } else {
      triggerDownload(
        exportReportWorkbookXml('Scenes', oneLinerRows.map((row) => [row.sceneNumber, row.location, row.dayNight])),
        `${project.meta.title || 'untitled'}-reports.xlsx`,
        'application/vnd.ms-excel',
      )
    }
    setStatusMessage('Additional export downloaded')
  }

  const setCastStatusForCharacter = () => {
    const name = (selectedCastStatusCharacter || characterSuggestions[0] || '').trim().toUpperCase()
    if (!name) {
      setStatusMessage('Choose a character before setting cast status')
      return
    }

    applyAdvancedProject(
      updateAdvancedSettings(project, {
        castStatuses: {
          ...project.advanced.castStatuses,
          [name]: selectedCastStatus,
        },
      }),
      'Updated cast status',
    )
  }

  const addDefaultCoverage = () => {
    applyAdvancedProject(
      addCoverageRecord(project, {
        draftId: project.revisionDraftSets[0]?.id ?? 'current-draft',
        logline: '',
        format: project.advanced.activeFormat,
        genre: '',
        setting: '',
        timePeriod: '',
        characters: characterSuggestions.map((name) => ({ name, description: '' })),
        synopsisByAct: { actOne: '', actTwo: '', actThree: '' },
        comments: { story: '', character: '', dialogue: '', format: '' },
        recommendation: 'Consider',
        ratings: { concept: 3, story: 3, structure: 3, character: 3, dialogue: 3, format: 3 },
      }),
      'Added coverage template',
    )
  }

  const exportLatestCoveragePdf = async () => {
    const record = project.advanced.coverage[0]
    if (!record) {
      setStatusMessage('Add a coverage form before exporting')
      return
    }

    const output = await exportTextReportToPdf('Coverage', buildCoveragePdfLines(record))
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-coverage.pdf`,
      'application/pdf',
    )
    setStatusMessage('Coverage PDF downloaded')
  }

  const addParkingLotFromSelection = () => {
    const sceneBlocks = resolvedSelectedSceneId
      ? project.blocks.slice(
          project.blocks.findIndex((block) => block.id === resolvedSelectedSceneId),
          project.blocks.findIndex(
            (block, index) =>
              index > project.blocks.findIndex((candidate) => candidate.id === resolvedSelectedSceneId) &&
              block.type === 'scene-heading',
          ) < 0
            ? project.blocks.length
            : project.blocks.findIndex(
                (block, index) =>
                  index > project.blocks.findIndex((candidate) => candidate.id === resolvedSelectedSceneId) &&
                  block.type === 'scene-heading',
              ),
        )
      : []
    applyAdvancedProject(
      addParkingLotScene(project, selectedScene?.heading ?? 'Parking Lot Scene', sceneBlocks),
      'Added scene to parking lot',
    )
  }

  const addBudgetItem = () => {
    commit((draft) => {
      draft.budget.items.push({
        id: createUuid(),
        category: 'Cast',
        description: 'New line item',
        amount: 0,
      })
    }, 'Added budget item')
  }

  const updateBudgetItem = (
    itemId: string,
    updater: (item: (typeof project.budget.items)[number]) => void,
  ) => {
    commit((draft) => {
      const target = draft.budget.items.find((item) => item.id === itemId)
      if (target) {
        updater(target)
      }
    }, 'Updated budget item')
  }

  const removeBudgetItem = (itemId: string) => {
    commit((draft) => {
      draft.budget.items = draft.budget.items.filter((item) => item.id !== itemId)
    }, 'Removed budget item')
  }

  const addStoryboardPanel = () => {
    commit((draft) => {
      draft.storyboards.push({
        id: createUuid(),
        sceneId: resolvedSelectedSceneId ?? scenes[0]?.blockId ?? null,
        shot: 'Medium Shot',
        shotNumber: '',
        shotType: 'MS',
        angle: '',
        lens: '',
        movement: '',
        description: '',
      })
    }, 'Added storyboard panel')
  }

  const updateStoryboardPanel = (
    panelId: string,
    updater: (panel: (typeof project.storyboards)[number]) => void,
  ) => {
    commit((draft) => {
      const target = draft.storyboards.find((panel) => panel.id === panelId)
      if (target) {
        updater(target)
      }
    }, 'Updated storyboard panel')
  }

  const removeStoryboardPanel = (panelId: string) => {
    commit((draft) => {
      draft.storyboards = draft.storyboards.filter((panel) => panel.id !== panelId)
    }, 'Removed storyboard panel')
  }

  const addShotForSelectedScene = () => {
    if (!resolvedSelectedSceneId) {
      setStatusMessage('Select a scene before adding a shot')
      return
    }

    applyProductionProject(
      addShotToScene(project, resolvedSelectedSceneId, {
        shotNumber: `${selectedSceneShotRows.length + 1}`,
        type: 'MS',
        angle: '',
        lens: '',
        movement: '',
        description: '',
      }),
      'Added shot list row',
    )
  }

  const updateShotListItem = (
    shotId: string,
    updater: (shot: (typeof project.production.shots)[number]) => void,
  ) => {
    commit((draft) => {
      const target = draft.production.shots.find((shot) => shot.id === shotId)
      if (target) {
        updater(target)
      }
    }, 'Updated shot list row')
  }

  const removeShotListItem = (shotId: string) => {
    commit((draft) => {
      draft.production.shots = draft.production.shots.filter((shot) => shot.id !== shotId)
    }, 'Removed shot list row')
  }

  const exportShotListCsv = () => {
    const report = buildShotListCsv(project, resolvedSelectedSceneId ?? undefined)
    triggerDownload(
      report,
      `${project.meta.title || 'untitled'}-shot-list.csv`,
      'text/csv;charset=utf-8',
    )
    setStatusMessage('Shot list CSV downloaded')
  }

  const exportShotListPdf = async () => {
    const rows = buildShotListRows(project, resolvedSelectedSceneId ?? undefined)
    const lines = rows.map(
      (shot) =>
        `${shot.shotNumber} | ${shot.sceneHeading} | ${shot.type} | ${shot.angle} | ${shot.lens} | ${shot.movement} | ${shot.description}`,
    )
    const output = await exportTextReportToPdf('Shot List', lines)
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-shot-list.pdf`,
      'application/pdf',
    )
    setStatusMessage('Shot list PDF downloaded')
  }

  const exportStoryboardPdf = async () => {
    const pages = buildStoryboardExportPages(project)
    const lines = pages.flatMap((page) => [
      page.sceneHeading,
      page.label,
      page.description,
      '',
    ])
    const output = await exportTextReportToPdf('Storyboard Export', lines)
    triggerBinaryDownload(
      output,
      `${project.meta.title || 'untitled'}-storyboards.pdf`,
      'application/pdf',
    )
    setStatusMessage('Storyboard PDF downloaded')
  }

  const addCatalogEntry = (kind: CatalogEntry['kind']) => {
    commit((draft) => {
      draft.catalog.push({
        id: createUuid(),
        kind,
        name: '',
        notes: '',
      })
    }, 'Added catalog entry')
  }

  const importDetectedCatalog = () => {
    const existingKeys = new Set(
      project.catalog.map((entry) => `${entry.kind}:${entry.name.toUpperCase().trim()}`),
    )

    const missing = detectedCatalog.filter(
      (entry) => !existingKeys.has(`${entry.kind}:${entry.name.toUpperCase().trim()}`),
    )

    if (missing.length === 0) {
      setStatusMessage('Catalog already includes detected names')
      return
    }

    commit((draft) => {
      draft.catalog.push(...missing)
    }, 'Imported detected character/location names')
  }

  const updateCatalogEntry = (entryId: string, updater: (entry: CatalogEntry) => void) => {
    commit((draft) => {
      const target = draft.catalog.find((entry) => entry.id === entryId)
      if (target) {
        updater(target)
      }
    }, 'Updated catalog entry')
  }

  const removeCatalogEntry = (entryId: string) => {
    commit((draft) => {
      draft.catalog = draft.catalog.filter((entry) => entry.id !== entryId)
    }, 'Removed catalog entry')
  }

  const applyGlobalCharacterRename = () => {
    if (!renameFrom.trim() || !renameTo.trim()) {
      setStatusMessage('Enter both character names before renaming')
      return
    }

    const renamed = renameCharacterEverywhere(project, renameFrom, renameTo)
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: {
        ...renamed,
        meta: {
          ...renamed.meta,
          updatedAt: new Date().toISOString(),
        },
      },
      future: [],
    }))
    setRenameFrom('')
    setRenameTo('')
    setStatusMessage('Renamed character across script, catalog, and breakdown')
  }

  const rebuildCatalogFromCurrentScript = () => {
    const rebuiltCatalog = rebuildCatalogFromScript(project)
    commit((draft) => {
      draft.catalog = rebuiltCatalog
    }, 'Rebuilt character and location catalog from current script')
  }

  const syncCharacterProfiles = () => {
    const nextProject = ensureProfilesFromScript(project)
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: {
        ...nextProject,
        meta: {
          ...nextProject.meta,
          updatedAt: new Date().toISOString(),
        },
      },
      future: [],
    }))
    setStatusMessage('Synced character profiles from script')
  }

  const updateSelectedCharacterProfile = (
    updates: Partial<{
      bio: string
      notes: string
      imageDataUrl: string
      customFields: CharacterCustomField[]
    }>,
  ) => {
    if (!resolvedCharacterName) {
      setStatusMessage('Select a character before editing profile')
      return
    }

    const nextProject = upsertCharacterProfile(project, resolvedCharacterName, updates)
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: {
        ...nextProject,
        meta: {
          ...nextProject.meta,
          updatedAt: new Date().toISOString(),
        },
      },
      future: [],
    }))
    setStatusMessage('Updated character profile')
  }

  const addSelectedCharacterCustomField = () => {
    const fields = selectedCharacterProfile?.customFields ?? []
    updateSelectedCharacterProfile({
      customFields: [
        ...fields,
        {
          id: createUuid(),
          label: 'Custom Field',
          value: '',
        },
      ],
    })
  }

  const updateSelectedCharacterCustomField = (
    fieldId: string,
    key: 'label' | 'value',
    value: string,
  ) => {
    const fields =
      selectedCharacterProfile?.customFields.map((field) =>
        field.id === fieldId ? { ...field, [key]: value } : field,
      ) ?? []
    updateSelectedCharacterProfile({ customFields: fields })
  }

  const addSelectedCharacterRelationship = () => {
    if (!resolvedCharacterName || !relationshipTo.trim()) {
      setStatusMessage('Choose two characters before adding a relationship')
      return
    }

    const nextProject = addCharacterRelationship(
      project,
      resolvedCharacterName,
      relationshipTo,
      relationshipLabel || 'connected to',
    )
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: nextProject,
      future: [],
    }))
    setRelationshipTo('')
    setRelationshipLabel('')
    setStatusMessage('Added character relationship')
  }

  const updateSelectedCharacterArc = (stage: CharacterArcStage) => {
    if (!resolvedCharacterName || !resolvedSelectedSceneId) {
      setStatusMessage('Select a character and scene before setting arc stage')
      return
    }

    const nextProject = setCharacterArcStage(
      project,
      resolvedCharacterName,
      resolvedSelectedSceneId,
      stage,
    )
    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: nextProject,
      future: [],
    }))
    setStatusMessage('Updated character arc stage')
  }

  const markRecentDialogueAsDual = () => {
    const updated = markLastTwoDialogueGroupsAsDual(project)
    if (updated === project) {
      setStatusMessage('Add two dialogue exchanges before marking dual dialogue')
      return
    }

    setHistory((previous) => ({
      past: [...previous.past.slice(-(historyLimit - 1)), previous.present],
      present: {
        ...updated,
        meta: {
          ...updated.meta,
          updatedAt: new Date().toISOString(),
        },
      },
      future: [],
    }))
    setStatusMessage('Marked the last two dialogue groups as dual dialogue')
  }

  const applyCharacterSuggestion = (blockId: string, name: string) => {
    commit((draft) => {
      const target = draft.blocks.find((block) => block.id === blockId)
      if (target && target.type === 'character') {
        target.text = name
      }
    }, `Applied character suggestion: ${name}`)
    queueFocus(blockId)
  }

  const insertTextIntoActiveBlock = (text: string) => {
    const targetId = activeBlockId
    if (!targetId) {
      return
    }

    const textarea = textareaRefs.current[targetId]
    const targetBlock = project.blocks.find((block) => block.id === targetId)
    if (!targetBlock) {
      return
    }

    const source = textarea?.value ?? targetBlock.text
    const start = textarea?.selectionStart ?? source.length
    const end = textarea?.selectionEnd ?? start
    const nextText = `${source.slice(0, start)}${text}${source.slice(end)}`
    const nextCursor = start + text.length

    setSelectedBlockId(targetId)
    queueFocus(targetId, { start: nextCursor, end: nextCursor })
    onBlockTextChange(targetId, nextText)
  }

  const exportCharacterDialogueReport = () => {
    const report = buildCharacterDialogueReport(project)
    triggerDownload(
      report,
      `${project.meta.title || 'untitled'}-character-dialogue-report.txt`,
      'text/plain;charset=utf-8',
    )
    setStatusMessage('Character/dialogue report downloaded')
  }

  const jumpToDraft = (sceneId: string) => {
    setActiveTab('draft')
    setSelectedSceneId(sceneId)
    setSelectedBlockId(sceneId)
    queueFocus(sceneId)
    setStatusMessage('Jumped to draft scene')
  }

  const appendSidebarBlock = (type: BlockType) => {
    const nextBlock = createBlock(type)

    commit((draft) => {
      draft.blocks.push(nextBlock)
    }, `Added ${blockTypeLabels[type]}`)

    setActiveTab('draft')
    setSelectedBlockId(nextBlock.id)
    if (type === 'scene-heading') {
      setSelectedSceneId(nextBlock.id)
    }
    queueFocus(nextBlock.id)
    setStatusMessage(`Added ${blockTypeLabels[type]}`)
  }

  const onPalettePick = (result: CommandResult) => {
    if (result.id === 'command-import-fountain') {
      setIsCommandPaletteOpen(false)
      setCommandQuery('')
      void importFountain()
      return
    }

    if (result.id === 'command-import-fdx') {
      setIsCommandPaletteOpen(false)
      setCommandQuery('')
      void importFdx()
      return
    }

    if (result.id === 'command-export-fdx') {
      setIsCommandPaletteOpen(false)
      setCommandQuery('')
      void exportFdx()
      return
    }

    if (result.id === 'command-import-docx') {
      setIsCommandPaletteOpen(false)
      setCommandQuery('')
      void importDocx()
      return
    }

    if (result.id === 'command-export-docx') {
      setIsCommandPaletteOpen(false)
      setCommandQuery('')
      void exportDocx()
      return
    }

    if (result.id === 'command-export-pdf') {
      setIsCommandPaletteOpen(false)
      setCommandQuery('')
      void exportPdf()
      return
    }

    if (result.id === 'command-open-preview') {
      setIsCommandPaletteOpen(false)
      setCommandQuery('')
      setActiveTab('preview')
      setStatusMessage('Opened print preview')
      return
    }

    if (result.id === 'command-print-preview') {
      setIsCommandPaletteOpen(false)
      setCommandQuery('')
      setActiveTab('preview')
      window.requestAnimationFrame(() => {
        window.print()
      })
      setStatusMessage('Opened browser print preview')
      return
    }

    if (result.id === 'command-find-replace') {
      openFindReplace()
      return
    }

    if (result.id === 'command-toggle-theme') {
      setIsCommandPaletteOpen(false)
      setCommandQuery('')
      toggleThemeMode()
      return
    }

    if (result.id === 'command-export-character-report') {
      setIsCommandPaletteOpen(false)
      setCommandQuery('')
      exportCharacterDialogueReport()
      return
    }

    if (result.id === 'command-save-snapshot') {
      setIsCommandPaletteOpen(false)
      setCommandQuery('')
      saveRevisionSnapshot()
      return
    }

    if (result.id === 'command-open-snapshot-history') {
      setIsCommandPaletteOpen(false)
      setCommandQuery('')
      openSnapshotHistory()
      return
    }

    const target = searchHits.find((hit) => hit.id === result.id)
    if (!target) {
      return
    }

    setIsCommandPaletteOpen(false)
    setCommandQuery('')
    setActiveTab(target.targetTab)
    if (target.sceneId) {
      setSelectedSceneId(target.sceneId)
    }

    if (target.targetTab === 'draft' && target.focusId) {
      setSelectedBlockId(target.focusId)
      queueFocus(target.focusId)
    } else if (target.focusId) {
      queueScroll(target.focusId)
    }

    setStatusMessage(`Jumped to ${target.typeLabel.toLowerCase()}`)
  }

  const closeCommandPalette = () => {
    setIsCommandPaletteOpen(false)
    setCommandQuery('')
  }

  const applyBlockFormat = (type: BlockType) => {
    if (activeBlockId) {
      setSelectedBlockId(activeBlockId)
      onBlockTypeChange(activeBlockId, type)
      return
    }

    if (project.blocks.length > 0) {
      addBlockAfter(project.blocks.length - 1, type)
      return
    }

    const newBlock = createBlock(type)
    queueFocus(newBlock.id)
    setSelectedBlockId(newBlock.id)
    commit((draft) => {
      draft.blocks.push(newBlock)
    }, `Inserted ${blockTypeLabels[type]} block`)
  }

  const getWorkspaceLabel = (tabId: WorkspaceTab) =>
    workspaceTabs.find((tab) => tab.id === tabId)?.label ?? tabId

  const renderRailIcon = (tabId: WorkspaceTab) => {
    switch (tabId) {
      case 'draft':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        )
      case 'preview':
        return (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2 6h20v12H2z" />
            <path d="M8 10h8" />
            <path d="M8 14h8" />
          </svg>
        )
      case 'planning':
        return (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        )
      case 'productivity':
        return (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        )
      case 'production':
        return (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        )
      case 'breakdown':
        return (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 5h16" />
            <path d="M4 12h16" />
            <path d="M4 19h16" />
            <path d="M8 3v18" />
          </svg>
        )
      case 'reports':
        return (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 19V5" />
            <path d="M9 19v-7" />
            <path d="M14 19V9" />
            <path d="M19 19V7" />
            <path d="M3 19h18" />
          </svg>
        )
      case 'advanced':
        return (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2v20" />
            <path d="M4 6h16" />
            <path d="M6 12h12" />
            <path d="M8 18h8" />
          </svg>
        )
      case 'budget':
        return (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M7 10h10" />
            <path d="M7 14h6" />
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          </svg>
        )
      case 'storyboards':
        return (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
            <path d="M3 10h18" />
            <path d="M9 4v16" />
          </svg>
        )
      case 'catalog':
        return (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="7" r="4" />
            <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
          </svg>
        )
      default:
        return null
    }
  }

  useEffect(() => {
    keyboardActionsRef.current = {
      saveProject,
      openProject,
      createNewProject,
    }
  })

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const withMod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (!withMod) {
        return
      }

      if (appView === 'home') {
        if (key === 'n') {
          event.preventDefault()
          keyboardActionsRef.current.createNewProject()
        }

        if (key === 'o') {
          event.preventDefault()
          void keyboardActionsRef.current.openProject()
        }

        return
      }

      if (key === 'k') {
        event.preventDefault()
        setIsCommandPaletteOpen(true)
        return
      }

      if (key === 'f' || key === 'h') {
        event.preventDefault()
        setActiveTab('draft')
        setIsCommandPaletteOpen(false)
        setCommandQuery('')
        setFindCursor(0)
        setIsFindReplaceOpen(true)
        return
      }

      if (key === 's') {
        event.preventDefault()
        void keyboardActionsRef.current.saveProject()
        return
      }

      if (key === 'p') {
        event.preventDefault()
        setActiveTab('preview')
        window.requestAnimationFrame(() => {
          window.print()
        })
        setStatusMessage('Opened browser print preview')
        return
      }

      if (key === 'o') {
        event.preventDefault()
        void keyboardActionsRef.current.openProject()
        return
      }

      if (key === 'n') {
        event.preventDefault()
        keyboardActionsRef.current.createNewProject()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [appView])

  const isRunningInElectron = Boolean(window.masterscript?.isElectron)
  const showDownloadButton = shouldShowDownloadButton(isRunningInElectron)

  return (
    <div className={appShellClass}>
      {appView === 'home' && (
        <section className="home-shell">
          <div className="home-card">
            <p className="home-eyebrow">MasterScript</p>
            <h1>Welcome to your writing workspace</h1>
            <p>
              Start a new screenplay, open an existing project, or import a Fountain file.
            </p>

            <div className="home-actions">
              {showDownloadButton && (
                <div className="download-links" aria-label="Desktop app downloads">
                  {DESKTOP_DOWNLOAD_LINKS.map((link) => (
                    <a
                      key={link.label}
                      className="download-btn"
                      href={link.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
              <button className="share-btn" onClick={createNewProject}>
                New Project
              </button>
              <button className="ghost-btn" onClick={openProject}>
                Open Project
              </button>
              <button className="ghost-btn" onClick={() => void importFountain()}>
                Import Fountain
              </button>
              <button className="ghost-btn" onClick={toggleThemeMode}>
                Settings (Theme: {themeMode === 'dark' ? 'Dark' : 'Light'})
              </button>
            </div>

            <div className="home-collaboration-join">
              <h2>Join Collaboration</h2>
              <input
                value={startScreenInviteInput}
                onChange={(event) => setStartScreenInviteInput(event.target.value)}
                placeholder="masterscript://collab?mode=webrtc..."
                disabled={isBootstrappingCollaboration}
              />
              <div className="inline-actions">
                <button
                  className="share-btn"
                  onClick={() => void joinCollaborationFromStartScreen()}
                  disabled={isBootstrappingCollaboration}
                >
                  Join Project
                </button>
                {isBootstrappingCollaboration && (
                  <button className="ghost-btn" onClick={cancelCollaborationBootstrap}>
                    Cancel
                  </button>
                )}
              </div>
              {collaborationJoinStatus && (
                <p className="small-copy">{collaborationJoinStatus}</p>
              )}
            </div>

            <div className="home-recent">
              <h2>Recent Activity</h2>
              {recentProjects.length === 0 && (
                <p className="small-copy">No recent projects yet.</p>
              )}
              {recentProjects.map((entry) => (
                <button
                  key={`${entry.label}-${entry.updatedAt}`}
                  className="home-recent-item"
                  onClick={() => void openRecentProject(entry)}
                  title={
                    isLikelyLocalProjectPath(entry.label)
                      ? 'Open recent project'
                      : 'Open Project may be required'
                  }
                >
                  <strong>{entry.label}</strong>
                  <span>
                    {entry.source === 'import' ? 'Imported' : 'Project'} ·{' '}
                    {new Date(entry.updatedAt).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {appView === 'workspace' && (
        <>
      <header className="app-header">
        <div className="header-left">
          <button
            className="icon-btn"
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Open command palette"
            aria-label="Open command palette"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <label className="header-title-wrap">
            <span>Project Title</span>
            <input
              className="project-title-input"
              value={project.meta.title}
              onChange={onTitleChange}
              placeholder="Untitled Screenplay"
            />
          </label>
        </div>

        <div className="header-actions">
          <button className="ghost-btn" onClick={() => setAppView('home')}>
            Home
          </button>
          <button className="ghost-btn" onClick={createNewProject}>
            New
          </button>
          <button className="ghost-btn" onClick={openProject}>
            Open
          </button>
          <button className="ghost-btn" onClick={() => void importFdx()}>
            Import FDX
          </button>
          <button className="ghost-btn" onClick={() => void importFountain()}>
            Import Fountain
          </button>
          <button className="ghost-btn" onClick={() => void importDocx()}>
            Import DOCX
          </button>
          <button className="ghost-btn" onClick={() => void exportFdx()}>
            Export FDX
          </button>
          <button className="ghost-btn" onClick={() => void exportDocx()}>
            Export DOCX
          </button>
          <button className="ghost-btn" onClick={() => void exportPdf()}>
            Export PDF
          </button>
          <button
            className="ghost-btn"
            onClick={() => {
              setActiveTab('preview')
              setStatusMessage('Opened print preview')
            }}
          >
            Print Preview
          </button>
          <button className="ghost-btn" onClick={toggleThemeMode}>
            Theme: {themeMode === 'dark' ? 'Dark' : 'Light'}
          </button>
          <button className="ghost-btn" onClick={openFindReplace}>
            Find/Replace
          </button>
          <button className="ghost-btn" onClick={openSnapshotHistory}>
            Snapshots
          </button>
          <button className="ghost-btn" onClick={undo} disabled={history.past.length === 0}>
            Undo
          </button>
          <button className="ghost-btn" onClick={redo} disabled={history.future.length === 0}>
            Redo
          </button>
          <button className="ghost-btn" onClick={openCollaborationPanel}>
            Collaborate
          </button>
          <button className="share-btn" onClick={saveProject}>
            Share
          </button>
        </div>
      </header>

      <div className="workspace-shell">
        <aside className="left-rail">
          <div className="rail-group">
            {workspaceTabs.slice(0, 4).map((tab) => (
              <button
                key={tab.id}
                className={tab.id === activeTab ? 'rail-btn active' : 'rail-btn'}
                onClick={() => setActiveTab(tab.id)}
                title={getWorkspaceLabel(tab.id)}
                aria-label={getWorkspaceLabel(tab.id)}
              >
                {renderRailIcon(tab.id)}
              </button>
            ))}
          </div>

          <div className="rail-group rail-group-bottom">
            {workspaceTabs.slice(4).map((tab) => (
              <button
                key={tab.id}
                className={tab.id === activeTab ? 'rail-btn active' : 'rail-btn'}
                onClick={() => setActiveTab(tab.id)}
                title={getWorkspaceLabel(tab.id)}
                aria-label={getWorkspaceLabel(tab.id)}
              >
                {renderRailIcon(tab.id)}
              </button>
            ))}

            <button
              className="rail-btn"
              onClick={exportFountain}
              title="Export Fountain"
              aria-label="Export Fountain"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M4 21h16" />
              </svg>
            </button>
          </div>
        </aside>

        <main className="editor-shell">
          <div className="editor-scroll">
            {activeTab === 'draft' && useContinuousDraftEditor && (
              <section className="script-page continuous-draft-page tab-enter" data-purpose="script-page">
                <textarea
                  ref={continuousDraftRef}
                  className="continuous-draft-input"
                  value={continuousDraftText}
                  onChange={onContinuousDraftChange}
                  onSelect={captureContinuousSelection}
                  onKeyDown={onContinuousDraftKeyDown}
                  spellCheck
                  placeholder={continuousDraftPlaceholder}
                />
              </section>
            )}

            {activeTab === 'draft' && !useContinuousDraftEditor && (
              <>
                {editorPages.map((page) => (
                  <section
                    key={`editor-page-${page.scriptPageNumber}`}
                    className="script-page editor-script-page tab-enter"
                    data-purpose="script-page"
                    data-script-page-number={page.scriptPageNumber}
                    aria-label={`Script page ${page.scriptPageNumber}`}
                  >
                    {page.blocks.map((block) => {
                      const index = blockIndexById.get(block.id) ?? 0

                      return (
                        <article
                          key={block.id}
                          ref={(node) => {
                            itemRefs.current[block.id] = node
                          }}
                          className={`script-block ${block.type}${
                            highlightedId === block.id ? ' highlighted' : ''
                          }${draggingBlockId === block.id ? ' dragging' : ''}`}
                          data-block-type={block.type}
                          data-scene-number={
                            block.type === 'scene-heading'
                              ? sceneNumberLabelById.get(block.id) ?? ''
                              : undefined
                          }
                          draggable
                          onDragStart={() => setDraggingBlockId(block.id)}
                          onDragEnd={() => setDraggingBlockId(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => onBlockDrop(block.id)}
                        >
                          <textarea
                            ref={(node) => {
                              textareaRefs.current[block.id] = node
                            }}
                            className={`script-input ${block.type}${
                              activeBlockId === block.id ? ' selected' : ''
                            }`}
                            value={block.text}
                            onFocus={() => {
                              setSelectedBlockId(block.id)
                              if (block.type === 'scene-heading') {
                                setSelectedSceneId(block.id)
                              }
                            }}
                            onChange={(event) => onBlockTextChange(block.id, event.target.value)}
                            onKeyDown={(event) =>
                              onBlockKeyDown(event, index, block.id, block.type)
                            }
                            rows={Math.max(1, block.text.split('\n').length)}
                            placeholder={blockTypePlaceholders[block.type]}
                          />

                          {block.type === 'character' &&
                            activeBlockId === block.id &&
                            activeCharacterSuggestions.length > 0 && (
                              <div className="character-suggestions" role="listbox">
                                {activeCharacterSuggestions.map((name) => (
                                  <button
                                    key={`${block.id}-${name}`}
                                    className="character-suggestion-btn"
                                    onMouseDown={(event) => {
                                      event.preventDefault()
                                      applyCharacterSuggestion(block.id, name)
                                    }}
                                  >
                                    {name}
                                  </button>
                                ))}
                              </div>
                            )}
                        </article>
                      )
                    })}

                    {page.showPageNumber && (
                      <div className="editor-page-number" aria-hidden="true">
                        {page.scriptPageNumber}
                      </div>
                    )}
                  </section>
                ))}
              </>
            )}

            {activeTab === 'preview' && (
              <section className="module-layout module-surface preview-layout tab-enter">
                <div className="module-heading">
                  <h2>Print Preview</h2>
                  <div className="inline-actions preview-toolbar">
                    <button
                      onClick={() =>
                        setPreviewPageIndex((current) => Math.max(0, current - 1))
                      }
                      disabled={resolvedPreviewPageIndex === 0}
                    >
                      Previous Page
                    </button>
                    <button
                      onClick={() =>
                        setPreviewPageIndex((current) =>
                          Math.min(previewPageCount - 1, current + 1),
                        )
                      }
                      disabled={resolvedPreviewPageIndex >= previewPageCount - 1}
                    >
                      Next Page
                    </button>
                    <p className="small-copy">
                      {previewPageCount === 0
                        ? 'No pages'
                        : `Page ${resolvedPreviewPageIndex + 1} of ${previewPageCount} (${previewPage?.kind === 'title' ? 'Title Page' : `Script Page ${previewPage?.scriptPageNumber ?? 1}`})`}
                    </p>
                    <label className="preview-zoom-control">
                      <span>Zoom {Math.round(previewZoom * 100)}%</span>
                      <input
                        type="range"
                        min={0.55}
                        max={1.6}
                        step={0.05}
                        value={previewZoom}
                        onChange={(event) =>
                          setPreviewZoom(Number(event.target.value) || defaultPreviewZoom)
                        }
                      />
                    </label>
                    <button onClick={() => setPreviewZoom(defaultPreviewZoom)}>
                      Reset Zoom
                    </button>
                    <button
                      onClick={() => {
                        window.requestAnimationFrame(() => {
                          window.print()
                        })
                        setStatusMessage('Opened browser print preview')
                      }}
                    >
                      Print...
                    </button>
                    <button onClick={() => void exportPdf()}>Export PDF</button>
                  </div>
                </div>

                <div className="preview-meta-grid">
                  <label>
                    <span>Author</span>
                    <input
                      value={project.meta.author}
                      onChange={(event) =>
                        updatePrintMetaText(
                          'author',
                          event.target.value,
                          'Updated print author',
                        )
                      }
                      placeholder="Writer name"
                    />
                  </label>
                  <label>
                    <span>Credits</span>
                    <input
                      value={project.meta.credits}
                      onChange={(event) =>
                        updatePrintMetaText(
                          'credits',
                          event.target.value,
                          'Updated print credits',
                        )
                      }
                      placeholder="Written by"
                    />
                  </label>
                  <label>
                    <span>Title Page Date</span>
                    <input
                      value={project.meta.draftDate}
                      onChange={(event) =>
                        updatePrintMetaText(
                          'draftDate',
                          event.target.value,
                          'Updated draft date',
                        )
                      }
                      placeholder="YYYY-MM-DD"
                    />
                  </label>
                  <label>
                    <span>Contact</span>
                    <input
                      value={project.meta.contact}
                      onChange={(event) =>
                        updatePrintMetaText(
                          'contact',
                          event.target.value,
                          'Updated print contact',
                        )
                      }
                      placeholder="Email or phone"
                    />
                  </label>
                  <label className="preview-meta-wide">
                    <span>Title Page Notes</span>
                    <textarea
                      rows={3}
                      value={project.meta.titlePageNotes}
                      onChange={(event) =>
                        updatePrintMetaText(
                          'titlePageNotes',
                          event.target.value,
                          'Updated title page notes',
                        )
                      }
                      placeholder="Optional notes to print on title page"
                    />
                  </label>
                  <label className="toggle-row compact">
                    <input
                      type="checkbox"
                      checked={project.meta.includeTitlePage}
                      onChange={(event) =>
                        updatePrintMetaFlag(
                          'includeTitlePage',
                          event.target.checked,
                          'Toggled title page',
                        )
                      }
                    />
                    <span>Include title page</span>
                  </label>
                  <label className="toggle-row compact">
                    <input
                      type="checkbox"
                      checked={project.meta.showPageNumbers}
                      onChange={(event) =>
                        updatePrintMetaFlag(
                          'showPageNumbers',
                          event.target.checked,
                          'Toggled page numbers',
                        )
                      }
                    />
                    <span>Show page numbers</span>
                  </label>
                  <label className="toggle-row compact">
                    <input
                      type="checkbox"
                      checked={project.meta.showSceneNumbers}
                      onChange={(event) =>
                        updatePrintMetaFlag(
                          'showSceneNumbers',
                          event.target.checked,
                          'Toggled scene numbers',
                        )
                      }
                    />
                    <span>Show scene numbers</span>
                  </label>
                </div>

                <div className="preview-stage">
                  {previewPage ? (
                    <div className="preview-page-shell">
                      <div
                        className="preview-page-paper"
                        style={{
                          width: `${printLayout.config.pageWidth}px`,
                          height: `${printLayout.config.pageHeight}px`,
                          transform: `scale(${previewZoom})`,
                        }}
                      >
                        {previewPage.lines.map((line) => (
                          <p
                            key={line.id}
                            className={`preview-line role-${line.role}${
                              line.bold ? ' is-bold' : ''
                            }`}
                            style={{
                              left: `${line.x}px`,
                              top: `${printLayout.config.pageHeight - line.y - line.fontSize}px`,
                              fontSize: `${line.fontSize}px`,
                            }}
                          >
                            {line.text}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="small-copy">No printable content yet.</p>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'planning' && (
              <section className="module-layout module-surface tab-enter">
                <div className="module-heading">
                  <h2>Outliner and Beat Board</h2>
                  <div className="inline-actions">
                    <select
                      value={selectedTemplateId}
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                    >
                      {storyTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    <button onClick={insertTemplateCards}>Insert Template</button>
                    <button onClick={addCard}>Add Beat</button>
                  </div>
                </div>

                <div className="story-dev-grid">
                  <section className="story-dev-panel">
                    <div className="module-heading compact-heading">
                      <h2>Outline Tree</h2>
                      <button onClick={syncGeneratedOutline}>Sync From Script</button>
                    </div>
                    {storyOutline.map((act) => (
                      <div className="outline-tree-node act-node" key={act.id}>
                        <strong>{act.title}</strong>
                        {act.children.map((sequence) => (
                          <div className="outline-tree-node sequence-node" key={sequence.id}>
                            <span>{sequence.title}</span>
                            {sequence.children.map((sceneNode) => (
                              <button
                                key={sceneNode.id}
                                draggable
                                onDragStart={() =>
                                  setDraggingOutlineSceneId(sceneNode.sceneId ?? null)
                                }
                                onDragEnd={() => setDraggingOutlineSceneId(null)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => {
                                  if (sceneNode.sceneId) {
                                    reorderOutlineScene(sceneNode.sceneId)
                                  }
                                }}
                                onClick={() => {
                                  if (sceneNode.sceneId) {
                                    setSelectedSceneId(sceneNode.sceneId)
                                    jumpToDraft(sceneNode.sceneId)
                                  }
                                }}
                              >
                                {sceneNode.title}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </section>

                  <section className="story-dev-panel">
                    <div className="module-heading compact-heading">
                      <h2>Scene Metadata</h2>
                    </div>
                    <label>
                      <span>Status</span>
                      <select
                        value={selectedSceneDevelopment?.status ?? 'Draft'}
                        onChange={(event) =>
                          updateSelectedSceneDevelopment({
                            status: event.target.value as SceneStatus,
                          })
                        }
                      >
                        <option>Draft</option>
                        <option>In Progress</option>
                        <option>Final</option>
                        <option>Needs Revision</option>
                      </select>
                    </label>
                    <label>
                      <span>Scene Color</span>
                      <input
                        type="color"
                        value={selectedSceneDevelopment?.color ?? '#2f2f2f'}
                        onChange={(event) =>
                          updateSelectedSceneDevelopment({ color: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Act Marker</span>
                      <input
                        value={selectedSceneDevelopment?.actBreak ?? ''}
                        onChange={(event) =>
                          updateSelectedSceneDevelopment({ actBreak: event.target.value })
                        }
                        placeholder="Act 1 Break"
                      />
                    </label>
                    <label>
                      <span>Summary</span>
                      <textarea
                        rows={3}
                        value={selectedSceneDevelopment?.summary ?? ''}
                        onChange={(event) =>
                          updateSelectedSceneDevelopment({ summary: event.target.value })
                        }
                        placeholder="Scene purpose, conflict, or outcome"
                      />
                    </label>
                  </section>

                  <section className="story-dev-panel">
                    <div className="module-heading compact-heading">
                      <h2>Notes</h2>
                    </div>
                    <textarea
                      rows={3}
                      value={storyState.notes.script}
                      onChange={(event) => updateStoryNote('script', event.target.value)}
                      placeholder="Script-level notes"
                    />
                    <textarea
                      rows={3}
                      value={selectedSceneNote}
                      onChange={(event) => updateStoryNote('scene', event.target.value)}
                      placeholder="Scene-level notes"
                    />
                    <textarea
                      rows={3}
                      value={storyState.notes.scratchpad}
                      onChange={(event) => updateStoryNote('scratchpad', event.target.value)}
                      placeholder="Scratch notepad"
                    />
                    <button onClick={() => updateStoryNote('inline', 'Inline note')}>
                      Add Inline Note
                    </button>
                  </section>
                </div>

                <div className="cards-grid">
                  {project.cards.map((card) => (
                    <article
                      key={card.id}
                      ref={(node) => {
                        itemRefs.current[card.id] = node
                      }}
                      className={`story-card${highlightedId === card.id ? ' highlighted' : ''}${
                        draggingCardId === card.id ? ' dragging' : ''
                      }`}
                      draggable
                      onDragStart={() => setDraggingCardId(card.id)}
                      onDragEnd={() => setDraggingCardId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => onCardDrop(card.id)}
                    >
                      <input
                        value={card.title}
                        onChange={(event) =>
                          updateCard(card.id, (target) => {
                            target.title = event.target.value
                          })
                        }
                        placeholder="Beat title"
                      />
                      <div className="corkboard-controls">
                        <input
                          type="number"
                          value={card.x ?? 0}
                          onChange={(event) =>
                            updateCardCorkboard(card.id, {
                              x: Number(event.target.value) || 0,
                            })
                          }
                          aria-label="Card X position"
                        />
                        <input
                          type="number"
                          value={card.y ?? 0}
                          onChange={(event) =>
                            updateCardCorkboard(card.id, {
                              y: Number(event.target.value) || 0,
                            })
                          }
                          aria-label="Card Y position"
                        />
                        <input
                          type="color"
                          value={card.color ?? '#2f2f2f'}
                          onChange={(event) =>
                            updateCardCorkboard(card.id, { color: event.target.value })
                          }
                          aria-label="Card color"
                        />
                      </div>
                      <textarea
                        value={card.beat}
                        onChange={(event) =>
                          updateCard(card.id, (target) => {
                            target.beat = event.target.value
                          })
                        }
                        rows={4}
                        placeholder="Story beat"
                      />
                      <select
                        value={card.linkedSceneId ?? ''}
                        onChange={(event) =>
                          updateCard(card.id, (target) => {
                            target.linkedSceneId = event.target.value || null
                          })
                        }
                      >
                        <option value="">Link to scene (optional)</option>
                        {scenes.map((scene, index) => (
                          <option key={scene.blockId} value={scene.blockId}>
                            S{index + 1} - {scene.heading}
                          </option>
                        ))}
                      </select>
                      <input
                        value={card.imageDataUrl ?? ''}
                        onChange={(event) =>
                          updateCardCorkboard(card.id, { imageDataUrl: event.target.value })
                        }
                        placeholder="Image data URL or reference"
                      />
                      <button onClick={() => removeCard(card.id)}>Remove</button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'productivity' && (
              <section className="module-layout module-surface tab-enter">
                <div className="module-heading">
                  <h2>Writing Productivity</h2>
                  <div className="inline-actions">
                    <button onClick={logWritingToday}>Log Today</button>
                    <button onClick={assignBrowserVoices}>Assign Voices</button>
                  </div>
                </div>

                <div className="productivity-grid">
                  <section className="productivity-panel">
                    <div className="module-heading compact-heading">
                      <h2>Modes</h2>
                    </div>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={productivityState.settings.focusMode}
                        onChange={(event) =>
                          toggleProductivityMode('focusMode', event.target.checked)
                        }
                      />
                      <span>Focus mode</span>
                    </label>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={productivityState.settings.typewriterMode}
                        onChange={(event) =>
                          toggleProductivityMode('typewriterMode', event.target.checked)
                        }
                      />
                      <span>Typewriter scroll</span>
                    </label>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={productivityState.settings.fullscreenMode}
                        onChange={(event) =>
                          toggleProductivityMode('fullscreenMode', event.target.checked)
                        }
                      />
                      <span>Distraction-free full screen</span>
                    </label>
                  </section>

                  <section className="productivity-panel">
                    <div className="module-heading compact-heading">
                      <h2>Goals</h2>
                    </div>
                    <div className="goal-input-row">
                      <label>
                        <span>Daily Pages</span>
                        <input
                          type="number"
                          min={0}
                          step={0.25}
                          value={productivityState.goals.dailyPagesWritten}
                          onChange={(event) =>
                            updateProductivityGoal(
                              'dailyPagesWritten',
                              Number(event.target.value) || 0,
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>Daily Goal</span>
                        <input
                          type="number"
                          min={0}
                          step={0.25}
                          value={productivityState.goals.dailyPageGoal}
                          onChange={(event) =>
                            updateProductivityGoal(
                              'dailyPageGoal',
                              Number(event.target.value) || 0,
                            )
                          }
                        />
                      </label>
                    </div>
                    <div className="progress-meter">
                      <span style={{ width: `${goalProgress.dailyPercent}%` }} />
                    </div>
                    <p className="small-copy">{goalProgress.dailyPercent}% daily progress</p>
                    <label>
                      <span>Project Page Goal</span>
                      <input
                        type="number"
                        min={1}
                        value={productivityState.goals.projectPageGoal}
                        onChange={(event) =>
                          updateProductivityGoal(
                            'projectPageGoal',
                            Number(event.target.value) || 1,
                          )
                        }
                      />
                    </label>
                    <div className="progress-meter">
                      <span style={{ width: `${goalProgress.projectPercent}%` }} />
                    </div>
                    <p className="small-copy">
                      {stats.estimatedPages} pages estimated, {goalProgress.projectPercent}% of
                      project goal
                    </p>
                  </section>

                  <section className="productivity-panel">
                    <div className="module-heading compact-heading">
                      <h2>Sprint</h2>
                    </div>
                    <div className="timer-display">
                      {formatTimer(productivityState.sprints.remainingSeconds)}
                    </div>
                    <label>
                      <span>Minutes</span>
                      <input
                        type="number"
                        min={1}
                        value={productivityState.sprints.activeMinutes}
                        disabled={productivityState.sprints.isRunning}
                        onChange={(event) =>
                          updateSprintMinutes(Number(event.target.value) || 1)
                        }
                      />
                    </label>
                    <div className="inline-actions">
                      <button
                        onClick={startSprintTimer}
                        disabled={productivityState.sprints.isRunning}
                      >
                        Start
                      </button>
                      <button
                        onClick={finishSprintTimer}
                        disabled={!productivityState.sprints.isRunning}
                      >
                        Finish
                      </button>
                    </div>
                    <div className="session-list">
                      {productivityState.sprints.sessions.slice(0, 5).map((session) => (
                        <span key={session.id}>
                          {session.minutes} min | {session.wordDelta} words |{' '}
                          {new Date(session.endedAt).toLocaleDateString()}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="productivity-panel">
                    <div className="module-heading compact-heading">
                      <h2>Streak</h2>
                    </div>
                    <div className="outline-stats-grid">
                      <article className="outline-stat">
                        <span>Current</span>
                        <strong>{productivityState.streak.current}</strong>
                      </article>
                      <article className="outline-stat">
                        <span>Longest</span>
                        <strong>{productivityState.streak.longest}</strong>
                      </article>
                    </div>
                    <p className="small-copy">
                      Last writing day: {productivityState.streak.lastWritingDate ?? 'None'}
                    </p>
                  </section>

                  <section className="productivity-panel readthrough-panel">
                    <div className="module-heading compact-heading">
                      <h2>TTS Read-Through</h2>
                    </div>
                    <label>
                      <span>Speed</span>
                      <input
                        type="range"
                        min={0.5}
                        max={2}
                        step={0.1}
                        value={productivityState.tts.speed}
                        onChange={(event) => updateTtsSpeed(Number(event.target.value))}
                      />
                    </label>
                    <p className="small-copy">{productivityState.tts.speed.toFixed(1)}x</p>
                    <div className="inline-actions">
                      <button onClick={startReadThrough}>
                        {readThroughState === 'playing' ? 'Restart' : 'Play'}
                      </button>
                      <button
                        onClick={pauseReadThrough}
                        disabled={readThroughState === 'stopped'}
                      >
                        {readThroughState === 'paused' ? 'Resume' : 'Pause'}
                      </button>
                      <button
                        onClick={stopReadThrough}
                        disabled={readThroughState === 'stopped'}
                      >
                        Stop
                      </button>
                    </div>
                    <div className="tts-queue">
                      {readThroughQueue.slice(0, 24).map((item, index) => (
                        <button
                          key={item.id}
                          className={index === readThroughIndex ? 'active' : ''}
                          onClick={() => {
                            setReadThroughIndex(index)
                            speakReadThroughItem(index)
                          }}
                        >
                          <strong>{item.speaker}</strong>
                          <span>{item.text}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              </section>
            )}

            {activeTab === 'production' && (
              <section className="module-layout module-surface tab-enter">
                <div className="module-heading">
                  <h2>Stripboard and Schedule</h2>
                  <div className="inline-actions">
                    <select
                      value={resolvedShootDay}
                      onChange={(event) => setSelectedShootDay(Number(event.target.value) || 1)}
                    >
                      {(availableShootDays.length > 0 ? availableShootDays : [1]).map((day) => (
                        <option key={day} value={day}>
                          Day {day}
                        </option>
                      ))}
                    </select>
                    <button onClick={addScheduleEntry}>Add Schedule Row</button>
                    <button onClick={regenerateProductionBreakdown}>Generate Breakdown</button>
                    <button onClick={exportDayOutOfDays}>Export Day-Out-of-Days</button>
                    <button onClick={() => void exportCallSheetPdf()}>Call Sheet PDF</button>
                    <button onClick={() => void exportScriptSidesPdf()}>Sides PDF</button>
                    <button onClick={exportCharacterDialogueReport}>
                      Export Character Report
                    </button>
                    <button onClick={() => addBreakdownEntity('prop')}>Add Prop</button>
                  </div>
                </div>

                <div className="production-tools-grid">
                  <section className="production-tool-panel">
                    <div className="module-heading compact-heading">
                      <h2>Stripboard</h2>
                    </div>
                    <div className="stripboard-list">
                      {stripboardRows.map((strip) => (
                        <article
                          key={strip.id}
                          className="stripboard-strip"
                          draggable
                          onDragStart={() => setDraggingScheduleId(strip.id)}
                          onDragEnd={() => setDraggingScheduleId(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => reorderScheduleEntry(strip.id)}
                          style={{ borderLeftColor: strip.color }}
                        >
                          <strong>
                            Day {strip.day} | S{strip.sceneNumber ?? '-'} | {strip.heading}
                          </strong>
                          <span>{strip.location || 'No location'}</span>
                          <span>{strip.cast.length > 0 ? strip.cast.join(', ') : 'No cast'}</span>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="production-tool-panel">
                    <div className="module-heading compact-heading">
                      <h2>Day-Out-of-Days</h2>
                    </div>
                    <div
                      className="dood-grid"
                      style={{
                        gridTemplateColumns: `minmax(120px, 1fr) repeat(${Math.max(
                          doodGrid.days.length,
                          1,
                        )}, 54px)`,
                      }}
                    >
                      <strong>Character</strong>
                      {doodGrid.days.map((day) => (
                        <strong key={day}>D{day}</strong>
                      ))}
                      {doodGrid.rows.map((row) => (
                        <Fragment key={row.character}>
                          <span>{row.character}</span>
                          {row.markers.map((marker, index) => (
                            <span key={`${row.character}-${doodGrid.days[index]}`}>
                              {marker}
                            </span>
                          ))}
                        </Fragment>
                      ))}
                    </div>
                  </section>

                  <section className="production-tool-panel">
                    <div className="module-heading compact-heading">
                      <h2>Call Sheet Preview</h2>
                    </div>
                    <div className="call-sheet-preview">
                      {callSheetPreview.scenes.map((scene) => (
                        <span key={`${scene.sceneId ?? 'none'}-${scene.heading}`}>
                          S{scene.sceneNumber ?? '-'} | {scene.heading}
                        </span>
                      ))}
                      <strong>Cast</strong>
                      <span>{callSheetPreview.cast.join(', ') || 'None'}</span>
                      <strong>Crew</strong>
                      <span>
                        {callSheetPreview.crew.map((crew) => crew.name).join(', ') || 'None'}
                      </span>
                    </div>
                  </section>

                  <section className="production-tool-panel">
                    <div className="module-heading compact-heading">
                      <h2>Sides Preview</h2>
                    </div>
                    <div className="call-sheet-preview">
                      {scriptSidesPreview.scenes.map((scene) => (
                        <span key={scene.sceneId}>
                          {scene.heading} | {scene.blocks.length} blocks
                          {scene.hasRevisionMarks ? ' | revisions' : ''}
                        </span>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="table-layout">
                  <div className="table-header">Day</div>
                  <div className="table-header">Scene</div>
                  <div className="table-header">Location</div>
                  <div className="table-header">Notes</div>
                  <div className="table-header">Actions</div>

                  {project.production.schedule.map((entry) => (
                    <Fragment key={entry.id}>
                      <input
                        ref={(node) => {
                          itemRefs.current[entry.id] = node
                        }}
                        className={highlightedId === entry.id ? 'highlighted' : ''}
                        type="number"
                        min={1}
                        value={entry.day}
                        onChange={(event) =>
                          updateScheduleEntry(entry.id, (target) => {
                            target.day = Number(event.target.value) || 1
                          })
                        }
                      />
                      <select
                        value={entry.sceneId ?? ''}
                        onChange={(event) =>
                          updateScheduleEntry(entry.id, (target) => {
                            target.sceneId = event.target.value || null
                            if (event.target.value) {
                              setSelectedSceneId(event.target.value)
                            }
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {scenes.map((scene, index) => (
                          <option key={scene.blockId} value={scene.blockId}>
                            S{index + 1} - {scene.heading}
                          </option>
                        ))}
                      </select>
                      <input
                        value={entry.location}
                        onChange={(event) =>
                          updateScheduleEntry(entry.id, (target) => {
                            target.location = event.target.value
                          })
                        }
                        placeholder="Location"
                      />
                      <input
                        value={entry.notes}
                        onChange={(event) =>
                          updateScheduleEntry(entry.id, (target) => {
                            target.notes = event.target.value
                          })
                        }
                        placeholder="Shooting notes"
                      />
                      <button onClick={() => removeScheduleEntry(entry.id)}>Remove</button>
                    </Fragment>
                  ))}
                </div>

                <div className="module-heading subheading">
                  <h2>Breakdown Entities</h2>
                  <p className="small-copy">
                    {project.production.breakdown.length} tracked items
                  </p>
                </div>

                <div className="table-layout breakdown-table">
                  <div className="table-header">Kind</div>
                  <div className="table-header">Name</div>
                  <div className="table-header">Scenes</div>
                  <div className="table-header">Notes</div>
                  <div className="table-header">Actions</div>

                  {project.production.breakdown.map((entry) => (
                    <Fragment key={entry.id}>
                      <select
                        value={entry.kind}
                        onChange={(event) =>
                          updateBreakdownEntry(entry.id, (target) => {
                            target.kind = event.target.value as BreakdownKind
                          })
                        }
                      >
                        <option value="cast">Cast</option>
                        <option value="location">Location</option>
                        <option value="prop">Prop</option>
                        <option value="vehicle">Vehicle</option>
                        <option value="equipment">Equipment</option>
                        <option value="crew">Crew</option>
                      </select>
                      <input
                        value={entry.name}
                        onChange={(event) =>
                          updateBreakdownEntry(entry.id, (target) => {
                            target.name = event.target.value
                          })
                        }
                        placeholder="Entity name"
                      />
                      <p className="scene-pill-list">
                        {entry.sceneIds.length === 0
                          ? 'No linked scenes'
                          : entry.sceneIds
                              .map((sceneId) => sceneById.get(sceneId) ?? sceneId)
                              .join(' | ')}
                      </p>
                      <input
                        value={entry.notes}
                        onChange={(event) =>
                          updateBreakdownEntry(entry.id, (target) => {
                            target.notes = event.target.value
                          })
                        }
                        placeholder="Notes"
                      />
                      <button onClick={() => removeBreakdownEntry(entry.id)}>Remove</button>
                    </Fragment>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'breakdown' && (
              <section className="module-layout module-surface tab-enter">
                <div className="module-heading">
                  <h2>Tagging and Breakdown</h2>
                  <div className="inline-actions">
                    <button onClick={applyManualTag}>Apply Tag</button>
                    <button onClick={exportBreakdownCsv}>Breakdown CSV</button>
                    <button onClick={() => void exportBreakdownPdf()}>Breakdown PDF</button>
                  </div>
                </div>

                <div className="tagging-grid">
                  <section className="tagging-panel">
                    <div className="module-heading compact-heading">
                      <h2>Inline Tagging</h2>
                    </div>
                    <label>
                      <span>Category</span>
                      <select
                        value={selectedTagCategory}
                        onChange={(event) =>
                          setSelectedTagCategory(event.target.value as DepartmentTagCategory)
                        }
                      >
                        {departmentTagCategories.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Selected Phrase</span>
                      <input
                        value={tagPhrase}
                        onChange={(event) => setTagPhrase(event.target.value)}
                        placeholder="Highlight in Draft or type phrase"
                      />
                    </label>
                    <div className="tag-swatch-row">
                      {departmentTagCategories.map((category) => (
                        <button
                          key={category}
                          className={category === selectedTagCategory ? 'active' : ''}
                          onClick={() => setSelectedTagCategory(category)}
                          style={{ borderColor: departmentTagColors[category] }}
                        >
                          <span style={{ background: departmentTagColors[category] }} />
                          {category}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="tagging-panel">
                    <div className="module-heading compact-heading">
                      <h2>Auto-Tag Suggestions</h2>
                    </div>
                    <div className="tag-suggestion-list">
                      {autoTagSuggestions.length === 0 && (
                        <p className="small-copy">No local suggestions found.</p>
                      )}
                      {autoTagSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.blockId}-${suggestion.category}-${suggestion.start}`}
                          onClick={() => confirmAutoTag(suggestion)}
                          style={{ borderLeftColor: suggestion.color }}
                        >
                          <strong>{suggestion.category}</strong>
                          <span>{suggestion.text}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="tagging-panel breakdown-sheet-panel">
                    <div className="module-heading compact-heading">
                      <h2>Scene Breakdown</h2>
                    </div>
                    <strong>{selectedBreakdownSheet.sceneHeading}</strong>
                    <div className="breakdown-category-list">
                      {departmentTagCategories.map((category) => {
                        const items = selectedBreakdownSheet.categories[category] ?? []
                        if (items.length === 0) {
                          return null
                        }

                        return (
                          <article key={category}>
                            <h3>{category}</h3>
                            {items.map((item) => (
                              <span key={item.id}>
                                {item.name} | {item.occurrences.length} occurrence(s)
                              </span>
                            ))}
                          </article>
                        )
                      })}
                    </div>
                  </section>
                </div>

                <div className="tag-catalog-grid">
                  {departmentTagCategories.map((category) => {
                    const items = tagCatalogGroups[category] ?? []
                    if (items.length === 0) {
                      return null
                    }

                    return (
                      <section className="tagging-panel" key={category}>
                        <div className="module-heading compact-heading">
                          <h2>{category}</h2>
                        </div>
                        {items.map((item) => (
                          <article className="tag-catalog-item" key={item.id}>
                            <input
                              value={item.name}
                              onChange={(event) =>
                                updateTagCatalog(item.id, { name: event.target.value })
                              }
                            />
                            <input
                              type="number"
                              min={0}
                              value={item.cost}
                              onChange={(event) =>
                                updateTagCatalog(item.id, {
                                  cost: Number(event.target.value) || 0,
                                })
                              }
                              placeholder="Cost"
                            />
                            <input
                              value={item.notes}
                              onChange={(event) =>
                                updateTagCatalog(item.id, { notes: event.target.value })
                              }
                              placeholder="Notes"
                            />
                            <input
                              value={item.imageDataUrl}
                              onChange={(event) =>
                                updateTagCatalog(item.id, {
                                  imageDataUrl: event.target.value,
                                })
                              }
                              placeholder="Image data URL or reference"
                            />
                          </article>
                        ))}
                      </section>
                    )
                  })}
                </div>
              </section>
            )}

            {activeTab === 'reports' && (
              <section className="module-layout module-surface tab-enter">
                <div className="module-heading">
                  <h2>Reports and Analytics</h2>
                  <div className="inline-actions">
                    <select
                      value={selectedReportView}
                      onChange={(event) =>
                        setSelectedReportView(event.target.value as ReportView)
                      }
                    >
                      <option value="scene">Scene Report</option>
                      <option value="character">Character Report</option>
                      <option value="location">Location Report</option>
                      <option value="department">Department Report</option>
                      <option value="dialogue">Dialogue Report</option>
                      <option value="summary">Page/Scene Summary</option>
                      <option value="analytics">Analytics Dashboard</option>
                    </select>
                    {selectedReportView === 'department' && (
                      <select
                        value={selectedReportDepartment}
                        onChange={(event) =>
                          setSelectedReportDepartment(
                            event.target.value as DepartmentTagCategory,
                          )
                        }
                      >
                        {departmentTagCategories.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    )}
                    <button onClick={exportCurrentReportCsv}>Export CSV</button>
                    <button onClick={() => void exportCurrentReportPdf()}>Export PDF</button>
                  </div>
                </div>

                {selectedReportView === 'analytics' && (
                  <div className="analytics-grid">
                    <section className="analytics-panel">
                      <div className="module-heading compact-heading">
                        <h2>INT vs EXT</h2>
                      </div>
                      {analyticsDashboard.intExt.map((item) => (
                        <div className="chart-bar-row" key={item.label}>
                          <span>{item.label}</span>
                          <div>
                            <i style={{ width: `${Math.max(8, item.value * 22)}%` }} />
                          </div>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </section>

                    <section className="analytics-panel">
                      <div className="module-heading compact-heading">
                        <h2>Day vs Night</h2>
                      </div>
                      {analyticsDashboard.dayNight.map((item) => (
                        <div className="chart-bar-row" key={item.label}>
                          <span>{item.label}</span>
                          <div>
                            <i style={{ width: `${Math.max(8, item.value * 22)}%` }} />
                          </div>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </section>

                    <section className="analytics-panel">
                      <div className="module-heading compact-heading">
                        <h2>Dialogue vs Action</h2>
                      </div>
                      <div className="ratio-chart">
                        <span
                          style={{
                            width: `${analyticsDashboard.dialogueVsAction.dialoguePercent}%`,
                          }}
                        />
                        <b
                          style={{
                            width: `${analyticsDashboard.dialogueVsAction.actionPercent}%`,
                          }}
                        />
                      </div>
                      <p className="small-copy">
                        Dialogue {analyticsDashboard.dialogueVsAction.dialogueWords} words | Action{' '}
                        {analyticsDashboard.dialogueVsAction.actionWords} words
                      </p>
                    </section>

                    <section className="analytics-panel">
                      <div className="module-heading compact-heading">
                        <h2>Scene Length</h2>
                      </div>
                      {analyticsDashboard.sceneLengthHistogram.map((item) => (
                        <div className="chart-bar-row" key={item.sceneNumber}>
                          <span>S{item.sceneNumber}</span>
                          <div>
                            <i style={{ width: `${Math.max(8, item.words * 2)}%` }} />
                          </div>
                          <strong>{item.words}</strong>
                        </div>
                      ))}
                    </section>
                  </div>
                )}

                <div className="report-table-wrap">
                  <h3>{currentReport.title}</h3>
                  <div
                    className="report-table"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(
                        currentReport.headers.length,
                        1,
                      )}, minmax(120px, 1fr))`,
                    }}
                  >
                    {currentReport.headers.map((header) => (
                      <strong key={header}>{header}</strong>
                    ))}
                    {currentReport.rows.map((row, rowIndex) => (
                      <Fragment key={`${currentReport.title}-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <span key={`${currentReport.title}-${rowIndex}-${cellIndex}`}>
                            {formatReportCell(cell)}
                          </span>
                        ))}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'advanced' && (
              <section className="module-layout module-surface tab-enter">
                <div className="module-heading">
                  <h2>Advanced Production Suite</h2>
                  <div className="inline-actions">
                    <button onClick={beginProductionDraftAction}>Begin Production Draft</button>
                    <button onClick={() => void exportCleanPdf()}>Clean PDF</button>
                    <button onClick={() => void exportDirtyPdf()}>Dirty PDF</button>
                    <button onClick={() => void exportTableReadPdf()}>Table Read Draft</button>
                  </div>
                </div>

                <div className="advanced-grid">
                  <section className="advanced-panel">
                    <div className="module-heading compact-heading">
                      <h2>Formats and SmartType</h2>
                    </div>
                    <label>
                      <span>Script Format</span>
                      <select
                        value={project.advanced.activeFormat}
                        onChange={(event) => setAdvancedFormat(event.target.value as ScriptFormatId)}
                      >
                        {scriptFormatPresets.map((format) => (
                          <option key={format.id} value={format.id}>
                            {format.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button onClick={insertFormatTemplate}>Insert Format Template</button>
                    <div className="token-list">
                      {[...smartTypeTimesOfDay, ...smartTypeTransitions, ...smartTypeExtensions]
                        .slice(0, 28)
                        .map((token) => (
                          <span key={token}>{token}</span>
                        ))}
                    </div>
                    <div className="token-list">
                      {technicalElementTemplates.map((element) => (
                        <span key={`${element.type}-${element.label}`}>{element.label}</span>
                      ))}
                    </div>
                  </section>

                  <section className="advanced-panel">
                    <div className="module-heading compact-heading">
                      <h2>Title, Security, Legal</h2>
                    </div>
                    <input
                      value={project.advanced.titlePage.writtenBy}
                      onChange={(event) => updateAdvancedTitleField('writtenBy', event.target.value)}
                      placeholder="Written By"
                    />
                    <input
                      value={project.advanced.titlePage.screenplayBy}
                      onChange={(event) => updateAdvancedTitleField('screenplayBy', event.target.value)}
                      placeholder="Screenplay By"
                    />
                    <input
                      value={project.advanced.titlePage.storyBy}
                      onChange={(event) => updateAdvancedTitleField('storyBy', event.target.value)}
                      placeholder="Story By"
                    />
                    <input
                      value={project.advanced.titlePage.basedOn}
                      onChange={(event) => updateAdvancedTitleField('basedOn', event.target.value)}
                      placeholder="Based On"
                    />
                    <input
                      value={project.advanced.titlePage.wgaRegistrationNumber}
                      onChange={(event) =>
                        updateAdvancedTitleField('wgaRegistrationNumber', event.target.value)
                      }
                      placeholder="WGA Registration #"
                    />
                    <input
                      value={project.advanced.titlePage.copyrightNotice}
                      onChange={(event) =>
                        updateAdvancedTitleField('copyrightNotice', event.target.value)
                      }
                      placeholder={currentYearCopyright()}
                    />
                    <input
                      value={project.advanced.titlePage.coverImageDataUrl}
                      onChange={(event) =>
                        updateAdvancedTitleField('coverImageDataUrl', event.target.value)
                      }
                      placeholder="Cover image data URL"
                    />
                    {titlePageWarnings.map((warning) => (
                      <p className="small-copy" key={warning.code} title={warning.tooltip}>
                        {warning.message}
                      </p>
                    ))}
                    <label className="toggle-row compact">
                      <input
                        type="checkbox"
                        checked={project.advanced.submissionLocked}
                        onChange={(event) =>
                          applyAdvancedProject(
                            updateAdvancedSettings(project, {
                              submissionLocked: event.target.checked,
                            }),
                            'Updated submission lock',
                          )
                        }
                      />
                      <span>Lock for submission</span>
                    </label>
                    <div className="inline-actions">
                      <button
                        title={legalWorkflowLinks.poorMansCopyrightTooltip}
                        onClick={() => window.open(legalWorkflowLinks.wgaUrl, '_blank')}
                      >
                        Register with WGA
                      </button>
                      <button
                        title={legalWorkflowLinks.poorMansCopyrightTooltip}
                        onClick={() => window.open(legalWorkflowLinks.copyrightUrl, '_blank')}
                      >
                        Register Copyright
                      </button>
                    </div>
                  </section>

                  <section className="advanced-panel">
                    <div className="module-heading compact-heading">
                      <h2>Revision and Page Control</h2>
                    </div>
                    <div className="inline-actions">
                      <button onClick={logRevisionDistributionNow}>Log Distribution</button>
                      <button onClick={exportRevisionLogCsv}>Revision CSV</button>
                      <button onClick={() => void exportRevisionLogPdf()}>Revision PDF</button>
                    </div>
                    <div className="session-list">
                      {project.advanced.revisionDistributionLog.map((event) => (
                        <span key={event.id}>
                          {event.date} | {event.color} | {event.pages.join(', ')} | {event.recipients}
                        </span>
                      ))}
                    </div>
                    <div className="token-list">
                      {revisionSlugList.map((slug) => (
                        <span key={slug}>{slug}</span>
                      ))}
                    </div>
                    <p className="small-copy">
                      Scene numbers: {project.advanced.sceneNumbering.locked ? 'Locked' : 'Unlocked'} | Fixed page mode:{' '}
                      {project.advanced.fixedPageMode ? 'On' : 'Off'}
                    </p>
                  </section>

                  <section className="advanced-panel">
                    <div className="module-heading compact-heading">
                      <h2>Script Check</h2>
                      <button onClick={() => void exportScriptCheckPdf()}>Notes PDF</button>
                    </div>
                    <div className="script-check-list">
                      {scriptCheckResults.slice(0, 12).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (item.blockId) {
                              setSelectedBlockId(item.blockId)
                              queueFocus(item.blockId)
                            }
                          }}
                          title={item.tooltip}
                        >
                          <strong>{item.code}</strong>
                          <span>Scene {item.sceneNumber ?? '-'} | {item.message}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="advanced-panel">
                    <div className="module-heading compact-heading">
                      <h2>Cast, Sides, Schedule</h2>
                    </div>
                    <div className="custom-field-row">
                      <select
                        value={selectedCastStatusCharacter || characterSuggestions[0] || ''}
                        onChange={(event) => setSelectedCastStatusCharacter(event.target.value)}
                      >
                        {characterSuggestions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedCastStatus}
                        onChange={(event) => setSelectedCastStatus(event.target.value as CastStatus)}
                      >
                        <option>Series Regular</option>
                        <option>Recurring</option>
                        <option>Guest Star</option>
                        <option>Co-Star</option>
                        <option>Day Player</option>
                        <option>Under-5</option>
                      </select>
                    </div>
                    <button onClick={setCastStatusForCharacter}>Set Cast Status</button>
                    <div className="inline-actions">
                      <button onClick={exportOneLinerCsv}>One-Liner CSV</button>
                      <button onClick={() => void exportOneLinerPdf()}>One-Liner PDF</button>
                      <button
                        onClick={() =>
                          setStatusMessage(
                            createDigitalSidesLink(project.id, {
                              expiresAt: new Date(Date.now() + 7 * 86_400_000)
                                .toISOString()
                                .slice(0, 10),
                            }),
                          )
                        }
                      >
                        Digital Sides Link
                      </button>
                    </div>
                    <div className="session-list">
                      {buildAdvancedSidesPackage(project, resolvedShootDay).coverCards.map((card) => (
                        <span key={card.sceneId}>
                          {card.sceneHeading} | {card.pageCount} pg | {card.cast.join(', ')}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="advanced-panel">
                    <div className="module-heading compact-heading">
                      <h2>Timing and Navigator</h2>
                    </div>
                    <p className="timer-display">{advancedTiming.totalMinutes} min</p>
                    <div className="navigator-enhancement-list">
                      {advancedNavigatorRows.slice(0, 8).map((row) => (
                        <article key={row.sceneId} title={`${row.wordCount} words | ${row.lineCount} lines`}>
                          <strong>{row.sceneNumber} {row.intExt} {row.dayNight}</strong>
                          <span>{row.heading}</span>
                          <i style={{ width: `${row.lengthBarPercent}%`, background: row.color }} />
                          <small>{row.castInitials.join(' ')}</small>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="advanced-panel">
                    <div className="module-heading compact-heading">
                      <h2>Coverage and Writer's Room</h2>
                    </div>
                    <div className="inline-actions">
                      <button onClick={addDefaultCoverage}>Add Coverage</button>
                      <button onClick={() => void exportLatestCoveragePdf()}>Coverage PDF</button>
                      <button onClick={addParkingLotFromSelection}>Park Scene</button>
                    </div>
                    <p className="small-copy">
                      Coverage forms: {project.advanced.coverage.length} | Parking lot:{' '}
                      {project.advanced.writerRoom.parkingLot.length}
                    </p>
                    <textarea
                      rows={4}
                      value={project.advanced.series.bible}
                      onChange={(event) =>
                        applyAdvancedProject(
                          updateAdvancedSettings(project, {
                            series: { ...project.advanced.series, bible: event.target.value },
                          }),
                          'Updated series bible',
                        )
                      }
                      placeholder="Series bible"
                    />
                    {seriesReviewFlags.map((flag) => (
                      <span className="small-copy" key={flag}>{flag}</span>
                    ))}
                  </section>

                  <section className="advanced-panel">
                    <div className="module-heading compact-heading">
                      <h2>Print, Watermark, Accessibility</h2>
                    </div>
                    <label className="toggle-row compact">
                      <input
                        type="checkbox"
                        checked={printExportSettings.draftInkSaver}
                        onChange={(event) => updatePrintWatermarkField('draftInkSaver', event.target.checked)}
                      />
                      <span>Draft ink saver</span>
                    </label>
                    <label className="toggle-row compact">
                      <input
                        type="checkbox"
                        checked={printExportSettings.twoUp}
                        onChange={(event) => updatePrintWatermarkField('twoUp', event.target.checked)}
                      />
                      <span>Two-up printing</span>
                    </label>
                    <input
                      value={printExportSettings.watermarkText}
                      onChange={(event) => updatePrintWatermarkField('watermarkText', event.target.value)}
                      placeholder="Per-page watermark"
                    />
                    <input
                      value={printExportSettings.recipientWatermark}
                      onChange={(event) => updatePrintWatermarkField('recipientWatermark', event.target.value)}
                      placeholder="Recipient watermark"
                    />
                    <p className="small-copy">
                      Watermark: {watermarkDescriptor.text || 'None'} | {watermarkDescriptor.position} |{' '}
                      {watermarkDescriptor.opacity}
                    </p>
                    <div className="token-list">
                      {accessibilityExports.formats.map((format) => (
                        <span key={format}>{format}</span>
                      ))}
                    </div>
                  </section>

                  <section className="advanced-panel">
                    <div className="module-heading compact-heading">
                      <h2>Additional Exports</h2>
                    </div>
                    <div className="inline-actions">
                      <button onClick={() => exportAdditionalFormat('txt')}>TXT</button>
                      <button onClick={() => exportAdditionalFormat('rtf')}>RTF</button>
                      <button onClick={() => exportAdditionalFormat('html')}>HTML</button>
                      <button onClick={() => exportAdditionalFormat('scene-csv')}>Scene CSV</button>
                      <button onClick={() => exportAdditionalFormat('workbook')}>Excel XML</button>
                    </div>
                  </section>
                </div>
              </section>
            )}

            {activeTab === 'budget' && (
              <section className="module-layout module-surface tab-enter">
                <div className="module-heading">
                  <h2>Budgeting</h2>
                  <button onClick={addBudgetItem}>Add Budget Item</button>
                </div>

                <div className="table-layout budget-table">
                  <div className="table-header">Category</div>
                  <div className="table-header">Description</div>
                  <div className="table-header">Amount</div>
                  <div className="table-header">Actions</div>

                  {project.budget.items.map((item) => (
                    <Fragment key={item.id}>
                      <input
                        value={item.category}
                        onChange={(event) =>
                          updateBudgetItem(item.id, (target) => {
                            target.category = event.target.value
                          })
                        }
                      />
                      <input
                        value={item.description}
                        onChange={(event) =>
                          updateBudgetItem(item.id, (target) => {
                            target.description = event.target.value
                          })
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.amount}
                        onChange={(event) =>
                          updateBudgetItem(item.id, (target) => {
                            target.amount = Number(event.target.value) || 0
                          })
                        }
                      />
                      <button onClick={() => removeBudgetItem(item.id)}>Remove</button>
                    </Fragment>
                  ))}
                </div>

                <p className="budget-total">Total Budget: ${budgetTotal.toLocaleString()}</p>
              </section>
            )}

            {activeTab === 'storyboards' && (
              <section className="module-layout module-surface tab-enter">
                <div className="module-heading">
                  <h2>Storyboards and Shot List</h2>
                  <div className="inline-actions">
                    <button onClick={addShotForSelectedScene}>Add Shot</button>
                    <button onClick={exportShotListCsv}>Shot List CSV</button>
                    <button onClick={() => void exportShotListPdf()}>Shot List PDF</button>
                    <button onClick={addStoryboardPanel}>Add Panel</button>
                    <button onClick={() => void exportStoryboardPdf()}>Storyboard PDF</button>
                  </div>
                </div>

                <div className="table-layout shot-list-table">
                  <div className="table-header">Shot #</div>
                  <div className="table-header">Type</div>
                  <div className="table-header">Angle</div>
                  <div className="table-header">Lens</div>
                  <div className="table-header">Move</div>
                  <div className="table-header">Description</div>
                  <div className="table-header">Actions</div>

                  {selectedSceneShotRows.map((shot) => (
                    <Fragment key={shot.id}>
                      <input
                        value={shot.shotNumber}
                        onChange={(event) =>
                          updateShotListItem(shot.id, (target) => {
                            target.shotNumber = event.target.value
                          })
                        }
                      />
                      <input
                        value={shot.type}
                        onChange={(event) =>
                          updateShotListItem(shot.id, (target) => {
                            target.type = event.target.value
                          })
                        }
                      />
                      <input
                        value={shot.angle}
                        onChange={(event) =>
                          updateShotListItem(shot.id, (target) => {
                            target.angle = event.target.value
                          })
                        }
                      />
                      <input
                        value={shot.lens}
                        onChange={(event) =>
                          updateShotListItem(shot.id, (target) => {
                            target.lens = event.target.value
                          })
                        }
                      />
                      <input
                        value={shot.movement}
                        onChange={(event) =>
                          updateShotListItem(shot.id, (target) => {
                            target.movement = event.target.value
                          })
                        }
                      />
                      <input
                        value={shot.description}
                        onChange={(event) =>
                          updateShotListItem(shot.id, (target) => {
                            target.description = event.target.value
                          })
                        }
                      />
                      <button onClick={() => removeShotListItem(shot.id)}>Remove</button>
                    </Fragment>
                  ))}
                </div>

                <div className="cards-grid">
                  {project.storyboards.map((panel) => (
                    <article
                      className={`story-card${highlightedId === panel.id ? ' highlighted' : ''}`}
                      key={panel.id}
                      ref={(node) => {
                        itemRefs.current[panel.id] = node
                      }}
                    >
                      <select
                        value={panel.sceneId ?? ''}
                        onChange={(event) =>
                          updateStoryboardPanel(panel.id, (target) => {
                            target.sceneId = event.target.value || null
                          })
                        }
                      >
                        <option value="">Scene Link</option>
                        {scenes.map((scene, index) => (
                          <option key={scene.blockId} value={scene.blockId}>
                            S{index + 1} - {scene.heading}
                          </option>
                        ))}
                      </select>
                      <input
                        value={panel.shot}
                        onChange={(event) =>
                          updateStoryboardPanel(panel.id, (target) => {
                            target.shot = event.target.value
                          })
                        }
                        placeholder="Shot label"
                      />
                      <div className="storyboard-shot-grid">
                        <input
                          value={panel.shotNumber ?? ''}
                          onChange={(event) =>
                            updateStoryboardPanel(panel.id, (target) => {
                              target.shotNumber = event.target.value
                            })
                          }
                          placeholder="Shot #"
                        />
                        <input
                          value={panel.shotType ?? ''}
                          onChange={(event) =>
                            updateStoryboardPanel(panel.id, (target) => {
                              target.shotType = event.target.value
                            })
                          }
                          placeholder="WS/MS/CU"
                        />
                      </div>
                      <div className="storyboard-shot-grid">
                        <input
                          value={panel.angle ?? ''}
                          onChange={(event) =>
                            updateStoryboardPanel(panel.id, (target) => {
                              target.angle = event.target.value
                            })
                          }
                          placeholder="Angle"
                        />
                        <input
                          value={panel.lens ?? ''}
                          onChange={(event) =>
                            updateStoryboardPanel(panel.id, (target) => {
                              target.lens = event.target.value
                            })
                          }
                          placeholder="Lens"
                        />
                      </div>
                      <input
                        value={panel.movement ?? ''}
                        onChange={(event) =>
                          updateStoryboardPanel(panel.id, (target) => {
                            target.movement = event.target.value
                          })
                        }
                        placeholder="Movement"
                      />
                      <textarea
                        rows={4}
                        value={panel.description}
                        onChange={(event) =>
                          updateStoryboardPanel(panel.id, (target) => {
                            target.description = event.target.value
                          })
                        }
                        placeholder="Framing, movement, lens notes"
                      />
                      <button onClick={() => removeStoryboardPanel(panel.id)}>Remove</button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'catalog' && (
              <section className="module-layout module-surface tab-enter">
                <div className="module-heading">
                  <h2>Character and Location Catalog</h2>
                  <div className="inline-actions">
                    <button onClick={() => addCatalogEntry('character')}>Add Character</button>
                    <button onClick={() => addCatalogEntry('location')}>Add Location</button>
                    <button onClick={importDetectedCatalog}>Import Detected Names</button>
                    <button onClick={rebuildCatalogFromCurrentScript}>Rebuild Lists</button>
                  </div>
                </div>

                <div className="catalog-rename-panel">
                  <input
                    value={renameFrom}
                    onChange={(event) => setRenameFrom(event.target.value)}
                    placeholder="Current character"
                  />
                  <input
                    value={renameTo}
                    onChange={(event) => setRenameTo(event.target.value)}
                    placeholder="New character"
                  />
                  <button onClick={applyGlobalCharacterRename}>Global Rename</button>
                </div>

                <div className="character-tools-grid">
                  <section className="character-tool-panel">
                    <div className="module-heading compact-heading">
                      <h2>Profile</h2>
                      <button onClick={syncCharacterProfiles}>Sync Profiles</button>
                    </div>
                    <label>
                      <span>Character</span>
                      <select
                        value={resolvedCharacterName}
                        onChange={(event) => setSelectedCharacterName(event.target.value)}
                      >
                        {characterSuggestions.length === 0 && <option value="">No characters</option>}
                        {characterSuggestions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Bio</span>
                      <textarea
                        rows={3}
                        value={selectedCharacterProfile?.bio ?? ''}
                        onChange={(event) =>
                          updateSelectedCharacterProfile({ bio: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Notes</span>
                      <textarea
                        rows={3}
                        value={selectedCharacterProfile?.notes ?? ''}
                        onChange={(event) =>
                          updateSelectedCharacterProfile({ notes: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Image</span>
                      <input
                        value={selectedCharacterProfile?.imageDataUrl ?? ''}
                        onChange={(event) =>
                          updateSelectedCharacterProfile({ imageDataUrl: event.target.value })
                        }
                        placeholder="Image data URL or reference"
                      />
                    </label>
                    <button onClick={addSelectedCharacterCustomField}>Add Custom Field</button>
                    {(selectedCharacterProfile?.customFields ?? []).map((field) => (
                      <div className="custom-field-row" key={field.id}>
                        <input
                          value={field.label}
                          onChange={(event) =>
                            updateSelectedCharacterCustomField(
                              field.id,
                              'label',
                              event.target.value,
                            )
                          }
                        />
                        <input
                          value={field.value}
                          onChange={(event) =>
                            updateSelectedCharacterCustomField(
                              field.id,
                              'value',
                              event.target.value,
                            )
                          }
                        />
                      </div>
                    ))}
                  </section>

                  <section className="character-tool-panel">
                    <div className="module-heading compact-heading">
                      <h2>Stats</h2>
                    </div>
                    <div className="outline-stats-grid">
                      <article className="outline-stat">
                        <span>Scenes</span>
                        <strong>{selectedCharacterStats?.sceneCount ?? 0}</strong>
                      </article>
                      <article className="outline-stat">
                        <span>Pages</span>
                        <strong>{selectedCharacterStats?.pageCount ?? 0}</strong>
                      </article>
                      <article className="outline-stat">
                        <span>Dialogue</span>
                        <strong>{selectedCharacterStats?.dialogueWords ?? 0}</strong>
                      </article>
                      <article className="outline-stat">
                        <span>Screen %</span>
                        <strong>{selectedCharacterStats?.screenTimePercent ?? 0}</strong>
                      </article>
                    </div>
                    <svg className="dialogue-pie" viewBox="0 0 120 120" role="img">
                      <circle cx="60" cy="60" r="42" fill="none" stroke="#242424" strokeWidth="24" />
                      {dialoguePieSegments.map((segment) => (
                        <circle
                          key={segment.character}
                          cx="60"
                          cy="60"
                          r="42"
                          fill="none"
                          stroke={segment.color}
                          strokeWidth="24"
                          strokeDasharray={`${segment.percent} ${100 - segment.percent}`}
                          strokeDashoffset={segment.offset}
                          pathLength="100"
                        />
                      ))}
                    </svg>
                    <div className="character-distribution-list">
                      {dialogueDistribution.map((entry) => (
                        <span key={entry.character}>
                          {entry.character}: {entry.percent}%
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="character-tool-panel">
                    <div className="module-heading compact-heading">
                      <h2>Relationships and Arc</h2>
                    </div>
                    <div className="custom-field-row">
                      <input
                        value={relationshipTo}
                        onChange={(event) => setRelationshipTo(event.target.value)}
                        placeholder="Related character"
                      />
                      <input
                        value={relationshipLabel}
                        onChange={(event) => setRelationshipLabel(event.target.value)}
                        placeholder="Label"
                      />
                    </div>
                    <button onClick={addSelectedCharacterRelationship}>Add Relationship</button>
                    <div className="relationship-list">
                      {(project.characters?.relationships ?? []).map((edge) => (
                        <span key={edge.id}>
                          {edge.from} - {edge.label} - {edge.to}
                        </span>
                      ))}
                    </div>
                    <label>
                      <span>Arc Stage In Selected Scene</span>
                      <select
                        value={
                          resolvedCharacterName && resolvedSelectedSceneId
                            ? project.characters?.arcs[resolvedCharacterName]?.[
                                resolvedSelectedSceneId
                              ] ?? 'Setup'
                            : 'Setup'
                        }
                        onChange={(event) =>
                          updateSelectedCharacterArc(event.target.value as CharacterArcStage)
                        }
                      >
                        <option>Setup</option>
                        <option>Conflict</option>
                        <option>Change</option>
                        <option>Resolution</option>
                      </select>
                    </label>
                  </section>
                </div>

                <div className="table-layout catalog-table">
                  <div className="table-header">Type</div>
                  <div className="table-header">Name</div>
                  <div className="table-header">Notes</div>
                  <div className="table-header">Actions</div>

                  {project.catalog.map((entry) => (
                    <Fragment key={entry.id}>
                      <select
                        ref={(node) => {
                          itemRefs.current[entry.id] = node
                        }}
                        className={highlightedId === entry.id ? 'highlighted' : ''}
                        value={entry.kind}
                        onChange={(event) =>
                          updateCatalogEntry(entry.id, (target) => {
                            target.kind = event.target.value as CatalogEntry['kind']
                          })
                        }
                      >
                        <option value="character">Character</option>
                        <option value="location">Location</option>
                      </select>
                      <input
                        value={entry.name}
                        onChange={(event) =>
                          updateCatalogEntry(entry.id, (target) => {
                            target.name = event.target.value
                          })
                        }
                      />
                      <input
                        value={entry.notes}
                        onChange={(event) =>
                          updateCatalogEntry(entry.id, (target) => {
                            target.notes = event.target.value
                          })
                        }
                      />
                      <button onClick={() => removeCatalogEntry(entry.id)}>Remove</button>
                    </Fragment>
                  ))}
                </div>
              </section>
            )}
          </div>

          {activeTab === 'draft' && !useContinuousDraftEditor && (
            <div className="floating-toolbar" data-purpose="formatter-toolbar">
              <button
                className={
                  selectedBlock?.type === 'scene-heading'
                    ? 'format-btn active'
                    : 'format-btn'
                }
                onClick={() => applyBlockFormat('scene-heading')}
              >
                <span>Scene</span>
              </button>
              <button
                className={selectedBlock?.type === 'action' ? 'format-btn active' : 'format-btn'}
                onClick={() => applyBlockFormat('action')}
              >
                <span>Action</span>
              </button>
              <button
                className={
                  selectedBlock?.type === 'character' ? 'format-btn active' : 'format-btn'
                }
                onClick={() => applyBlockFormat('character')}
              >
                <span>Character</span>
              </button>
              <button
                className={
                  selectedBlock?.type === 'dialogue' ? 'format-btn active' : 'format-btn'
                }
                onClick={() => applyBlockFormat('dialogue')}
              >
                <span>Dialogue</span>
              </button>
              <button
                className={
                  selectedBlock?.type === 'transition' ? 'format-btn active' : 'format-btn'
                }
                onClick={() => applyBlockFormat('transition')}
              >
                <span>Transition</span>
              </button>
            </div>
          )}
        </main>

        <aside className="right-outline">
          <div className="outline-header">
            <h2>{activeTab === 'draft' ? 'Writer Panel' : 'Scene Outlines'}</h2>
            <button title="Focus draft" onClick={() => setActiveTab('draft')}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m18 15-6-6-6 6" />
              </svg>
            </button>
          </div>

          <div className="right-outline-scroll">
            {activeTab === 'draft' && !useContinuousDraftEditor && (
              <section className="outline-tools writer-flow-panel">
                <div className="current-element-card">
                  <span>Current Element</span>
                  <strong>
                    {activeEditorBlock
                      ? blockTypeLabels[activeEditorBlock.type]
                      : 'Scene Heading'}
                  </strong>
                </div>

                <div className="keyboard-hint-list">
                  <div>
                    <kbd>Enter</kbd>
                    <span>Next screenplay block</span>
                  </div>
                  <div>
                    <kbd>Shift</kbd>
                    <kbd>Enter</kbd>
                    <span>New line in current block</span>
                  </div>
                  <div>
                    <kbd>Tab</kbd>
                    <span>
                      Cycle type: {screenplayKeyboardCycle.map((type) => blockTypeLabels[type]).join(' / ')}
                    </span>
                  </div>
                  <div>
                    <kbd>Shift</kbd>
                    <kbd>Tab</kbd>
                    <span>Cycle backward</span>
                  </div>
                </div>

                <div className="shortcut-grid">
                  {screenplayElementShortcuts.map((item) => (
                    <span key={item.type}>
                      <kbd>{item.shortcut}</kbd>
                      {blockTypeLabels[item.type]}
                    </span>
                  ))}
                </div>

                <details className="shortcut-remap-panel">
                  <summary>Remap shortcuts</summary>
                  <div className="shortcut-remap-list">
                    {screenplayElementShortcuts.map((item) => (
                      <label key={`remap-${item.type}`}>
                        <span>{blockTypeLabels[item.type]}</span>
                        <input
                          value={item.shortcut}
                          readOnly
                          onKeyDown={(event) => captureEditorShortcut(event, item.type)}
                          onFocus={(event) => event.currentTarget.select()}
                          aria-label={`Shortcut for ${blockTypeLabels[item.type]}`}
                        />
                      </label>
                    ))}
                  </div>
                  <button className="subtle-action" onClick={resetEditorShortcuts}>
                    Reset defaults
                  </button>
                </details>

                <details className="block-actions-panel">
                  <summary>Block actions</summary>
                  <div className="inline-actions">
                    <button
                      onClick={() => {
                        if (activeBlockId) {
                          markRevision(activeBlockId)
                        }
                      }}
                      disabled={!project.meta.revisionMode || !activeBlockId}
                    >
                      Mark Revision
                    </button>
                    <button
                      onClick={() => {
                        if (activeEditorBlock && activeBlockIndex >= 0) {
                          addBlockAfter(
                            activeBlockIndex,
                            nextTypeForEnter(activeEditorBlock.type),
                          )
                        }
                      }}
                      disabled={!activeEditorBlock || activeBlockIndex < 0}
                    >
                      Insert Next
                    </button>
                    <button
                      onClick={() => {
                        if (activeBlockId) {
                          removeBlock(activeBlockId)
                        }
                      }}
                      disabled={!activeBlockId || project.blocks.length === 1}
                    >
                      Delete Block
                    </button>
                  </div>
                </details>

                <details className="smarttype-panel compact-smarttype">
                  <summary>SmartType suggestions</summary>
                  {smartTypeGroups.map((group) => (
                    <div className="smarttype-group" key={group.label}>
                      <span>{group.label}</span>
                      <div>
                        {group.values.slice(0, 5).map((value) => (
                          <button
                            key={`${group.label}-${value}`}
                            onClick={() => insertTextIntoActiveBlock(value)}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </details>
              </section>
            )}

            {activeTab === 'draft' && useContinuousDraftEditor && (
              <section className="outline-tools continuous-controls-pane">
                <div className="continuous-draft-controls">
                  <label>
                    <span>Enter Inserts</span>
                    <select
                      value={continuousEnterType}
                      onChange={(event) => {
                        const nextType = event.target.value as BlockType
                        setContinuousEnterType(nextType)
                        setStatusMessage(`Enter now inserts ${blockTypeLabels[nextType]}`)
                      }}
                    >
                      {blockTypeOrder.map((type) => (
                        <option key={type} value={type}>
                          {blockTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="small-copy">
                    Enter inserts the selected line type. Shift+Enter inserts a plain newline. Tab or
                    Alt+Up/Down cycles types.
                  </p>
                </div>
                <div className="smarttype-panel">
                  <div className="smarttype-header">
                    <strong>SmartType</strong>
                    <button onClick={markRecentDialogueAsDual}>Dual Last Dialogue</button>
                  </div>
                  {smartTypeGroups.map((group) => (
                    <div className="smarttype-group" key={group.label}>
                      <span>{group.label}</span>
                      <div>
                        {group.values.slice(0, 8).map((value) => (
                          <button
                            key={`${group.label}-${value}`}
                            onClick={() => insertContinuousTextAtCursor(value)}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section
              className={
                activeTab === 'draft'
                  ? 'outline-tools scene-lookup-panel'
                  : 'outline-tools'
              }
            >
              <label className="outline-search">
                <span>Find Scene</span>
                <input
                  value={sceneFilterQuery}
                  onChange={(event) => setSceneFilterQuery(event.target.value)}
                  placeholder="Search by heading or number"
                />
              </label>

              {activeTab !== 'draft' && (
                <>
                  <div className="outline-stats-grid">
                    <article className="outline-stat">
                      <span>Scenes</span>
                      <strong>{scenes.length}</strong>
                    </article>
                    <article className="outline-stat">
                      <span>Words</span>
                      <strong>{stats.wordCount}</strong>
                    </article>
                    <article className="outline-stat">
                      <span>Pages</span>
                      <strong>{stats.estimatedPages}</strong>
                    </article>
                    <article className="outline-stat">
                      <span>Blocks</span>
                      <strong>{project.blocks.length}</strong>
                    </article>
                  </div>

                  <div className="outline-quick-actions">
                    <button onClick={() => appendSidebarBlock('scene-heading')}>Add Scene</button>
                    <button onClick={() => appendSidebarBlock('action')}>Add Action</button>
                    <button onClick={() => setActiveTab('preview')}>Open Preview</button>
                    <button onClick={() => void exportPdf()}>Export PDF</button>
                  </div>
                </>
              )}
            </section>

            <nav className="outline-list">
              {scenes.length === 0 && <p className="small-copy">Add a scene heading to begin.</p>}
              {scenes.length > 0 && filteredScenes.length === 0 && (
                <p className="small-copy">No scenes match this filter.</p>
              )}
              {filteredScenes.map((scene) => (
                <button
                  key={scene.blockId}
                  className={
                    scene.blockId === resolvedSelectedSceneId
                      ? 'outline-item active'
                      : 'outline-item'
                  }
                  style={{
                    borderLeftColor: storyState.sceneMeta[scene.blockId]?.color ?? undefined,
                  }}
                  onClick={() => {
                    setSelectedSceneId(scene.blockId)
                    if (activeTab === 'draft') {
                      setSelectedBlockId(scene.blockId)
                      queueFocus(scene.blockId)
                    } else {
                      jumpToDraft(scene.blockId)
                    }
                  }}
                >
                  <strong>
                    SCENE {sceneNumberById.get(scene.blockId) ?? 1}
                  </strong>
                  <span>{scene.heading}</span>
                  {storyState.sceneMeta[scene.blockId]?.actBreak && (
                    <span>{storyState.sceneMeta[scene.blockId].actBreak}</span>
                  )}
                  {storyState.sceneMeta[scene.blockId]?.status && (
                    <span>{storyState.sceneMeta[scene.blockId].status}</span>
                  )}
                </button>
              ))}
            </nav>

            <section className="outline-revision">
              <label className="toggle-row compact">
                <input
                  type="checkbox"
                  checked={project.meta.revisionMode}
                  onChange={toggleRevisionMode}
                />
                <span>Revision Mode</span>
              </label>

              <div className="revision-chip-grid compact">
                {revisionColors.map((color) => (
                  <button
                    key={color}
                    className={`revision-chip ${color}${
                      project.meta.activeRevision === color ? ' active' : ''
                    }`}
                    onClick={() => setActiveRevisionColor(color)}
                  >
                    <span>{color}</span>
                    <strong>{revisionCounts[color]}</strong>
                  </button>
                ))}
              </div>

              <button className="subtle-action" onClick={beginRevisionSet}>
                Begin Next Revision Set
              </button>

              <button
                className="subtle-action"
                onClick={() => clearRevisionColor(project.meta.activeRevision)}
              >
                Clear active marks
              </button>

              <div className="inline-actions">
                <button onClick={saveRevisionSnapshot}>Save Snapshot</button>
                <button onClick={openSnapshotHistory}>History</button>
              </div>

              <div className="inline-actions">
                <button onClick={lockSelectedScene}>Lock Scene</button>
                <button onClick={unlockSelectedScene}>Unlock</button>
              </div>

              <div className="inline-actions">
                <button onClick={omitSelectedScene}>Omit Scene</button>
                <button onClick={unomitSelectedScene}>Un-omit</button>
              </div>

              <button className="subtle-action" onClick={stashContinuousSelection}>
                Stash Highlighted Dialogue
              </button>

              <div className="stash-list">
                {project.dialogueStash.map((item) => (
                  <button key={item.id} onClick={() => swapStashIntoFirstDialogue(item.id)}>
                    <strong>{item.label}</strong>
                    <span>{item.text}</span>
                  </button>
                ))}
              </div>

              <p className="small-copy">
                {project.revisionSnapshots.length} snapshot
                {project.revisionSnapshots.length === 1 ? '' : 's'} |{' '}
                {project.revisionDraftSets.length} revision set
                {project.revisionDraftSets.length === 1 ? '' : 's'}
              </p>
            </section>
          </div>
        </aside>
      </div>

      <div className="print-export-layer" aria-hidden="true">
        {previewPages.map((page) => (
          <section key={`print-${page.index}`} className="print-export-page">
            <div
              className="print-export-paper"
              style={{
                width: `${printLayout.config.pageWidth}px`,
                height: `${printLayout.config.pageHeight}px`,
              }}
            >
              {page.lines.map((line) => (
                <p
                  key={`print-line-${page.index}-${line.id}`}
                  className={`print-export-line role-${line.role}${line.bold ? ' is-bold' : ''}`}
                  style={{
                    left: `${line.x}px`,
                    top: `${printLayout.config.pageHeight - line.y - line.fontSize}px`,
                    fontSize: `${line.fontSize}px`,
                  }}
                >
                  {line.text}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="statusbar">
        <span className={`status-pill ${autosaveState}`}>
          {autosaveState === 'saving' && 'Autosaving...'}
          {autosaveState === 'saved' && 'Autosave synced'}
          {autosaveState === 'error' && 'Autosave failed'}
          {autosaveState === 'idle' && 'Autosave idle'}
        </span>
        <span className={`status-pill collaboration-status ${collaboration.status}`}>
          Collaboration: {collaborationStatusLabels[collaboration.status]}
        </span>
        <span>{statusMessage}</span>
        <span>{savedPath}</span>
        <span>
          Last update: {new Date(project.meta.updatedAt).toLocaleString()}
          {selectedScene
            ? ` | Scene: S${sceneNumberById.get(selectedScene.blockId) ?? 1} - ${selectedScene.heading}`
            : ''}
          {` | Words: ${stats.wordCount} | Pages: ${stats.estimatedPages}`}
        </span>
      </footer>

      {isCollaborationPanelOpen && (
        <div className="palette-overlay" onMouseDown={closeCollaborationPanel}>
          <section
            className="find-replace-panel collaboration-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="find-replace-head">
              <strong>Collaboration</strong>
              <button className="tiny-btn" onClick={closeCollaborationPanel}>
                Close
              </button>
            </div>

            <div className="collaboration-status-grid">
              <span>Status</span>
              <strong>{collaborationStatusLabels[collaboration.status]}</strong>
              <span>Room</span>
              <strong>{collaboration.sessionInfo?.roomId ?? 'Not connected'}</strong>
            </div>

            <div className="find-replace-grid collaboration-grid">
              <label className="collaboration-invite-field">
                <span>Invite Code</span>
                <input
                  value={collaborationInviteInput}
                  onChange={(event) => setCollaborationInviteInput(event.target.value)}
                  placeholder="masterscript://collab?mode=webrtc..."
                />
              </label>
              <label>
                <span>{collaboration.sessionInfo?.mode === 'webrtc' ? 'Signaling Server' : 'LAN Server'}</span>
                <input
                  value={collaborationServerInput}
                  onChange={(event) => setCollaborationServerInput(event.target.value)}
                  placeholder="ws://192.168.1.12:12345"
                />
              </label>
              <label>
                <span>Room ID</span>
                <input
                  value={collaborationRoomInput}
                  onChange={(event) => setCollaborationRoomInput(event.target.value)}
                  placeholder="masterscript-room"
                />
              </label>
            </div>

            {collaboration.sessionInfo?.hostUrls.length ? (
              <div className="collaboration-host-list">
                {collaboration.sessionInfo.hostUrls.map((url) => (
                  <code key={url}>{url}</code>
                ))}
              </div>
            ) : null}

            <div className="inline-actions">
              <button onClick={() => void hostLanCollaboration()}>Host LAN</button>
              <button onClick={() => void hostLanCollaboration()}>Refresh LAN Invite</button>
              <button onClick={() => void joinLanCollaboration()}>Join LAN</button>
              <button onClick={() => void startWebRtcCollaboration()}>Start / Join WebRTC</button>
              <button onClick={() => void applyNewCollaborationInvite()}>Use New Invite</button>
              <button onClick={() => void copyCollaborationInvite()}>Copy Invite</button>
              <button onClick={() => void stopCollaboration()} disabled={!collaboration.isActive}>
                Stop
              </button>
            </div>
          </section>
        </div>
      )}

      {isFindReplaceOpen && (
        <div className="palette-overlay" onMouseDown={closeFindReplace}>
          <section className="find-replace-panel" onMouseDown={(event) => event.stopPropagation()}>
            <div className="find-replace-head">
              <strong>Find and Replace</strong>
              <button className="tiny-btn" onClick={closeFindReplace}>
                Close
              </button>
            </div>

            <div className="find-replace-grid">
              <label>
                <span>Find</span>
                <input
                  ref={findInputRef}
                  value={findQuery}
                  onChange={(event) => {
                    setFindQuery(event.target.value)
                    setFindCursor(0)
                  }}
                  placeholder="Find text in screenplay"
                />
              </label>
              <label>
                <span>Replace</span>
                <input
                  value={replaceQuery}
                  onChange={(event) => setReplaceQuery(event.target.value)}
                  placeholder="Replacement text"
                />
              </label>
            </div>

            <div className="find-replace-controls">
              <label className="toggle-row compact">
                <input
                  type="checkbox"
                  checked={findCaseSensitive}
                  onChange={(event) => {
                    setFindCaseSensitive(event.target.checked)
                    setFindCursor(0)
                  }}
                />
                <span>Case sensitive</span>
              </label>
              <p className="small-copy">
                {findMatches.length} match{findMatches.length === 1 ? '' : 'es'}
              </p>
            </div>

            <div className="inline-actions">
              <button onClick={jumpToNextFindMatch}>Find Next</button>
              <button onClick={replaceNextFindMatch}>Replace Next</button>
              <button onClick={replaceAllFindMatches}>Replace All</button>
            </div>
          </section>
        </div>
      )}

      {isSnapshotHistoryOpen && (
        <div className="palette-overlay" onMouseDown={closeSnapshotHistory}>
          <section className="snapshot-panel" onMouseDown={(event) => event.stopPropagation()}>
            <div className="find-replace-head">
              <strong>Revision Snapshot History</strong>
              <button className="tiny-btn" onClick={closeSnapshotHistory}>
                Close
              </button>
            </div>

            <p className="small-copy">
              {snapshotOptions.length} snapshot{snapshotOptions.length === 1 ? '' : 's'}
            </p>

            <div className="snapshot-layout">
              <div className="snapshot-list">
                {snapshotOptions.length === 0 && (
                  <p className="small-copy">
                    No snapshots yet. Save one from the revision panel.
                  </p>
                )}

                {snapshotOptions.map((snapshot) => (
                  <button
                    key={snapshot.id}
                    className={
                      selectedSnapshot?.id === snapshot.id
                        ? 'snapshot-item active'
                        : 'snapshot-item'
                    }
                    onClick={() => setSelectedSnapshotId(snapshot.id)}
                  >
                    <strong>{snapshot.label}</strong>
                    <span>
                      {new Date(snapshot.createdAt).toLocaleString()} | {snapshot.blockCount}{' '}
                      blocks
                    </span>
                  </button>
                ))}
              </div>

              <div className="snapshot-detail">
                {!selectedSnapshot && (
                  <p className="small-copy">Select a snapshot to compare or restore.</p>
                )}

                {selectedSnapshot && (
                  <>
                    <h3>{selectedSnapshot.label}</h3>
                    <p className="small-copy">
                      Captured {new Date(selectedSnapshot.createdAt).toLocaleString()}
                    </p>

                    {selectedSnapshotDiff && (
                      <div className="snapshot-diff-grid">
                        <span>Added: {selectedSnapshotDiff.added}</span>
                        <span>Removed: {selectedSnapshotDiff.removed}</span>
                        <span>Changed: {selectedSnapshotDiff.changed}</span>
                        <span>Unchanged: {selectedSnapshotDiff.unchanged}</span>
                      </div>
                    )}

                    <div className="snapshot-compare-table">
                      <div className="snapshot-compare-head">Status</div>
                      <div className="snapshot-compare-head">Snapshot</div>
                      <div className="snapshot-compare-head">Current</div>

                      {selectedSnapshotCompareRows.length === 0 && (
                        <>
                          <div className="snapshot-compare-cell">—</div>
                          <div className="snapshot-compare-cell">No rows to compare</div>
                          <div className="snapshot-compare-cell">—</div>
                        </>
                      )}

                      {selectedSnapshotCompareRows.map((row) => (
                        <Fragment key={row.id}>
                          <div className="snapshot-compare-cell">
                            <span className={`snapshot-status ${row.status}`}>{row.status}</span>
                          </div>
                          <div className="snapshot-compare-cell">{row.snapshotText}</div>
                          <div className="snapshot-compare-cell">{row.currentText}</div>
                        </Fragment>
                      ))}
                    </div>

                    <div className="inline-actions">
                      <button onClick={() => restoreRevisionSnapshot(selectedSnapshot.id)}>
                        Restore Snapshot
                      </button>
                      <button onClick={() => deleteRevisionSnapshot(selectedSnapshot.id)}>
                        Delete Snapshot
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        query={commandQuery}
        results={commandResults}
        onQueryChange={setCommandQuery}
        onSelect={onPalettePick}
        onClose={closeCommandPalette}
      />
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={onProjectFilePicked}
      />
    </div>
  )
}

export default App
