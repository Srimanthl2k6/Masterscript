import * as Y from 'yjs'

type LanProviderStatus = 'connected' | 'connecting' | 'disconnected'
type StatusListener = (event: { status: LanProviderStatus }) => void

interface EncryptedEnvelope {
  type: 'state' | 'update'
  version: 1
  iv: string
  ciphertext: string
}

interface SyncRequestMessage {
  type: 'sync-request'
}

interface EncryptedLanProviderOptions {
  roomId: string
  serverUrl: string
  ydoc: Y.Doc
  secret: string
  salt: string
  publishInitialState: boolean
}

const textEncoder = new TextEncoder()

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

const normalizeServerUrl = (serverUrl: string): string =>
  serverUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:').replace(/\/+$/, '')

const deriveAesKey = async (
  secret: string,
  roomId: string,
  salt: string,
): Promise<CryptoKey> => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: textEncoder.encode(`masterscript:${roomId}:${salt}`),
      iterations: 210_000,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

const encryptUpdate = async (
  key: CryptoKey,
  update: Uint8Array,
  type: EncryptedEnvelope['type'],
): Promise<EncryptedEnvelope> => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(update),
  )
  return {
    type,
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

const decryptUpdate = async (
  key: CryptoKey,
  envelope: EncryptedEnvelope,
): Promise<Uint8Array> => {
  const iv = base64ToBytes(envelope.iv)
  const ciphertext = base64ToBytes(envelope.ciphertext)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext),
  )
  return new Uint8Array(plaintext)
}

const isSyncRequest = (value: unknown): value is SyncRequestMessage =>
  typeof value === 'object' &&
  value !== null &&
  (value as Record<string, unknown>).type === 'sync-request'

const isEncryptedEnvelope = (value: unknown): value is EncryptedEnvelope =>
  typeof value === 'object' &&
  value !== null &&
  ((value as Record<string, unknown>).type === 'state' ||
    (value as Record<string, unknown>).type === 'update') &&
  (value as Record<string, unknown>).version === 1 &&
  typeof (value as Record<string, unknown>).iv === 'string' &&
  typeof (value as Record<string, unknown>).ciphertext === 'string'

export class EncryptedLanProvider {
  readonly roomId: string
  readonly serverUrl: string
  readonly ydoc: Y.Doc

  private readonly publishInitialState: boolean
  private readonly listeners = new Set<StatusListener>()
  private key: CryptoKey | null = null
  private ws: WebSocket | null = null
  private shouldConnect = true
  private reconnectTimer: number | null = null
  private status: LanProviderStatus = 'connecting'

  constructor(options: EncryptedLanProviderOptions) {
    this.roomId = options.roomId
    this.serverUrl = normalizeServerUrl(options.serverUrl)
    this.ydoc = options.ydoc
    this.publishInitialState = options.publishInitialState

    void deriveAesKey(options.secret, options.roomId, options.salt)
      .then((key) => {
        this.key = key
        this.connect()
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
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.setStatus('disconnected')
  }

  destroy() {
    this.disconnect()
    this.ydoc.off('update', this.onDocumentUpdate)
    this.listeners.clear()
  }

  private connect() {
    if (!this.shouldConnect || !this.key) {
      return
    }

    this.setStatus('connecting')
    const ws = new WebSocket(`${this.serverUrl}/${encodeURIComponent(this.roomId)}`)
    ws.onopen = () => {
      this.setStatus('connected')
      if (this.publishInitialState) {
        void this.sendState()
      }
    }
    ws.onmessage = (event) => {
      void this.handleMessage(event.data)
    }
    ws.onerror = () => this.setStatus('disconnected')
    ws.onclose = () => {
      this.ws = null
      this.setStatus('disconnected')
      if (this.shouldConnect) {
        this.reconnectTimer = window.setTimeout(() => this.connect(), 1000)
      }
    }
    this.ws = ws
  }

  private setStatus(status: LanProviderStatus) {
    this.status = status
    for (const listener of this.listeners) {
      listener({ status })
    }
  }

  private sendEnvelope(envelope: EncryptedEnvelope) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(envelope))
    }
  }

  private async sendState() {
    if (!this.key) {
      return
    }

    const update = Y.encodeStateAsUpdate(this.ydoc)
    this.sendEnvelope(await encryptUpdate(this.key, update, 'state'))
  }

  private onDocumentUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || !this.key) {
      return
    }

    void encryptUpdate(this.key, update, 'update').then((envelope) => {
      this.sendEnvelope(envelope)
    })
  }

  private async handleMessage(data: unknown) {
    if (typeof data !== 'string') {
      return
    }

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
      const update = await decryptUpdate(this.key, parsed)
      Y.applyUpdate(this.ydoc, update, this)
    } catch {
      this.setStatus('disconnected')
    }
  }

  get currentStatus(): LanProviderStatus {
    return this.status
  }
}

export const createInviteCode = (): { secret: string; salt: string; inviteCode: string } => {
  const secretBytes = crypto.getRandomValues(new Uint8Array(18))
  const saltBytes = crypto.getRandomValues(new Uint8Array(12))
  const secret = bytesToBase64(secretBytes).replace(/[+/=]/g, '').slice(0, 20)
  const salt = bytesToBase64(saltBytes).replace(/[+/=]/g, '').slice(0, 16)
  return {
    secret,
    salt,
    inviteCode: `${secret}.${salt}`,
  }
}

export const parseInviteCode = (value: string): { secret: string; salt: string } => {
  const [secret, salt] = value.trim().split('.', 2)
  return {
    secret: secret || value.trim(),
    salt: salt || 'default',
  }
}
