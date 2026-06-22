import * as Y from 'yjs'
import { desktopBridge } from '../desktop/desktopBridge'
import type {
  LanTransportEvent,
  LanTransportOpenOptions,
  LanTransportOpenResult,
  OperationResult,
} from '../desktop/types'

type LanProviderStatus = 'connected' | 'connecting' | 'disconnected'
type StatusListener = (event: { status: LanProviderStatus }) => void

interface EncryptedEnvelope {
  type: 'state' | 'update'
  version: 2
  iv: string
  ciphertext: string
}

interface SyncRequestMessage {
  type: 'sync-request'
  version: 2
}

export interface LanTransportClient {
  openLanTransport(
    options: LanTransportOpenOptions,
    onEvent: (event: LanTransportEvent) => void,
  ): Promise<LanTransportOpenResult>
  sendLanTransport(sessionId: string, payload: string): Promise<OperationResult>
  closeLanTransport(sessionId: string): Promise<OperationResult>
}

interface EncryptedLanProviderOptions {
  roomId: string
  serverUrl: string
  ydoc: Y.Doc
  inviteCode: string
  publishInitialState: boolean
  transportClient?: LanTransportClient
}

export interface LanSessionKeys {
  encryptionKey: CryptoKey
  authKey: string
}

const textEncoder = new TextEncoder()
const LAN_PROTOCOL_VERSION = 2

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return btoa(binary)
}

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

const bytesToBase64Url = (bytes: Uint8Array): string =>
  bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const base64UrlToBytes = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  return base64ToBytes(`${normalized}${padding}`)
}

const normalizeServerUrl = (serverUrl: string): string =>
  serverUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:').replace(/\/+$/, '')

const encryptionAdditionalData = (
  roomId: string,
  type: EncryptedEnvelope['type'],
): ArrayBuffer =>
  toArrayBuffer(textEncoder.encode(`masterscript-lan-v2:${roomId}:${type}`))

export const parseInviteCode = (
  value: string,
): { secret: string; salt: string; secretBytes: Uint8Array; saltBytes: Uint8Array } => {
  const [secret, salt, extra] = value.trim().split('.')
  if (!secret || !salt || extra) {
    throw new Error(
      'This LAN invite uses an older security protocol. Ask the host to generate a new invite.',
    )
  }

  let secretBytes: Uint8Array
  let saltBytes: Uint8Array
  try {
    secretBytes = base64UrlToBytes(secret)
    saltBytes = base64UrlToBytes(salt)
  } catch {
    throw new Error('LAN invite key is invalid.')
  }
  if (secretBytes.byteLength !== 32 || saltBytes.byteLength !== 16) {
    throw new Error(
      'This LAN invite uses an older security protocol. Ask the host to generate a new invite.',
    )
  }
  return { secret, salt, secretBytes, saltBytes }
}

export const deriveLanSessionKeys = async (
  inviteCode: string,
  roomId: string,
): Promise<LanSessionKeys> => {
  const { secretBytes, saltBytes } = parseInviteCode(inviteCode)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(secretBytes),
    'HKDF',
    false,
    ['deriveKey', 'deriveBits'],
  )
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(saltBytes),
      info: toArrayBuffer(
        textEncoder.encode(`masterscript-lan-v2-encryption:${roomId}`),
      ),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  const authBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(saltBytes),
      info: toArrayBuffer(
        textEncoder.encode(`masterscript-lan-v2-authentication:${roomId}`),
      ),
    },
    keyMaterial,
    256,
  )

  return {
    encryptionKey,
    authKey: bytesToBase64Url(new Uint8Array(authBits)),
  }
}

const encryptUpdate = async (
  key: CryptoKey,
  roomId: string,
  update: Uint8Array,
  type: EncryptedEnvelope['type'],
): Promise<EncryptedEnvelope> => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: encryptionAdditionalData(roomId, type),
    },
    key,
    toArrayBuffer(update),
  )
  return {
    type,
    version: LAN_PROTOCOL_VERSION,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

const decryptUpdate = async (
  key: CryptoKey,
  roomId: string,
  envelope: EncryptedEnvelope,
): Promise<Uint8Array> => {
  const iv = base64ToBytes(envelope.iv)
  const ciphertext = base64ToBytes(envelope.ciphertext)
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: encryptionAdditionalData(roomId, envelope.type),
    },
    key,
    toArrayBuffer(ciphertext),
  )
  return new Uint8Array(plaintext)
}

const isSyncRequest = (value: unknown): value is SyncRequestMessage =>
  typeof value === 'object' &&
  value !== null &&
  (value as Record<string, unknown>).type === 'sync-request' &&
  (value as Record<string, unknown>).version === LAN_PROTOCOL_VERSION

const isEncryptedEnvelope = (value: unknown): value is EncryptedEnvelope =>
  typeof value === 'object' &&
  value !== null &&
  ((value as Record<string, unknown>).type === 'state' ||
    (value as Record<string, unknown>).type === 'update') &&
  (value as Record<string, unknown>).version === LAN_PROTOCOL_VERSION &&
  typeof (value as Record<string, unknown>).iv === 'string' &&
  typeof (value as Record<string, unknown>).ciphertext === 'string'

export class EncryptedLanProvider {
  readonly roomId: string
  readonly serverUrl: string
  readonly ydoc: Y.Doc

