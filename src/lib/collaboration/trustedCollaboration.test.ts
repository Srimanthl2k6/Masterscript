import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../screenplay'
import { applyCollaborationMeta } from './collaborationInvite'
import {
  isTrustedCollaboration,
  rememberTrustedCollaboration,
} from './trustedCollaboration'

class MemoryStorage {
  values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('trusted collaboration reconnects', () => {
  it('does not trust collaboration metadata merely because it is in a project file', async () => {
    const storage = new MemoryStorage()
    const project = applyCollaborationMeta(createEmptyProject(), {
      mode: 'webrtc',
      roomId: 'room-from-untrusted-file',
      inviteKey: 'attacker-controlled-secret',
    })

    await expect(isTrustedCollaboration(storage, project)).resolves.toBe(false)
  })

  it('trusts only the exact project, room, mode, server, and invite key approved locally', async () => {
    const storage = new MemoryStorage()
    const project = applyCollaborationMeta(createEmptyProject(), {
      mode: 'lan',
      roomId: 'ms2-AAAAAAAAAAAAAAAAAAAAAA',
      inviteKey:
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA',
      lanServerUrl: 'ws://192.168.1.20:3210',
      protocolVersion: 2,
    })

    await rememberTrustedCollaboration(storage, project)

    await expect(isTrustedCollaboration(storage, project)).resolves.toBe(true)
    await expect(
      isTrustedCollaboration(storage, {
        ...project,
        meta: {
          ...project.meta,
          collaborationLanServerUrl: 'ws://192.168.1.21:3210',
        },
      }),
    ).resolves.toBe(false)
  })
})
