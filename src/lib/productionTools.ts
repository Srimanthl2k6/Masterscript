import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type {
  BreakdownEntity,
  ScheduleEntry,
  ScriptBlock,
  ScriptProject,
  ShotListItem,
  StoryboardPanel,
} from '../types/screenplay'
import { cloneProject, extractScenes } from './screenplay'
import { parseSceneHeadingParts } from './sceneHeading'

export interface StripboardStrip {
  id: string
  day: number
  sceneId: string | null
  sceneNumber: number | null
  heading: string
  intExt: string
  dayNight: string
  location: string
  cast: string[]
  notes: string
  color: string
}

export interface DoodGridRow {
  character: string
  markers: string[]
}

export interface DoodGrid {
  days: number[]
  rows: DoodGridRow[]
}

export interface CallSheetScene {
  sceneId: string | null
  sceneNumber: number | null
  heading: string
  location: string
  notes: string
  cast: string[]
}

export interface CallSheetCrew {
  name: string
  role: string
  contact: string
}

export interface CallSheet {
  day: number
  scenes: CallSheetScene[]
  cast: string[]
  crew: CallSheetCrew[]
}

export interface ScriptSidesScene {
  sceneId: string
  heading: string
  blocks: ScriptBlock[]
  hasRevisionMarks: boolean
}

export interface ScriptSides {
  day: number
  scenes: ScriptSidesScene[]
}

export interface StoryboardExportPage {
  id: string
  sceneHeading: string
  label: string
  description: string
}

export interface ShotInput {
  shotNumber: string
  type: string
  angle: string
  lens: string
  movement: string
  description: string
}

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

const headingParts = (heading: string) => {
  const parts = parseSceneHeadingParts(heading)
  return {
    intExt: parts.intExt,
    dayNight: parts.dayNight,
    location: parts.location,
  }
}

const stripColorForHeading = (heading: string): string => {
  const { intExt, dayNight } = headingParts(heading)
  const isNight = /\bNIGHT\b/.test(dayNight)

  if (intExt.startsWith('EXT') && isNight) {
    return '#8aa4c8'
  }

  if (intExt.startsWith('EXT')) {
    return '#a8c9ee'
  }

  if (isNight) {
    return '#b9bbc9'
  }

  return '#f1d690'
}

const sceneMaps = (project: ScriptProject) => {
  const scenes = extractScenes(project)
  const headingById = new Map(scenes.map((scene) => [scene.blockId, scene.heading]))
  const numberById = new Map(scenes.map((scene, index) => [scene.blockId, index + 1]))

  return { headingById, numberById, scenes }
}

const castForScene = (
  breakdown: BreakdownEntity[],
  sceneId: string | null,
): string[] => {
  if (!sceneId) {
    return []
  }

  return breakdown
    .filter((entry) => entry.kind === 'cast' && entry.sceneIds.includes(sceneId))
    .map((entry) => entry.name)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
}

const scheduleForDay = (
  schedule: ScheduleEntry[],
  day: number,
): ScheduleEntry[] => schedule.filter((entry) => entry.day === day)

export const buildStripboard = (project: ScriptProject): StripboardStrip[] => {
  const { headingById, numberById } = sceneMaps(project)

  return project.production.schedule.map((entry) => {
    const heading = entry.sceneId
      ? headingById.get(entry.sceneId) ?? 'Unassigned Scene'
      : 'Unassigned Scene'
    const parts = headingParts(heading)

    return {
      id: entry.id,
      day: entry.day,
      sceneId: entry.sceneId,
      sceneNumber: entry.sceneId ? numberById.get(entry.sceneId) ?? null : null,
      heading,
      intExt: parts.intExt,
      dayNight: parts.dayNight,
      location: entry.location || parts.location,
      cast: castForScene(project.production.breakdown, entry.sceneId),
      notes: entry.notes,
      color: entry.stripColor || stripColorForHeading(heading),
    }
  })
}