  private readonly publishInitialState: boolean
  private readonly transportClient: LanTransportClient
  private readonly listeners = new Set<StatusListener>()
  private key: CryptoKey | null = null
  private authKey: string | null = null
  private sessionId: string | null = null
  private shouldConnect = true
  private reconnectTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  private status: LanProviderStatus = 'connecting'

  constructor(options: EncryptedLanProviderOptions) {
    this.roomId = options.roomId
    this.serverUrl = normalizeServerUrl(options.serverUrl)
    this.ydoc = options.ydoc
    this.publishInitialState = options.publishInitialState
    this.transportClient = options.transportClient ?? desktopBridge

    void deriveLanSessionKeys(options.inviteCode, options.roomId)
      .then(({ encryptionKey, authKey }) => {
        this.key = encryptionKey
        this.authKey = authKey
        return this.connect()
      })
      .catch(() => this.setStatus('disconnected'))

    this.ydoc.on('update', this.onDocumentUpdate)
  }

  on(event: 'status', listener: StatusListener) {
    if (event === 'status') {
      this.listeners.add(listener)
    }
  }

  off(event: 'status', listener: StatusListener) {
    if (event === 'status') {
      this.listeners.delete(listener)
    }
  }

  disconnect() {
    this.shouldConnect = false
    if (this.reconnectTimer !== null) {
      globalThis.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    const sessionId = this.sessionId
    this.sessionId = null
    if (sessionId) {
      void this.transportClient.closeLanTransport(sessionId)
    }
    this.setStatus('disconnected')
  }

  destroy() {
    this.disconnect()
    this.ydoc.off('update', this.onDocumentUpdate)
    this.listeners.clear()
  }

  private async connect() {
    if (!this.shouldConnect || !this.key || !this.authKey || this.sessionId) {
      return
    }

    this.setStatus('connecting')
    const result = await this.transportClient.openLanTransport(
      {
        serverUrl: this.serverUrl,
        roomId: this.roomId,
        authKey: this.authKey,
      },
      this.onTransportEvent,
    )
    if (!this.shouldConnect) {
      if (result.sessionId) {
        await this.transportClient.closeLanTransport(result.sessionId)
      }
      return
    }
    if (!result.ok || !result.sessionId) {
      this.setStatus('disconnected')
      this.scheduleReconnect()
      return
    }

    this.sessionId = result.sessionId
    this.setStatus('connected')
    if (this.publishInitialState) {
      await this.sendState()
    }
  }

  private scheduleReconnect() {
    if (!this.shouldConnect || this.reconnectTimer !== null) {
      return
    }
    this.reconnectTimer = globalThis.setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, 1000)
  }

  private handleTransportFailure() {
    const sessionId = this.sessionId
    this.sessionId = null
    if (sessionId) {
      void this.transportClient.closeLanTransport(sessionId)
    }
    this.setStatus('disconnected')
    this.scheduleReconnect()
  }

  private onTransportEvent = (event: LanTransportEvent) => {
    if (event.eventType === 'message' && typeof event.payload === 'string') {
      void this.handleMessage(event.payload)
      return
    }
    if (event.eventType === 'disconnected') {
      this.handleTransportFailure()
    }
  }

  private setStatus(status: LanProviderStatus) {
    this.status = status
    for (const listener of this.listeners) {
      listener({ status })
    }
  }

  private async sendEnvelope(envelope: EncryptedEnvelope) {
    const sessionId = this.sessionId
    if (!sessionId) {
      return
    }
    const result = await this.transportClient.sendLanTransport(
      sessionId,
      JSON.stringify(envelope),
    )
    if (!result.ok) {
      this.handleTransportFailure()
    }
  }

  private async sendState() {
    if (!this.key) {
      return
    }

    const update = Y.encodeStateAsUpdate(this.ydoc)
    await this.sendEnvelope(
      await encryptUpdate(this.key, this.roomId, update, 'state'),
    )
  }

  private onDocumentUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || !this.key) {
      return
    }

    void encryptUpdate(this.key, this.roomId, update, 'update').then((envelope) =>
      this.sendEnvelope(envelope),
    )
  }

  private async handleMessage(data: string) {
    let parsed: unknown
    try {
      parsed = JSON.parse(data) as unknown
    } catch {
      return
    }

    if (isSyncRequest(parsed)) {
      await this.sendState()
      return
    }

    if (!isEncryptedEnvelope(parsed) || !this.key) {
      return
    }

    try {
      const update = await decryptUpdate(this.key, this.roomId, parsed)
      Y.applyUpdate(this.ydoc, update, this)
    } catch {
      this.handleTransportFailure()
    }
  }

  get currentStatus(): LanProviderStatus {
    return this.status
  }
}

export const createLanRoomId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return `ms2-${bytesToBase64Url(bytes)}`
}

export const createInviteCode = (): {
  secret: string
  salt: string
  secretBytes: Uint8Array
  saltBytes: Uint8Array
  inviteCode: string
} => {
  const secretBytes = crypto.getRandomValues(new Uint8Array(32))
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const secret = bytesToBase64Url(secretBytes)
  const salt = bytesToBase64Url(saltBytes)
  return {
    secret,
    salt,
    secretBytes,
    saltBytes,
    inviteCode: `${secret}.${salt}`,
  }
}
