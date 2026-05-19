export type BlockType =
  | 'scene-heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'
  | 'super'
  | 'insert'
  | 'intercut'
  | 'flashback'
  | 'end-flashback'
  | 'montage'
  | 'end-montage'
  | 'card'
  | 'title'
  | 'chyron'
  | 'crawl'
  | 'prelap'
  | 'audio-description'
  | 'recap'
  | 'two-column-av'
  | 'cold-open'
  | 'act-break'
  | 'title-over-black'
  | 'over-black'
  | 'the-end'
  | 'note'

export type ScriptExtension =
  | 'V.O.'
  | 'O.S.'
  | "CONT'D"
  | 'PRE-LAP'
  | 'FILTERED'

export type DualDialogueSide = 'left' | 'right'

export type RevisionColor =
  | 'white'
  | 'blue'
  | 'pink'
  | 'yellow'
  | 'green'
  | 'goldenrod'
  | 'buff'
  | 'salmon'
  | 'cherry'
  | 'tan'

export interface ScriptBlock {
  id: string
  type: BlockType
  text: string
  revision: RevisionColor | null
  extension?: ScriptExtension | null
  dualDialogueId?: string | null
  dualDialogueSide?: DualDialogueSide | null
  revisionMark?: boolean
  locked?: boolean
  omitted?: boolean
  omittedText?: string | null
  lockedPageLabel?: string | null
}

export interface StoryCard {
  id: string
  title: string
  beat: string
  linkedSceneId: string | null
  x?: number
  y?: number
  color?: string
  imageDataUrl?: string
}

export type SceneStatus = 'Draft' | 'In Progress' | 'Final' | 'Needs Revision'

export interface SceneDevelopmentMeta {
  sceneId: string
  status: SceneStatus
  color: string
  summary: string
  actBreak: string
}

export interface StoryOutlineNode {
  id: string
  type: 'act' | 'sequence' | 'scene'
  title: string
  sceneId?: string | null
  children: StoryOutlineNode[]
}

export interface InlineNote {
  id: string
  sceneId: string | null
  blockId: string | null
  text: string
  createdAt: string
}

export interface StoryNotes {
  script: string
  scratchpad: string
  scenes: Record<string, string>
  inline: InlineNote[]
}

export interface StoryDevelopmentState {
  outline: StoryOutlineNode[]
  sceneMeta: Record<string, SceneDevelopmentMeta>
  notes: StoryNotes
}

export type CharacterArcStage = 'Setup' | 'Conflict' | 'Change' | 'Resolution'

export interface CharacterCustomField {
  id: string
  label: string
  value: string
}

export interface CharacterProfile {
  name: string
  bio: string
  notes: string
  imageDataUrl: string
  customFields: CharacterCustomField[]
}

export interface CharacterRelationship {
  id: string
  from: string
  to: string
  label: string
}

export interface CharacterToolsState {
  profiles: Record<string, CharacterProfile>
  relationships: CharacterRelationship[]
  arcs: Record<string, Record<string, CharacterArcStage>>
}

export interface ProductivitySettings {
  focusMode: boolean
  typewriterMode: boolean
  fullscreenMode: boolean
}

export interface WritingGoals {
  dailyPageGoal: number
  projectPageGoal: number
  dailyPagesWritten: number
}

export interface SprintSession {
  id: string
  minutes: number
  wordsStarted: number
  wordsEnded: number
  wordDelta: number
  endedAt: string
}

export interface SprintState {
  activeMinutes: number
  remainingSeconds: number
  isRunning: boolean
  sessions: SprintSession[]
}

export interface WritingStreak {
  current: number
  longest: number
  lastWritingDate: string | null
}

export interface TtsState {
  speed: number
  voiceByCharacter: Record<string, string>
}

export interface ProductivityState {
  settings: ProductivitySettings
  goals: WritingGoals
  sprints: SprintState
  streak: WritingStreak
  tts: TtsState
}

export interface ScheduleEntry {
  id: string
  day: number
  sceneId: string | null
  location: string
  notes: string
  stripColor?: string
  shootDaySeparator?: boolean
}

export type BreakdownKind =
  | 'cast'
  | 'location'
  | 'prop'
  | 'vehicle'
  | 'equipment'
  | 'crew'

export interface BreakdownEntity {
  id: string
  kind: BreakdownKind
  name: string
  sceneIds: string[]
  notes: string
}

