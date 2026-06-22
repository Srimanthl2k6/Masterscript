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
const MAX_ROOM_ID_LENGTH = 256
const MAX_INVITE_KEY_LENGTH = 1024
const MAX_SERVER_URL_LENGTH = 2048
const LAN_ROOM_ID_PATTERN = /^ms2-[A-Za-z0-9_-]{22}$/
const LAN_INVITE_KEY_PATTERN =
  /^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{22}$/

const trimValue = (value: string | undefined): string => value?.trim() ?? ''

const assertLanServerUrl = (value: string) => {
  if (value.length > MAX_SERVER_URL_LENGTH) {
    throw new Error('LAN invite server URL is too long')
  }
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

const assertCollaborationIdentifiers = (
  mode: CollaborationProjectMode,
  roomId: string,
  inviteKey: string,
) => {
  if (!roomId) {
    throw new Error('Invite is missing a room ID')
  }
  if (roomId.length > MAX_ROOM_ID_LENGTH) {
    throw new Error('Invite room ID is too long')
  }
  if (!inviteKey) {
    throw new Error('Invite is missing an invite key')
  }
  if (inviteKey.length > MAX_INVITE_KEY_LENGTH) {
    throw new Error('Invite key is too long')
  }
  if (mode === 'lan') {
    if (!LAN_ROOM_ID_PATTERN.test(roomId)) {
      throw new Error('LAN invite must use a 128-bit protocol v2 room ID')
    }
    if (!LAN_INVITE_KEY_PATTERN.test(inviteKey)) {
      throw new Error('LAN invite key is invalid')
    }
  }
}

export const buildCollaborationInvite = (details: CollaborationInviteDetails): string => {
  const roomId = trimValue(details.roomId)
  const inviteKey = trimValue(details.inviteKey)
  assertCollaborationIdentifiers(details.mode, roomId, inviteKey)

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
  assertCollaborationIdentifiers(mode, roomId, inviteKey)

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
  const roomId = project.meta.collaborationRoomId?.trim() ?? ''
  const inviteKey = project.meta.collaborationInviteKey?.trim() ?? ''
  if (mode !== 'webrtc' && mode !== 'lan') {
    return false
  }
  try {
    assertCollaborationIdentifiers(mode, roomId, inviteKey)
    if (mode === 'lan') {
      const serverUrl = project.meta.collaborationLanServerUrl?.trim() ?? ''
      if (
        project.meta.collaborationLanProtocolVersion !== 2 ||
        !serverUrl
      ) {
        return false
      }
      assertLanServerUrl(serverUrl)
    }
    return true
  } catch {
    return false
  }
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
