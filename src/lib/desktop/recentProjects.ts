import { recentProjectsKey } from './storageKeys'
import type {
  ProjectFileRef,
  RecentProjectEntry,
} from './types'

interface RecentProjectStorage {
  getItem(key: string): string | null
}

interface UpsertRecentProjectOptions {
  label: string
  source: RecentProjectEntry['source']
  projectId?: string
  fileRef?: ProjectFileRef
  updatedAt?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isRecentProjectEntry = (value: unknown): value is RecentProjectEntry => {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.label === 'string' &&
    (value.source === 'project' || value.source === 'import') &&
    typeof value.updatedAt === 'string' &&
    (value.projectId === undefined || typeof value.projectId === 'string') &&
    (value.fileGrantId === undefined || typeof value.fileGrantId === 'string')
  )
}

export const readRecentProjects = (
  storage: RecentProjectStorage,
): RecentProjectEntry[] => {
  try {
    const raw = storage.getItem(recentProjectsKey)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed)
      ? parsed.filter(isRecentProjectEntry).slice(0, 8)
      : []
  } catch {
    return []
  }
}

export const upsertRecentProject = (
  previous: RecentProjectEntry[],
  {
    label,
    source,
    projectId,
    fileRef,
    updatedAt = new Date().toISOString(),
  }: UpsertRecentProjectOptions,
): RecentProjectEntry[] => {
  const cleaned = label.trim()
  if (!cleaned) {
    return previous
  }
  const nextItem: RecentProjectEntry = {
    label: cleaned,
    source,
    projectId,
    fileGrantId: fileRef?.grantId,
    updatedAt,
  }
  const deduped = previous.filter((entry) => {
    if (fileRef?.grantId) {
      return entry.fileGrantId !== fileRef.grantId
    }
    return projectId
      ? entry.projectId !== projectId
      : entry.label !== cleaned
  })
  return [nextItem, ...deduped].slice(0, 8)
}