export const reorderStripboard = (
  project: ScriptProject,
  fromId: string,
  toId: string,
): ScriptProject => {
  const fromIndex = project.production.schedule.findIndex((entry) => entry.id === fromId)
  const toIndex = project.production.schedule.findIndex((entry) => entry.id === toId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return project
  }

  const next = cloneProject(project)
  const [moved] = next.production.schedule.splice(fromIndex, 1)
  next.production.schedule.splice(toIndex, 0, moved)
  return next
}

export const buildDoodGrid = (project: ScriptProject): DoodGrid => {
  const days = [...new Set(project.production.schedule.map((entry) => entry.day))]
    .filter((day) => day > 0)
    .sort((left, right) => left - right)

  const cast = project.production.breakdown
    .filter((entry) => entry.kind === 'cast')
    .sort((left, right) => left.name.localeCompare(right.name))

  const rows = cast.map((entry) => {
    const appearanceDays = new Set(
      project.production.schedule
        .filter(
          (scheduleEntry) =>
            !!scheduleEntry.sceneId && entry.sceneIds.includes(scheduleEntry.sceneId),
        )
        .map((scheduleEntry) => scheduleEntry.day),
    )
    const activeDays = [...appearanceDays].sort((left, right) => left - right)
    const firstDay = activeDays[0] ?? null
    const lastDay = activeDays[activeDays.length - 1] ?? null

    return {
      character: entry.name,
      markers: days.map((day) => {
        if (appearanceDays.has(day)) {
          if (day === firstDay && day === lastDay) {
            return 'S/F'
          }

          if (day === firstDay) {
            return 'S'
          }

          if (day === lastDay) {
            return 'F'
          }

          return 'W'
        }

        if (firstDay !== null && lastDay !== null && day > firstDay && day < lastDay) {
          return 'H'
        }

        if (lastDay !== null && day > lastDay) {
          return 'D'
        }

        return '-'
      }),
    }
  })

  return { days, rows }
}

