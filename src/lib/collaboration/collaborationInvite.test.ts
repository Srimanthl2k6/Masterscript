import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../screenplay'
import {
  applyCollaborationMeta,
  buildCollaborationInvite,
  hasCollaborationMeta,
  parseCollaborationInvite,
} from './collaborationInvite'

describe('collaboration invite helpers', () => {
  it('builds and parses WebRTC invite codes', () => {
    const invite = buildCollaborationInvite({
      mode: 'webrtc',
      roomId: 'masterscript-room',
      inviteKey: 'secret.salt',
    })

    expect(invite).toBe('masterscript://collab?mode=webrtc&room=masterscript-room&key=secret.salt')
    expect(parseCollaborationInvite(invite)).toEqual({
      mode: 'webrtc',
      roomId: 'masterscript-room',
      inviteKey: 'secret.salt',
    })
  })

  it('builds and parses LAN invite codes with encoded server URLs', () => {
    const invite = buildCollaborationInvite({
      mode: 'lan',
      roomId: 'masterscript-room',
      inviteKey: 'secret.salt',
      lanServerUrl: 'ws://192.168.1.12:3210',
    })

    expect(invite).toBe(
      'masterscript://collab?mode=lan&room=masterscript-room&key=secret.salt&server=ws%3A%2F%2F192.168.1.12%3A3210',
    )
    expect(parseCollaborationInvite(invite)).toEqual({
      mode: 'lan',
      roomId: 'masterscript-room',
      inviteKey: 'secret.salt',
      lanServerUrl: 'ws://192.168.1.12:3210',
    })
  })

  it('rejects malformed invites with readable errors', () => {
    expect(() => parseCollaborationInvite('not an invite')).toThrow('Invite must start with masterscript://collab')
    expect(() => parseCollaborationInvite('masterscript://collab?mode=webrtc&key=secret')).toThrow('Invite is missing a room ID')
    expect(() => parseCollaborationInvite('masterscript://collab?mode=webrtc&room=room')).toThrow('Invite is missing an invite key')
    expect(() => parseCollaborationInvite('masterscript://collab?mode=cloud&room=room&key=secret')).toThrow('Invite mode is not supported')
    expect(() => parseCollaborationInvite('masterscript://collab?mode=lan&room=room&key=secret&server=https%3A%2F%2Fexample.com')).toThrow('LAN invite server must use ws:// or wss://')
  })

  it('applies collaboration metadata to a project without mutating the input', () => {
    const project = createEmptyProject()
    const updated = applyCollaborationMeta(project, {
      mode: 'webrtc',
      roomId: 'masterscript-room',
      inviteKey: 'secret.salt',
    })

    expect(hasCollaborationMeta(project)).toBe(false)
    expect(hasCollaborationMeta(updated)).toBe(true)
    expect(updated.meta).toMatchObject({
      collaborationMode: 'webrtc',
      collaborationRoomId: 'masterscript-room',
      collaborationInviteKey: 'secret.salt',
    })
  })
})
