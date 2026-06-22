import type { ScriptProject } from '../../types/screenplay'

export type CollaborationProjectMode = 'webrtc' | 'lan'

export interface CollaborationInviteDetails {
  mode: CollaborationProjectMode
  roomId: string
  inviteKey: string
  lanServerUrl?: string
  protocolVersion?: 2
}

const COLLABORATION_PROTOCOL = 'masterscript:'
const COLLABORATION_HOST = 'collab'

const trimValue = (value: string | undefined): string => value?.trim() ?? ''

const assertLanServerUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      throw new Error('LAN invite server must use ws:// or wss://')
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'LAN invite server must use ws:// or wss://') {
      throw error
    }
    throw new Error('LAN invite server is invalid')
  }
}

export const buildCollaborationInvite = (details: CollaborationInviteDetails): string => {
  const roomId = trimValue(details.roomId)
  const inviteKey = trimValue(details.inviteKey)
  if (!roomId) {
    throw new Error('Invite is missing a room ID')
  }
  if (!inviteKey) {
    throw new Error('Invite is missing an invite key')
  }

  const params = new URLSearchParams()
  params.set('mode', details.mode)
  params.set('room', roomId)
  params.set('key', inviteKey)

  if (details.mode === 'lan') {
    if (details.protocolVersion !== 2) {
      throw new Error(
        'This LAN invite uses an older security protocol. Ask the host to generate a new invite.',
      )
    }
    params.set('v', '2')
    const lanServerUrl = trimValue(details.lanServerUrl)
    if (!lanServerUrl) {
      throw new Error('LAN invite is missing a server URL')
    }
    assertLanServerUrl(lanServerUrl)
    params.set('server', lanServerUrl)
  }

  return `masterscript://collab?${params.toString()}`
}

export const parseCollaborationInvite = (value: string): CollaborationInviteDetails => {
  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch {
    throw new Error('Invite must start with masterscript://collab')
  }

  if (parsed.protocol !== COLLABORATION_PROTOCOL || parsed.hostname !== COLLABORATION_HOST) {
    throw new Error('Invite must start with masterscript://collab')
  }

  const mode = parsed.searchParams.get('mode')
  if (mode !== 'webrtc' && mode !== 'lan') {
    throw new Error('Invite mode is not supported')
  }

  const roomId = trimValue(parsed.searchParams.get('room') ?? undefined)
  const inviteKey = trimValue(parsed.searchParams.get('key') ?? undefined)
  if (!roomId) {
    throw new Error('Invite is missing a room ID')
  }
  if (!inviteKey) {
    throw new Error('Invite is missing an invite key')
  }

  if (mode === 'lan') {
    if (parsed.searchParams.get('v') !== '2') {
      throw new Error(
        'This LAN invite uses an older security protocol. Ask the host to generate a new invite.',
      )
    }
    const lanServerUrl = trimValue(parsed.searchParams.get('server') ?? undefined)
    if (!lanServerUrl) {
      throw new Error('LAN invite is missing a server URL')
    }
    assertLanServerUrl(lanServerUrl)
    return { mode, roomId, inviteKey, lanServerUrl, protocolVersion: 2 }
  }

  return { mode, roomId, inviteKey }
}

export const hasCollaborationMeta = (project: ScriptProject): boolean => {
  const mode = project.meta.collaborationMode ?? 'webrtc'
  return Boolean(
    project.meta.collaborationRoomId?.trim() &&
      project.meta.collaborationInviteKey?.trim() &&
      (mode === 'webrtc' || mode === 'lan') &&
      (mode === 'webrtc' ||
        (project.meta.collaborationLanServerUrl?.trim() &&
          project.meta.collaborationLanProtocolVersion === 2)),
  )
}

export const applyCollaborationMeta = (
  project: ScriptProject,
  details: CollaborationInviteDetails,
): ScriptProject => ({
  ...project,
  meta: {
    ...project.meta,
    collaborationMode: details.mode,
    collaborationRoomId: details.roomId,
    collaborationInviteKey: details.inviteKey,
    collaborationLanServerUrl: details.mode === 'lan' ? details.lanServerUrl : undefined,
    collaborationLanProtocolVersion:
      details.mode === 'lan' ? details.protocolVersion : undefined,
    updatedAt: new Date().toISOString(),
  },
})
