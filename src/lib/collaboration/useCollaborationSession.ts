import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import { DEFAULT_RTC_CONFIGURATION, DEFAULT_SIGNALING_SERVERS } from './collaborationConfig'
import {
  EncryptedLanProvider,
  createInviteCode,
  parseInviteCode,
} from './encryptedLanProvider'
import {
  LOCAL_ORIGIN,
  applyProjectToYDoc,
  scriptProjectToYDoc,
  yDocToScriptProject,
} from './projectYjs'
import type { ScriptProject } from '../../types/screenplay'

export type CollaborationStatus =
  | 'offline'
  | 'hosting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'

export type CollaborationMode = 'lan-host' | 'lan-join' | 'webrtc'

export interface CollaborationSessionInfo {
  mode: CollaborationMode
  roomId: string
  serverUrl: string
  hostUrls: string[]
  inviteCode: string
}

interface LanHostResult {
  ok: boolean
  roomId?: string
  port?: number
  hostUrls?: string[]
  primaryHostUrl?: string
  error?: string
}

interface UseCollaborationSessionOptions {
  onRemoteProject: (project: ScriptProject) => void
  autosaveProject: (project: ScriptProject) => Promise<void>
}

type Provider =
  | EncryptedLanProvider
  | WebrtcProvider
  | {
      disconnect: () => void
      destroy?: () => void
      on?: (event: string, listener: (event: unknown) => void) => void
      off?: (event: string, listener: (event: unknown) => void) => void
    }

const createRoomId = (project: ScriptProject): string => {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10)
  return `masterscript-${project.id.slice(0, 8)}-${suffix}`
}

const hasRenderableProject = (ydoc: Y.Doc): boolean => {
  const projectMap = ydoc.getMap('project')
  return (
    typeof projectMap.get('id') === 'string' &&
    projectMap.get('meta') instanceof Y.Map &&
    projectMap.get('blocks') instanceof Y.Array
  )
}

