import type { ScriptProject } from '../types/screenplay'
import { cloneProject } from './screenplay'

export type ProjectPatch =
  | {
      path: Array<string | number>
      value: unknown
      operation?: 'set'
    }
  | {
      path: Array<string | number>
      operation: 'splice'
      index: number
      deleteCount: number
      items: unknown[]
    }

export interface ProjectHistoryEntry {
  forward: ProjectPatch[]
  inverse: ProjectPatch[]
  status: string
  coalesceKey?: string
  timestamp: number
}

export interface ProjectHistoryState {
  past: ProjectHistoryEntry[]
  present: ScriptProject
  future: ProjectHistoryEntry[]
}

interface CommitOptions {
  coalesceKey?: string
  timestamp?: number
}

const historyLimit = 80
const typingCoalesceWindowMs = 1500

const cloneValue = <T,>(value: T): T => {
  if (value === undefined || value === null || typeof value !== 'object') {
    return value
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const arrayItemId = (value: unknown): string | null =>
  isRecord(value) && typeof value.id === 'string' ? value.id : null

const collectPatches = (
  before: unknown,
  after: unknown,
  path: Array<string | number>,
  forward: ProjectPatch[],
  inverse: ProjectPatch[],
) => {
  if (Object.is(before, after)) {
    return
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length) {
      const beforeIds = before.map(arrayItemId)
      const afterIds = after.map(arrayItemId)
      const canSplice =
        beforeIds.every((id) => id !== null) &&
        afterIds.every((id) => id !== null)
      if (!canSplice) {
        forward.push({ path, value: cloneValue(after) })
        inverse.push({ path, value: cloneValue(before) })
        return
      }

      let prefixLength = 0
      while (
        prefixLength < beforeIds.length &&
        prefixLength < afterIds.length &&
        beforeIds[prefixLength] === afterIds[prefixLength]
      ) {
        prefixLength += 1
      }
      let suffixLength = 0
      while (
        suffixLength < beforeIds.length - prefixLength &&
        suffixLength < afterIds.length - prefixLength &&
        beforeIds[beforeIds.length - 1 - suffixLength] ===
          afterIds[afterIds.length - 1 - suffixLength]
      ) {
        suffixLength += 1
      }
      const beforeEnd = before.length - suffixLength
      const afterEnd = after.length - suffixLength
      forward.push({
        path,
        operation: 'splice',
        index: prefixLength,
        deleteCount: beforeEnd - prefixLength,
        items: cloneValue(after.slice(prefixLength, afterEnd)),
      })
      inverse.push({
        path,
        operation: 'splice',
        index: prefixLength,
        deleteCount: afterEnd - prefixLength,
        items: cloneValue(before.slice(prefixLength, beforeEnd)),
      })
      return
    }
    before.forEach((value, index) => {
      collectPatches(value, after[index], [...path, index], forward, inverse)
    })
    return
  }

  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const key of keys) {
      collectPatches(before[key], after[key], [...path, key], forward, inverse)
    }
    return
  }

  forward.push({ path, value: cloneValue(after) })
  inverse.push({ path, value: cloneValue(before) })
}

const applyPatches = (
  project: ScriptProject,
  patches: ProjectPatch[],
): ScriptProject => {
  let next: unknown = cloneProject(project)

  for (const patch of patches) {
    if (patch.operation === 'splice') {
      let target: unknown = next
      for (const key of patch.path) {
        target = (target as Record<string | number, unknown>)[key]
      }
      if (!Array.isArray(target)) {
        throw new Error(`History splice target is not an array: ${patch.path.join('.')}`)
      }
      target.splice(
        patch.index,
        patch.deleteCount,
        ...cloneValue(patch.items),
      )
      continue
    }

    if (patch.path.length === 0) {
      next = cloneValue(patch.value)
      continue
    }

    let target = next as Record<string | number, unknown>
    for (let index = 0; index < patch.path.length - 1; index += 1) {
      target = target[patch.path[index]] as Record<string | number, unknown>
    }
    const key = patch.path[patch.path.length - 1]
    if (patch.value === undefined) {
      delete target[key]
    } else {
      target[key] = cloneValue(patch.value)
    }
  }

  return next as ScriptProject
}

