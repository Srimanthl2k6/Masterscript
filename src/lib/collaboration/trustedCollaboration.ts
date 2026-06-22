import type { ScriptProject } from '../../types/screenplay'
import { hasCollaborationMeta } from './collaborationInvite'

interface CollaborationTrustStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const trustedCollaborationKey = 'masterscript-trusted-collaboration-v1'
const trustedCollaborationLimit = 100
const textEncoder = new TextEncoder()

const fingerprintInput = (project: ScriptProject): string =>
  JSON.stringify([
    project.id,
    project.meta.collaborationMode ?? 'webrtc',
    project.meta.collaborationRoomId?.trim() ?? '',
    project.meta.collaborationInviteKey?.trim() ?? '',
    project.meta.collaborationLanServerUrl?.trim() ?? '',
    project.meta.collaborationLanProtocolVersion ?? null,
  ])

const collaborationFingerprint = async (
  project: ScriptProject,
): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(fingerprintInput(project)),
  )
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

const readFingerprints = (storage: CollaborationTrustStorage): string[] => {
  try {
    const raw = storage.getItem(trustedCollaborationKey)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (value): value is string =>
              typeof value === 'string' && /^[a-f0-9]{64}$/.test(value),
          )
          .slice(0, trustedCollaborationLimit)
      : []
  } catch {
    return []
  }
}

export const rememberTrustedCollaboration = async (
  storage: CollaborationTrustStorage,
  project: ScriptProject,
): Promise<void> => {
  if (!hasCollaborationMeta(project)) {
    return
  }
  const fingerprint = await collaborationFingerprint(project)
  const current = readFingerprints(storage).filter(
    (entry) => entry !== fingerprint,
  )
  storage.setItem(
    trustedCollaborationKey,
    JSON.stringify(
      [fingerprint, ...current].slice(0, trustedCollaborationLimit),
    ),
  )
}

export const isTrustedCollaboration = async (
  storage: CollaborationTrustStorage,
  project: ScriptProject,
): Promise<boolean> => {
  if (!hasCollaborationMeta(project)) {
    return false
  }
  const fingerprint = await collaborationFingerprint(project)
  return readFingerprints(storage).includes(fingerprint)
}

