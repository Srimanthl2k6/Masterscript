import type { ScriptProject } from '../types/screenplay'
import { cloneProject } from './screenplay'

interface DuplicateProjectOptions {
  id?: string
  now?: string
}

const createProjectId = (): string => {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID()
  }
  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const duplicateTitle = (title: string): string => {
  const normalized = title.trim() || 'Untitled Screenplay'
  return /\sCopy$/i.test(normalized) ? normalized : `${normalized} Copy`
}

export const duplicateProject = (
  source: ScriptProject,
  options: DuplicateProjectOptions = {},
): ScriptProject => {
  const duplicate = cloneProject(source)
  const now = options.now ?? new Date().toISOString()

  duplicate.id = options.id ?? createProjectId()
  duplicate.meta.title = duplicateTitle(source.meta.title)
  duplicate.meta.createdAt = now
  duplicate.meta.updatedAt = now
  delete duplicate.meta.collaborationRoomId
  delete duplicate.meta.collaborationInviteKey
  delete duplicate.meta.collaborationMode
  delete duplicate.meta.collaborationLanServerUrl
  delete duplicate.meta.collaborationLanProtocolVersion

  return duplicate
}