export interface BudgetItem {
  id: string
  category: string
  description: string
  amount: number
}

export interface StoryboardPanel {
  id: string
  sceneId: string | null
  shot: string
  shotNumber?: string
  shotType?: string
  angle?: string
  lens?: string
  movement?: string
  description: string
}

export interface CrewMember {
  id: string
  name: string
  role: string
  phone: string
  email: string
}

export interface ShotListItem {
  id: string
  sceneId: string
  shotNumber: string
  type: string
  angle: string
  lens: string
  movement: string
  description: string
}

export type DepartmentTagCategory =
  | 'Cast'
  | 'Extras'
  | 'Props'
  | 'Wardrobe'
  | 'Makeup'
  | 'Animals'
  | 'VFX'
  | 'SFX'
  | 'Vehicles'
  | 'Stunts'
  | 'Locations'
  | 'Music'
  | 'Set Dressing'
  | 'Custom'

export interface TaggedScriptRange {
  id: string
  blockId: string
  sceneId: string | null
  category: DepartmentTagCategory
  text: string
  start: number
  end: number
  color: string
  catalogItemId: string
}

export interface TagCatalogItem {
  id: string
  category: DepartmentTagCategory
  name: string
  cost: number
  notes: string
  imageDataUrl: string
}

export interface TaggingState {
  tags: TaggedScriptRange[]
  catalog: TagCatalogItem[]
}

export type ScriptFormatId =
  | 'feature'
  | 'tv-one-hour'
  | 'multi-cam-sitcom'
  | 'stage-play'
  | 'audio-drama'
  | 'comic-book'
  | 'two-column-av'
  | 'documentary'

export type CastStatus =
  | 'Series Regular'
  | 'Recurring'
  | 'Guest Star'
  | 'Co-Star'
  | 'Day Player'
  | 'Under-5'

export interface AdvancedTitlePageFields {
  writtenBy: string
  screenplayBy: string
  storyBy: string
  originalStoryBy: string
  basedOn: string
  earlierDraftWrittenBy: string
  wgaRegistrationNumber: string
  copyrightNotice: string
  coverImageDataUrl: string
}

export interface RevisionDistributionEvent {
  id: string
  date: string
  color: RevisionColor
  pages: string[]
  recipients: string
}

export interface LockedPageRecord {
  label: string
  maxLines: number
  usedLines: number
}

export interface TimingWeights {
  action: number
  dialogue: number
  mixed: number
}

export interface CoverageRecord {
  id: string
  draftId: string
  logline: string
  format: string
  genre: string
  setting: string
  timePeriod: string
  characters: Array<{ name: string; description: string }>
  synopsisByAct: {
    actOne: string
    actTwo: string
    actThree: string
  }
  comments: {
    story: string
    character: string
    dialogue: string
    format: string
  }
  recommendation: 'Pass' | 'Consider' | 'Recommend'
  ratings: {
    concept: number
    story: number
    structure: number
    character: number
    dialogue: number
    format: number
  }
}

export interface ParkingLotScene {
  id: string
  title: string
  blocks: ScriptBlock[]
}

export interface WhiteboardItem {
  id: string
  kind: 'sticky' | 'text' | 'arrow' | 'image'
  x: number
  y: number
  text: string
  imageDataUrl: string
}

export interface ResearchItem {
  id: string
  title: string
  body: string
  url: string
  imageDataUrl: string
}

export interface AdvancedState {
  activeFormat: ScriptFormatId
  formatting: {
    showContinuedHeaders: boolean
    showContinuedFooters: boolean
    characterContdEnabled: boolean
    contdActionBreakLines: number
    includeFadeIn: boolean
  }
  sceneNumbering: {
    locked: boolean
    showNumbers: boolean
    numbers: Record<string, string>
  }
  titlePage: AdvancedTitlePageFields
  submissionLocked: boolean
  revisionDistributionLog: RevisionDistributionEvent[]
  lockedPages: LockedPageRecord[]
  fixedPageMode: boolean
  castStatuses: Record<string, CastStatus>
  timing: {
    weights: TimingWeights
    manualSceneTimings: Record<string, string>
  }
  lint: {
    cutToThreshold: number
    parentheticalThreshold: number
    coldOpenPageLimit: number
    actImbalancePercent: number
    acknowledgedNonStandardExtensions: string[]
  }
  series: {
    bible: string
    season: number
    episodeTitle: string
    plotThreads: Record<string, 'A' | 'B' | 'C'>
    sharedCharacters: Record<string, { name: string; renamedTo?: string }>
    sharedLocations: Record<string, { name: string; renamedTo?: string }>
  }
  coverage: CoverageRecord[]
  writerRoom: {
    parkingLot: ParkingLotScene[]
    whiteboard: WhiteboardItem[]
    research: ResearchItem[]
  }
  print: {
    draftInkSaver: boolean
    twoUp: boolean
    watermarkText: string
    watermarkPosition: 'center' | 'top' | 'bottom'
    watermarkOpacity: number
    recipientWatermark: string
  }
  accessibility: {
    taggedPdf: boolean
    closedCaptionTemplate: boolean
    audioDescriptionEnabled: boolean
  }
  editor: {
    shortcuts: Record<string, string>
  }
  legal: {
    draftNotes: Record<string, string>
  }
}