const csvCell = (value: string | number | null | undefined): string => {
  const text = String(value ?? '')
  if (!/[",\n]/.test(text)) {
    return text
  }

  return `"${text.replace(/"/g, '""')}"`
}

export const buildDoodGridCsv = (project: ScriptProject): string => {
  const grid = buildDoodGrid(project)
  const header = ['Character', ...grid.days.map((day) => `Day ${day}`)]
  const rows = grid.rows.map((row) => [row.character, ...row.markers])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

export const buildCallSheet = (project: ScriptProject, day: number): CallSheet => {
  const { headingById, numberById } = sceneMaps(project)
  const entries = scheduleForDay(project.production.schedule, day)

  const scenes = entries.map((entry) => {
    const heading = entry.sceneId
      ? headingById.get(entry.sceneId) ?? 'Unassigned Scene'
      : 'Unassigned Scene'
    const parts = headingParts(heading)
    return {
      sceneId: entry.sceneId,
      sceneNumber: entry.sceneId ? numberById.get(entry.sceneId) ?? null : null,
      heading,
      location: entry.location || parts.location,
      notes: entry.notes,
      cast: castForScene(project.production.breakdown, entry.sceneId),
    }
  })

  const cast = [...new Set(scenes.flatMap((scene) => scene.cast))].sort((left, right) =>
    left.localeCompare(right),
  )
  const breakdownCrew = project.production.breakdown
    .filter((entry) => entry.kind === 'crew')
    .map((entry) => ({
      name: entry.name,
      role: entry.notes || 'Crew',
      contact: '',
    }))
  const explicitCrew = project.production.crew.map((member) => ({
    name: member.name,
    role: member.role,
    contact: [member.phone, member.email].filter(Boolean).join(' | '),
  }))

  return {
    day,
    scenes,
    cast,
    crew: [...breakdownCrew, ...explicitCrew],
  }
}

const sceneBlockRange = (
  blocks: ScriptBlock[],
  sceneId: string,
): ScriptBlock[] => {
  const startIndex = blocks.findIndex((block) => block.id === sceneId)
  if (startIndex < 0) {
    return []
  }

  const nextSceneIndex = blocks.findIndex(
    (block, index) => index > startIndex && block.type === 'scene-heading',
  )
  const endIndex = nextSceneIndex < 0 ? blocks.length : nextSceneIndex
  return blocks.slice(startIndex, endIndex)
}

export const buildScriptSides = (project: ScriptProject, day: number): ScriptSides => {
  const { headingById } = sceneMaps(project)
  const scenes = scheduleForDay(project.production.schedule, day)
    .map((entry): ScriptSidesScene | null => {
      if (!entry.sceneId) {
        return null
      }

      const blocks = sceneBlockRange(project.blocks, entry.sceneId)
      return {
        sceneId: entry.sceneId,
        heading: headingById.get(entry.sceneId) ?? 'Unassigned Scene',
        blocks,
        hasRevisionMarks: blocks.some((block) => block.revisionMark),
      }
    })
    .filter((scene): scene is ScriptSidesScene => scene !== null)

  return { day, scenes }
}

export const addShotToScene = (
  project: ScriptProject,
  sceneId: string,
  input: ShotInput,
): ScriptProject => {
  const next = cloneProject(project)
  next.production.shots.push({
    id: createId(),
    sceneId,
    ...input,
  })
  return next
}

export const buildShotListRows = (
  project: ScriptProject,
  sceneId?: string,
): Array<ShotListItem & { sceneHeading: string }> => {
  const { headingById } = sceneMaps(project)
  return project.production.shots
    .filter((shot) => (sceneId ? shot.sceneId === sceneId : true))
    .map((shot) => ({
      ...shot,
      sceneHeading: headingById.get(shot.sceneId) ?? 'Unassigned Scene',
    }))
}

export const buildShotListCsv = (project: ScriptProject, sceneId?: string): string => {
  const rows = buildShotListRows(project, sceneId)
  const header = ['Shot Number', 'Scene', 'Type', 'Angle', 'Lens', 'Movement', 'Description']
  const body = rows.map((shot) => [
    shot.shotNumber,
    shot.sceneHeading,
    shot.type,
    shot.angle,
    shot.lens,
    shot.movement,
    shot.description,
  ])

  return [header, ...body].map((row) => row.map(csvCell).join(',')).join('\n')
}

const panelShotLabel = (panel: StoryboardPanel): string => {
  const labelParts = [panel.shotNumber, panel.shotType || panel.shot]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
  return labelParts.join(' | ') || 'Storyboard Panel'
}

export const buildStoryboardExportPages = (
  project: ScriptProject,
): StoryboardExportPage[] => {
  const { headingById } = sceneMaps(project)
  return project.storyboards.map((panel) => ({
    id: panel.id,
    sceneHeading: panel.sceneId
      ? headingById.get(panel.sceneId) ?? 'Unassigned Scene'
      : 'Unassigned Scene',
    label: panelShotLabel(panel),
    description: [
      panel.description,
      panel.angle ? `Angle: ${panel.angle}` : '',
      panel.lens ? `Lens: ${panel.lens}` : '',
      panel.movement ? `Movement: ${panel.movement}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  }))
}

const wrapLine = (line: string, maxLength: number): string[] => {
  const words = line.split(/\s+/).filter(Boolean)
  const wrapped: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxLength && current) {
      wrapped.push(current)
      current = word
      continue
    }

    current = next
  }

  if (current) {
    wrapped.push(current)
  }

  return wrapped.length > 0 ? wrapped : ['']
}

export const exportTextReportToPdf = async (
  title: string,
  lines: string[],
): Promise<ArrayBuffer> => {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 612
  const pageHeight = 792
  const margin = 54
  const lineHeight = 14
  let page = document.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const drawLine = (text: string, bold = false) => {
    if (y < margin) {
      page = document.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }

    page.drawText(text, {
      x: margin,
      y,
      size: bold ? 12 : 10,
      font: bold ? boldFont : font,
      color: rgb(0.08, 0.08, 0.08),
    })
    y -= lineHeight
  }

  drawLine(title, true)
  y -= 8

  for (const line of lines) {
    for (const wrapped of wrapLine(line, 94)) {
      drawLine(wrapped)
    }
  }

  const bytes = await document.save()
  return Uint8Array.from(bytes).buffer
}
