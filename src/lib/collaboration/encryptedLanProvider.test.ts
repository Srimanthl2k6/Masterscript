import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createBenchmarkProject } from '../benchmarkFixtures'
import {
  hasRenderableProject,
  scriptProjectToYDoc,
  yDocToScriptProject,
} from './projectYjs'
import {
  EncryptedLanProvider,
  type LanTransportClient,
  createInviteCode,
  createLanRoomId,
  deriveLanSessionKeys,
} from './encryptedLanProvider'
import type {
  LanTransportEvent,
  LanTransportOpenOptions,
  LanTransportOpenResult,
  OperationResult,
} from '../desktop/types'

class InMemoryRustTransport implements LanTransportClient {
  readonly closedSessions: string[] = []
  private readonly transformPayload: (payload: string) => string
  private nextSession = 0
  private readonly sessions = new Map<
    string,
    { options: LanTransportOpenOptions; onEvent: (event: LanTransportEvent) => void }
  >()

  constructor(
    transformPayload: (payload: string) => string = (payload) => payload,
  ) {
    this.transformPayload = transformPayload
  }

  async openLanTransport(
    options: LanTransportOpenOptions,
    onEvent: (event: LanTransportEvent) => void,
  ): Promise<LanTransportOpenResult> {
    this.nextSession += 1
    const sessionId = `session-${this.nextSession}`
    this.sessions.set(sessionId, { options, onEvent })
    return { ok: true, sessionId }
  }

  async sendLanTransport(
    sessionId: string,
    payload: string,
  ): Promise<OperationResult> {
    const source = this.sessions.get(sessionId)
    if (!source) {
      return { ok: false, error: 'missing session' }
    }
    for (const [targetId, target] of this.sessions) {
      if (
        targetId !== sessionId &&
        target.options.roomId === source.options.roomId &&
        target.options.authKey === source.options.authKey
      ) {
        target.onEvent({
          eventType: 'message',
          payload: this.transformPayload(payload),
        })
      }
    }
    return { ok: true }
  }

  async closeLanTransport(sessionId: string): Promise<OperationResult> {
    this.closedSessions.push(sessionId)
    this.sessions.delete(sessionId)
    return { ok: true }
  }
}

const waitUntil = async (predicate: () => boolean, timeoutMs = 5_000) => {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for LAN synchronization')
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 10))
  }
}

describe('LAN collaboration protocol v2', () => {
  it('creates 128-bit room IDs and 256-bit invite secrets', () => {
    const roomId = createLanRoomId()
    const invite = createInviteCode()

    expect(roomId).toMatch(/^ms2-[A-Za-z0-9_-]{22}$/)
    expect(invite.secretBytes).toHaveLength(32)
    expect(invite.saltBytes).toHaveLength(16)
    expect(invite.inviteCode).not.toContain('=')
  })

  it('derives separate deterministic encryption and authentication keys', async () => {
    const invite = createInviteCode()
    const first = await deriveLanSessionKeys(invite.inviteCode, 'ms2-room-a')
    const repeated = await deriveLanSessionKeys(invite.inviteCode, 'ms2-room-a')
    const otherRoom = await deriveLanSessionKeys(invite.inviteCode, 'ms2-room-b')

    expect(first.authKey).toBe(repeated.authKey)
    expect(first.authKey).not.toBe(otherRoom.authKey)
    expect(first.authKey).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(first.encryptionKey).toBeInstanceOf(CryptoKey)
  })

  it('does not create browser-managed WebSockets', () => {
    const source = readFileSync(
      'src/lib/collaboration/encryptedLanProvider.ts',
      'utf8',
    )

    expect(source).not.toContain('new WebSocket(')
    expect(source).toContain('openLanTransport')
    expect(source).toContain('sendLanTransport')
    expect(source).toContain('closeLanTransport')
  })

  it('synchronizes a 200-page screenplay through the Rust transport boundary', async () => {
    const project = createBenchmarkProject(200)
    const roomId = createLanRoomId()
    const inviteCode = createInviteCode().inviteCode
    const transportClient = new InMemoryRustTransport()
    const guestDoc = new Y.Doc()
    const hostDoc = scriptProjectToYDoc(project)
    const guest = new EncryptedLanProvider({
      roomId,
      serverUrl: 'ws://127.0.0.1:3210',
      ydoc: guestDoc,
      inviteCode,
      publishInitialState: false,
      transportClient,
    })
    const host = new EncryptedLanProvider({
      roomId,
      serverUrl: 'ws://127.0.0.1:3210',
      ydoc: hostDoc,
      inviteCode,
      publishInitialState: true,
      transportClient,
    })

    await waitUntil(() => hasRenderableProject(guestDoc), 15_000)
    const synchronized = yDocToScriptProject(guestDoc)

    expect(synchronized.blocks).toEqual(project.blocks)
    expect(synchronized.meta.title).toBe(project.meta.title)

    host.destroy()
    guest.destroy()
    hostDoc.destroy()
    guestDoc.destroy()
  }, 20_000)

  it('closes the Rust transport when authenticated envelope metadata is tampered', async () => {
    const project = createBenchmarkProject(1)
    const roomId = createLanRoomId()
    const inviteCode = createInviteCode().inviteCode
    const transportClient = new InMemoryRustTransport((payload) => {
      const envelope = JSON.parse(payload) as Record<string, unknown>
      if (envelope.type === 'state') {
        envelope.type = 'update'
      }
      return JSON.stringify(envelope)
    })
    const guestDoc = new Y.Doc()
    const hostDoc = scriptProjectToYDoc(project)
    const guest = new EncryptedLanProvider({
      roomId,
      serverUrl: 'ws://127.0.0.1:3210',
      ydoc: guestDoc,
      inviteCode,
      publishInitialState: false,
      transportClient,
    })
    const host = new EncryptedLanProvider({
      roomId,
      serverUrl: 'ws://127.0.0.1:3210',
      ydoc: hostDoc,
      inviteCode,
      publishInitialState: true,
      transportClient,
    })

    await waitUntil(() => guest.currentStatus === 'disconnected')

    expect(hasRenderableProject(guestDoc)).toBe(false)
    expect(transportClient.closedSessions).not.toHaveLength(0)

    host.destroy()
    guest.destroy()
    hostDoc.destroy()
    guestDoc.destroy()
  })
})