export type CatalogKind = 'character' | 'location'

export interface CatalogEntry {
  id: string
  kind: CatalogKind
  name: string
  notes: string
}

export interface ScriptProjectMeta {
  title: string
  author: string
  contact: string
  draftDate: string
  credits: string
  titlePageNotes: string
  includeTitlePage: boolean
  showPageNumbers: boolean
  showSceneNumbers: boolean
  createdAt: string
  updatedAt: string
  revisionMode: boolean
  activeRevision: RevisionColor
}

export interface RevisionSnapshot {
  id: string
  label: string
  createdAt: string
  blocks: ScriptBlock[]
}

export interface RevisionSnapshotDiff {
  added: number
  removed: number
  changed: number
  unchanged: number
}

export interface RevisionDraftSet {
  id: string
  label: string
  color: RevisionColor
  createdAt: string
}

export interface DialogueStashItem {
  id: string
  label: string
  sourceBlockId: string
  text: string
  createdAt: string
}

export interface ScriptProject {
  id: string
  schemaVersion: number
  meta: ScriptProjectMeta
  blocks: ScriptBlock[]
  revisionSnapshots: RevisionSnapshot[]
  revisionDraftSets: RevisionDraftSet[]
  dialogueStash: DialogueStashItem[]
  cards: StoryCard[]
  production: {
    schedule: ScheduleEntry[]
    breakdown: BreakdownEntity[]
    shots: ShotListItem[]
    crew: CrewMember[]
  }
  budget: {
    items: BudgetItem[]
  }
  storyboards: StoryboardPanel[]
  catalog: CatalogEntry[]
  story: StoryDevelopmentState
  characters: CharacterToolsState
  productivity: ProductivityState
  tagging: TaggingState
  advanced: AdvancedState
}

export interface SceneSummary {
  blockId: string
  index: number
  heading: string
}

export interface ScriptStats {
  sceneCount: number
  dialogueLines: number
  wordCount: number
  estimatedPages: number
}

export const blockTypeOrder: BlockType[] = [
  'scene-heading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'shot',
  'super',
  'insert',
  'intercut',
  'flashback',
  'end-flashback',
  'montage',
  'end-montage',
  'card',
  'title',
  'chyron',
  'crawl',
  'prelap',
  'audio-description',
  'recap',
  'two-column-av',
  'cold-open',
  'act-break',
  'title-over-black',
  'over-black',
  'the-end',
  'note',
]

export const blockTypeLabels: Record<BlockType, string> = {
  'scene-heading': 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
  shot: 'Shot',
  super: 'SUPER',
  insert: 'Insert',
  intercut: 'Intercut',
  flashback: 'Flashback',
  'end-flashback': 'End Flashback',
  montage: 'Montage',
  'end-montage': 'End Montage',
  card: 'Card',
  title: 'Title',
  chyron: 'Chyron',
  crawl: 'Crawl',
  prelap: 'Prelap',
  'audio-description': 'Audio Description',
  recap: 'Previously On',
  'two-column-av': 'Two-Column AV',
  'cold-open': 'Cold Open',
  'act-break': 'Act Break',
  'title-over-black': 'Title Over Black',
  'over-black': 'Over Black',
  'the-end': 'The End',
  note: 'Note',
}

export const revisionColors: RevisionColor[] = [
  'white',
  'blue',
  'pink',
  'yellow',
  'green',
  'goldenrod',
  'buff',
  'salmon',
  'cherry',
  'tan',
]