export const useCollaborationSession = ({
  onRemoteProject,
  autosaveProject,
}: UseCollaborationSessionOptions) => {
  const [status, setStatus] = useState<CollaborationStatus>('offline')
  const [sessionInfo, setSessionInfo] = useState<CollaborationSessionInfo | null>(null)
  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<Provider | null>(null)
  const persistenceRef = useRef<IndexeddbPersistence | null>(null)
  const lastProjectRef = useRef<ScriptProject | null>(null)

  const flushAutosave = useCallback(async () => {
    const ydoc = ydocRef.current
    if (!ydoc || !hasRenderableProject(ydoc)) {
      return
    }

    await autosaveProject(yDocToScriptProject(ydoc))
  }, [autosaveProject])

  const destroyProvider = useCallback(async () => {
    providerRef.current?.disconnect()
    providerRef.current?.destroy?.()
    providerRef.current = null
    await persistenceRef.current?.destroy()
    persistenceRef.current = null
  }, [])

  const stop = useCallback(async () => {
    await flushAutosave()
    await destroyProvider()
    if (sessionInfo?.mode === 'lan-host' && window.masterscript?.stopLanCollaboration) {
      await window.masterscript.stopLanCollaboration()
    }
    ydocRef.current?.destroy()
    ydocRef.current = null
    setSessionInfo(null)
    setStatus('offline')
  }, [destroyProvider, flushAutosave, sessionInfo?.mode])

  const attachDocument = useCallback(
    async (ydoc: Y.Doc, roomId: string) => {
      ydocRef.current = ydoc
      const persistence = new IndexeddbPersistence(`masterscript-collab-${roomId}`, ydoc)
      persistenceRef.current = persistence
      await persistence.whenSynced

      const onUpdate = (_update: Uint8Array, origin: unknown) => {
        if (origin === LOCAL_ORIGIN || !hasRenderableProject(ydoc)) {
          return
        }

        onRemoteProject(yDocToScriptProject(ydoc))
      }

      ydoc.on('update', onUpdate)
      return () => {
        ydoc.off('update', onUpdate)
      }
    },
    [onRemoteProject],
  )

  const bindProviderStatus = useCallback((provider: Provider, hosting: boolean) => {
    const onStatus = (event: unknown) => {
      if (
        typeof event === 'object' &&
        event !== null &&
        'status' in event &&
        (event as { status?: unknown }).status === 'connecting'
      ) {
        setStatus('reconnecting')
        return
      }

      if (
        typeof event === 'object' &&
        event !== null &&
        'status' in event &&
        (event as { status?: unknown }).status === 'connected'
      ) {
        setStatus(hosting ? 'hosting' : 'connected')
        return
      }

      if (
        typeof event === 'object' &&
        event !== null &&
        'connected' in event &&
        (event as { connected?: unknown }).connected === true
      ) {
        setStatus(hosting ? 'hosting' : 'connected')
        return
      }

      setStatus('disconnected')
      void flushAutosave()
    }

    provider.on?.('status', onStatus)
    return () => provider.off?.('status', onStatus)
  }, [flushAutosave])

  const startLanHost = useCallback(
    async (project: ScriptProject): Promise<CollaborationSessionInfo> => {
      if (!window.masterscript?.hostLanCollaboration) {
        throw new Error('LAN hosting is available only in the Electron desktop app.')
      }

      await stop()
      const roomId = createRoomId(project)
      const hostResult = (await window.masterscript.hostLanCollaboration({
        roomId,
      })) as LanHostResult
      if (!hostResult.ok || !hostResult.primaryHostUrl || !hostResult.roomId) {
        throw new Error(hostResult.error ?? 'Could not start LAN collaboration host.')
      }

      const { secret, salt, inviteCode } = createInviteCode()
      const ydoc = scriptProjectToYDoc(project)
      await attachDocument(ydoc, hostResult.roomId)
      const provider = new EncryptedLanProvider({
        roomId: hostResult.roomId,
        serverUrl: hostResult.primaryHostUrl,
        ydoc,
        secret,
        salt,
        publishInitialState: true,
      })
      providerRef.current = provider
      bindProviderStatus(provider, true)

      const info: CollaborationSessionInfo = {
        mode: 'lan-host',
        roomId: hostResult.roomId,
        serverUrl: hostResult.primaryHostUrl,
        hostUrls: hostResult.hostUrls ?? [hostResult.primaryHostUrl],
        inviteCode,
      }
      setSessionInfo(info)
      setStatus('hosting')
      return info
    },
    [attachDocument, bindProviderStatus, stop],
  )

  const joinLan = useCallback(
    async (
      project: ScriptProject,
      serverUrl: string,
      roomId: string,
      inviteCode: string,
    ): Promise<CollaborationSessionInfo> => {
      await stop()
      const normalizedRoomId = roomId.trim()
      const normalizedServerUrl = serverUrl.trim()
      if (!normalizedRoomId || !normalizedServerUrl) {
        throw new Error('LAN server URL and room ID are required.')
      }

      if (window.masterscript?.joinLanCollaboration) {
        const result = await window.masterscript.joinLanCollaboration({
          serverUrl: normalizedServerUrl,
          roomId: normalizedRoomId,
        })
        if (!result.ok) {
          throw new Error(result.error ?? 'LAN collaboration join details were invalid.')
        }
      }

      const { secret, salt } = parseInviteCode(inviteCode)
      const ydoc = scriptProjectToYDoc(project)
      await attachDocument(ydoc, normalizedRoomId)
      const provider = new EncryptedLanProvider({
        roomId: normalizedRoomId,
        serverUrl: normalizedServerUrl,
        ydoc,
        secret,
        salt,
        publishInitialState: false,
      })
      providerRef.current = provider
      bindProviderStatus(provider, false)

      const info: CollaborationSessionInfo = {
        mode: 'lan-join',
        roomId: normalizedRoomId,
        serverUrl: normalizedServerUrl,
        hostUrls: [normalizedServerUrl],
        inviteCode,
      }
      setSessionInfo(info)
      setStatus('reconnecting')
      return info
    },
    [attachDocument, bindProviderStatus, stop],
  )

  const startWebRtc = useCallback(
    async (
      project: ScriptProject,
      roomId?: string,
      inviteCode?: string,
    ): Promise<CollaborationSessionInfo> => {
      await stop()
      const resolvedRoomId = roomId?.trim() || createRoomId(project)
      const resolvedInviteCode = inviteCode?.trim() || createInviteCode().inviteCode
      const ydoc = scriptProjectToYDoc(project)
      await attachDocument(ydoc, resolvedRoomId)
      const provider = new WebrtcProvider(resolvedRoomId, ydoc, {
        signaling: DEFAULT_SIGNALING_SERVERS,
        password: resolvedInviteCode,
        peerOpts: { config: DEFAULT_RTC_CONFIGURATION },
      })
      providerRef.current = provider
      bindProviderStatus(provider, false)

      const info: CollaborationSessionInfo = {
        mode: 'webrtc',
        roomId: resolvedRoomId,
        serverUrl: DEFAULT_SIGNALING_SERVERS.join(', '),
        hostUrls: DEFAULT_SIGNALING_SERVERS,
        inviteCode: resolvedInviteCode,
      }
      setSessionInfo(info)
      setStatus('connected')
      return info
    },
    [attachDocument, bindProviderStatus, stop],
  )

  const syncProject = useCallback((project: ScriptProject) => {
    lastProjectRef.current = project
    const ydoc = ydocRef.current
    if (!ydoc) {
      return
    }

    applyProjectToYDoc(ydoc, project, LOCAL_ORIGIN)
  }, [])

  useEffect(() => {
    const onBeforeUnload = () => {
      const ydoc = ydocRef.current
      if (!ydoc || !hasRenderableProject(ydoc)) {
        return
      }

      const project = yDocToScriptProject(ydoc)
      void autosaveProject(project)
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      void destroyProvider()
      ydocRef.current?.destroy()
      ydocRef.current = null
    }
  }, [autosaveProject, destroyProvider])

  return useMemo(
    () => ({
      status,
      isActive: status !== 'offline',
      sessionInfo,
      startLanHost,
      joinLan,
      startWebRtc,
      stop,
      syncProject,
      flushAutosave,
    }),
    [
      flushAutosave,
      joinLan,
      sessionInfo,
      startLanHost,
      startWebRtc,
      status,
      stop,
      syncProject,
    ],
  )
}

