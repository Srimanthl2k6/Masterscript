import type { RevisionColor, ScriptProject } from '../types/screenplay'
import { cloneProject } from './screenplay'

export const wgaRevisionColorSequence: RevisionColor[] = [
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

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

export const beginNextRevisionSet = (
  project: ScriptProject,
  label?: string,
): ScriptProject => {
  const next = cloneProject(project)
  const color =
    wgaRevisionColorSequence[next.revisionDraftSets.length % wgaRevisionColorSequence.length]
  const createdAt = new Date().toISOString()

  next.meta.revisionMode = true
  next.meta.activeRevision = color
  next.revisionDraftSets.push({
    id: createId(),
    label: label?.trim() || `${color} revision ${next.revisionDraftSets.length + 1}`,
    color,
    createdAt,
  })

  return next
}

export const updateBlockTextWithRevisionTracking = (
  project: ScriptProject,
  blockId: string,
  text: string,
): { project: ScriptProject; blocked: boolean } => {
  const next = cloneProject(project)
  const target = next.blocks.find((block) => block.id === blockId)

  if (!target) {
    return { project: next, blocked: false }
  }

  if (target.locked) {
    return { project: next, blocked: true }
  }

  target.text = text
  if (next.meta.revisionMode) {
    target.revision = next.meta.activeRevision
    target.revisionMark = true
  }

  return { project: next, blocked: false }
}

const sceneRangeFor = (project: ScriptProject, sceneId: string): [number, number] | null => {
  const start = project.blocks.findIndex((block) => block.id === sceneId)
  if (start < 0) {
    return null
  }

  let end = project.blocks.length
  for (let index = start + 1; index < project.blocks.length; index += 1) {
    if (project.blocks[index].type === 'scene-heading') {
      end = index
      break
    }
  }

  return [start, end]
}

const setSceneLock = (
  project: ScriptProject,
  sceneId: string,
  locked: boolean,
): ScriptProject => {
  const next = cloneProject(project)
  const range = sceneRangeFor(next, sceneId)
  if (!range) {
    return next
  }

  const [start, end] = range
  for (let index = start; index < end; index += 1) {
    next.blocks[index].locked = locked
  }

  return next
}

export const lockScene = (project: ScriptProject, sceneId: string): ScriptProject =>
  setSceneLock(project, sceneId, true)

export const unlockScene = (project: ScriptProject, sceneId: string): ScriptProject =>
  setSceneLock(project, sceneId, false)

export const omitScene = (project: ScriptProject, sceneId: string): ScriptProject => {
  const next = cloneProject(project)
  const target = next.blocks.find((block) => block.id === sceneId)

  if (!target) {
    return next
  }

  target.omitted = true
  target.omittedText = target.text
  target.text = '(OMITTED)'
  target.revisionMark = true

  return next
}

export const unomitScene = (project: ScriptProject, sceneId: string): ScriptProject => {
  const next = cloneProject(project)
  const target = next.blocks.find((block) => block.id === sceneId)

  if (!target) {
    return next
  }

  target.omitted = false
  target.text = target.omittedText || target.text
  target.omittedText = null
  target.revisionMark = true

  return next
}

export const buildAPageLabels = (basePage: number, count: number): string[] =>
  Array.from({ length: Math.max(0, count) }, (_, index) => {
    if (index === 0) {
      return String(basePage)
    }

    return `${basePage}${String.fromCharCode(64 + index)}`
  })

export const stashDialogueSelection = (
  project: ScriptProject,
  blockId: string,
  start: number,
  end: number,
  label = 'Alternate dialogue',
): { project: ScriptProject; stashedText: string } => {
  const next = cloneProject(project)
  const target = next.blocks.find((block) => block.id === blockId)

  if (!target || target.type !== 'dialogue') {
    return { project: next, stashedText: '' }
  }

  const safeStart = Math.max(0, Math.min(start, target.text.length))
  const safeEnd = Math.max(safeStart, Math.min(end, target.text.length))
  const stashedText = target.text.slice(safeStart, safeEnd)

  if (!stashedText) {
    return { project: next, stashedText: '' }
  }

  target.text = `${target.text.slice(0, safeStart)}${target.text.slice(safeEnd)}`
  target.revisionMark = true
  next.dialogueStash.push({
    id: createId(),
    label,
    sourceBlockId: blockId,
    text: stashedText,
    createdAt: new Date().toISOString(),
  })

  return { project: next, stashedText }
}

export const swapStashIntoDialogue = (
  project: ScriptProject,
  stashId: string,
  targetBlockId: string,
): ScriptProject => {
  const next = cloneProject(project)
  const stash = next.dialogueStash.find((item) => item.id === stashId)
  const target = next.blocks.find((block) => block.id === targetBlockId)

  if (!stash || !target || target.type !== 'dialogue') {
    return next
  }

  target.text = `${target.text.trimEnd()} ${stash.text}`.trim()
  target.revisionMark = true
  next.dialogueStash = next.dialogueStash.filter((item) => item.id !== stashId)

  return next
}