const mergeCoalescedEntry = (
  previous: ProjectHistoryEntry,
  current: ProjectHistoryEntry,
): ProjectHistoryEntry => {
  const forward = new Map(
    previous.forward.map((patch) => [
      `${patch.operation ?? 'set'}:${JSON.stringify(patch.path)}`,
      patch,
    ]),
  )
  const inverse = new Map(
    previous.inverse.map((patch) => [
      `${patch.operation ?? 'set'}:${JSON.stringify(patch.path)}`,
      patch,
    ]),
  )

  for (const patch of current.forward) {
    forward.set(
      `${patch.operation ?? 'set'}:${JSON.stringify(patch.path)}`,
      patch,
    )
  }
  for (const patch of current.inverse) {
    const key = `${patch.operation ?? 'set'}:${JSON.stringify(patch.path)}`
    if (!inverse.has(key)) {
      inverse.set(key, patch)
    }
  }

  return {
    ...current,
    forward: [...forward.values()],
    inverse: [...inverse.values()],
  }
}

export const createProjectHistory = (
  project: ScriptProject,
): ProjectHistoryState => ({
  past: [],
  present: project,
  future: [],
})

export const replaceProjectHistory = (
  project: ScriptProject,
): ProjectHistoryState => createProjectHistory(project)

export const commitProjectHistory = (
  history: ProjectHistoryState,
  updater: (draft: ScriptProject) => void,
  status: string,
  options: CommitOptions = {},
): ProjectHistoryState => {
  const nextProject = cloneProject(history.present)
  updater(nextProject)
  nextProject.meta.updatedAt = new Date(
    options.timestamp ?? Date.now(),
  ).toISOString()

  const forward: ProjectPatch[] = []
  const inverse: ProjectPatch[] = []
  collectPatches(history.present, nextProject, [], forward, inverse)
  if (forward.length === 0) {
    return history
  }

  const timestamp = options.timestamp ?? Date.now()
  const entry: ProjectHistoryEntry = {
    forward,
    inverse,
    status,
    coalesceKey: options.coalesceKey,
    timestamp,
  }
  const previousEntry = history.past.at(-1)
  const shouldCoalesce =
    Boolean(options.coalesceKey) &&
    previousEntry !== undefined &&
    previousEntry?.coalesceKey === options.coalesceKey &&
    timestamp - previousEntry.timestamp <= typingCoalesceWindowMs
  const past = shouldCoalesce
    ? [
        ...history.past.slice(0, -1),
        mergeCoalescedEntry(previousEntry as ProjectHistoryEntry, entry),
      ]
    : [...history.past, entry].slice(-historyLimit)

  return {
    past,
    present: nextProject,
    future: [],
  }
}

export const commitProjectReplacement = (
  history: ProjectHistoryState,
  project: ScriptProject,
  status: string,
  options: CommitOptions = {},
): ProjectHistoryState =>
  commitProjectHistory(
    history,
    (draft) => {
      Object.keys(draft).forEach((key) => {
        delete (draft as unknown as Record<string, unknown>)[key]
      })
      Object.assign(draft, cloneProject(project))
    },
    status,
    options,
  )

export const undoProjectHistory = (
  history: ProjectHistoryState,
): ProjectHistoryState => {
  const entry = history.past.at(-1)
  if (!entry) {
    return history
  }

  return {
    past: history.past.slice(0, -1),
    present: applyPatches(history.present, [...entry.inverse].reverse()),
    future: [entry, ...history.future],
  }
}

export const redoProjectHistory = (
  history: ProjectHistoryState,
): ProjectHistoryState => {
  const entry = history.future[0]
  if (!entry) {
    return history
  }

  return {
    past: [...history.past, entry].slice(-historyLimit),
    present: applyPatches(history.present, entry.forward),
    future: history.future.slice(1),
  }
}
