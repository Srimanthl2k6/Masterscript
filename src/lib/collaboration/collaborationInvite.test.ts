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
    const roomId = 'ms2-AAAAAAAAAAAAAAAAAAAAAA'
    const inviteKey =
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA'
    const invite = buildCollaborationInvite({
      mode: 'lan',
      roomId,
      inviteKey,
      lanServerUrl: 'ws://192.168.1.12:3210',
      protocolVersion: 2,
    })

    expect(invite).toBe(
      `masterscript://collab?mode=lan&room=${roomId}&key=${inviteKey}&v=2&server=ws%3A%2F%2F192.168.1.12%3A3210`,
    )
    expect(parseCollaborationInvite(invite)).toEqual({
      mode: 'lan',
      roomId,
      inviteKey,
      lanServerUrl: 'ws://192.168.1.12:3210',
      protocolVersion: 2,
    })
  })

  it('rejects malformed invites with readable errors', () => {
    const lanRoom = 'ms2-AAAAAAAAAAAAAAAAAAAAAA'
    const lanKey =
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA'
    expect(() => parseCollaborationInvite('not an invite')).toThrow('Invite must start with masterscript://collab')
    expect(() => parseCollaborationInvite('masterscript://collab?mode=webrtc&key=secret')).toThrow('Invite is missing a room ID')
    expect(() => parseCollaborationInvite('masterscript://collab?mode=webrtc&room=room')).toThrow('Invite is missing an invite key')
    expect(() => parseCollaborationInvite('masterscript://collab?mode=cloud&room=room&key=secret')).toThrow('Invite mode is not supported')
    expect(() => parseCollaborationInvite(`masterscript://collab?mode=lan&room=${lanRoom}&key=${lanKey}&v=2&server=https%3A%2F%2Fexample.com`)).toThrow('LAN invite server must use ws:// or wss://')
    expect(() => parseCollaborationInvite(`masterscript://collab?mode=lan&room=${lanRoom}&key=${lanKey}&server=ws%3A%2F%2F127.0.0.1`)).toThrow(
      'This LAN invite uses an older security protocol. Ask the host to generate a new invite.',
    )
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

  it('requires protocol v2 metadata for persisted LAN sessions', () => {
    const project = createEmptyProject()
    const legacy = {
      ...project,
      meta: {
        ...project.meta,
        collaborationMode: 'lan' as const,
        collaborationRoomId: 'ms2-AAAAAAAAAAAAAAAAAAAAAA',
        collaborationInviteKey:
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA',
        collaborationLanServerUrl: 'ws://127.0.0.1:3210',
      },
    }
    const current = {
      ...legacy,
      meta: {
        ...legacy.meta,
        collaborationLanProtocolVersion: 2 as const,
      },
    }

    expect(hasCollaborationMeta(legacy)).toBe(false)
    expect(hasCollaborationMeta(current)).toBe(true)
  })

  it('rejects oversized and malformed collaboration identifiers', () => {
    expect(() =>
      buildCollaborationInvite({
        mode: 'webrtc',
        roomId: 'x'.repeat(257),
        inviteKey: 'secret',
      }),
    ).toThrow(/room ID/i)
    expect(() =>
      buildCollaborationInvite({
        mode: 'lan',
        roomId: 'legacy-room',
        inviteKey: 'secret.salt',
        lanServerUrl: 'ws://127.0.0.1:3210',
        protocolVersion: 2,
      }),
    ).toThrow(/protocol v2 room ID/i)
  })
})
