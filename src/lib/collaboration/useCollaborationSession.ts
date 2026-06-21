import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import { waitForRenderableProject } from './bootstrapCollaboration'
import {
  applyCollaborationMeta,
  parseCollaborationInvite,
  type CollaborationInviteDetails,
  type CollaborationProjectMode,
} from './collaborationInvite'
import { DEFAULT_RTC_CONFIGURATION, DEFAULT_SIGNALING_SERVERS } from './collaborationConfig'
import {
  EncryptedLanProvider,
  createInviteCode,
  parseInviteCode,
} from './encryptedLanProvider'
import {
  LOCAL_ORIGIN,
  applyProjectToYDoc,
  hasRenderableProject,
  scriptProjectToYDoc,
  yDocToScriptProject,
} from './projectYjs'
import type { ScriptProject } from '../../types/screenplay'
import { desktopBridge } from '../desktop/desktopBridge'

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

export interface CollaborationStartResult {
  sessionInfo: CollaborationSessionInfo
  project: ScriptProject
}

export type CollaborationBootstrapResult = CollaborationStartResult

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
  onLocalProjectUpdated?: (project: ScriptProject) => void
  autosaveProject: (project: ScriptProject) => Promise<void>
}

interface CollaborationStartOptions {
  background?: boolean
}

interface BootstrapOptions {
  signal?: AbortSignal
  timeoutMs?: number
  onStatus?: (message: string) => void
}

interface StopOptions {
  flush?: boolean
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

const collaborationMetaMatches = (
  project: ScriptProject,
  details: CollaborationInviteDetails,
): boolean =>
  project.meta.collaborationMode === details.mode &&
  project.meta.collaborationRoomId === details.roomId &&
  project.meta.collaborationInviteKey === details.inviteKey &&
  (details.mode === 'webrtc' ||
    project.meta.collaborationLanServerUrl === details.lanServerUrl)

const resolveCollaborationDetails = (
  project: ScriptProject,
  mode: CollaborationProjectMode,
  explicit: Partial<CollaborationInviteDetails> = {},
): { details: CollaborationInviteDetails; project: ScriptProject } => {
  const roomId =
    explicit.roomId?.trim() ||
    project.meta.collaborationRoomId?.trim() ||
    createRoomId(project)
  const inviteKey =
    explicit.inviteKey?.trim() ||
    project.meta.collaborationInviteKey?.trim() ||
    createInviteCode().inviteCode
  const lanServerUrl =
    explicit.lanServerUrl?.trim() || project.meta.collaborationLanServerUrl?.trim()
  const details: CollaborationInviteDetails =
    mode === 'lan'
      ? {
          mode,
          roomId,
          inviteKey,
          lanServerUrl,
        }
      : {
          mode,
          roomId,
          inviteKey,
        }

  return {
    details,
    project: collaborationMetaMatches(project, details)
      ? project
      : applyCollaborationMeta(project, details),
  }
}

const providerServerUrl = (details: CollaborationInviteDetails): string =>
  details.mode === 'lan'
    ? details.lanServerUrl ?? ''
    : DEFAULT_SIGNALING_SERVERS.join(', ')

const createSessionInfo = (
  mode: CollaborationMode,
  details: CollaborationInviteDetails,
  hostUrls: string[] = [],
): CollaborationSessionInfo => ({
  mode,
  roomId: details.roomId,
  serverUrl: providerServerUrl(details),
  hostUrls: hostUrls.length > 0 ? hostUrls : [providerServerUrl(details)].filter(Boolean),
  inviteCode: details.inviteKey,
})

export const useCollaborationSession = ({
  onRemoteProject,
  onLocalProjectUpdated,
  autosaveProject,
}: UseCollaborationSessionOptions) => {
  const [status, setStatus] = useState<CollaborationStatus>('offline')
  const [sessionInfo, setSessionInfo] = useState<CollaborationSessionInfo | null>(null)
  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<Provider | null>(null)
  const persistenceRef = useRef<IndexeddbPersistence | null>(null)
  const documentCleanupRef = useRef<(() => void) | null>(null)
  const remoteUpdatesPausedRef = useRef(false)
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
    documentCleanupRef.current?.()
    documentCleanupRef.current = null
  }, [])

  const stop = useCallback(
    async (options: StopOptions = {}) => {
      const shouldFlush = options.flush ?? true
      if (shouldFlush) {
        await flushAutosave()
      }
      await destroyProvider()
      if (sessionInfo?.mode === 'lan-host' && desktopBridge.runtime !== 'web') {
        await desktopBridge.stopLanCollaboration()
      }
      ydocRef.current?.destroy()
      ydocRef.current = null
      remoteUpdatesPausedRef.current = false
      setSessionInfo(null)
      setStatus('offline')
    },
    [destroyProvider, flushAutosave, sessionInfo?.mode],
  )

  const attachDocument = useCallback(
    async (
      ydoc: Y.Doc,
      roomId: string,
      options: { pauseRemoteUpdates?: boolean } = {},
    ) => {
      documentCleanupRef.current?.()
      documentCleanupRef.current = null
      remoteUpdatesPausedRef.current = Boolean(options.pauseRemoteUpdates)
      ydocRef.current = ydoc
      const persistence = new IndexeddbPersistence(`masterscript-collab-${roomId}`, ydoc)
      persistenceRef.current = persistence
      await persistence.whenSynced

      const onUpdate = (_update: Uint8Array, origin: unknown) => {
        if (
          remoteUpdatesPausedRef.current ||
          origin === LOCAL_ORIGIN ||
          !hasRenderableProject(ydoc)
        ) {
          return
        }

        onRemoteProject(yDocToScriptProject(ydoc))
      }

      ydoc.on('update', onUpdate)
      documentCleanupRef.current = () => ydoc.off('update', onUpdate)
    },
    [onRemoteProject],
  )

  const bindProviderStatus = useCallback(
    (provider: Provider, hosting: boolean) => {
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
        if (!remoteUpdatesPausedRef.current) {
          void flushAutosave()
        }
      }

      provider.on?.('status', onStatus)
      return () => provider.off?.('status', onStatus)
    },
    [flushAutosave],
  )

  const persistResolvedProject = useCallback(
    async (project: ScriptProject) => {
      lastProjectRef.current = project
      onLocalProjectUpdated?.(project)
      await autosaveProject(project)
    },
    [autosaveProject, onLocalProjectUpdated],
  )

  const startLanHost = useCallback(
    async (
      project: ScriptProject,
      options: CollaborationStartOptions = {},
    ): Promise<CollaborationStartResult> => {
      void options
      if (desktopBridge.runtime === 'web') {
        throw new Error('LAN hosting is available only in the desktop app.')
      }

      await stop()
      const initial = resolveCollaborationDetails(project, 'lan')
      const hostResult = (await desktopBridge.hostLanCollaboration({
        roomId: initial.details.roomId,
      })) as LanHostResult
      if (!hostResult.ok || !hostResult.primaryHostUrl || !hostResult.roomId) {
        throw new Error(hostResult.error ?? 'Could not start LAN collaboration host.')
      }

      const details: CollaborationInviteDetails = {
        mode: 'lan',
        roomId: hostResult.roomId,
        inviteKey: initial.details.inviteKey,
        lanServerUrl: hostResult.primaryHostUrl,
      }
      const updatedProject = collaborationMetaMatches(initial.project, details)
        ? initial.project
        : applyCollaborationMeta(initial.project, details)
      await persistResolvedProject(updatedProject)

      const { secret, salt } = parseInviteCode(details.inviteKey)
      const ydoc = scriptProjectToYDoc(updatedProject)
      await attachDocument(ydoc, details.roomId)
      const provider = new EncryptedLanProvider({
        roomId: details.roomId,
        serverUrl: details.lanServerUrl ?? hostResult.primaryHostUrl,
        ydoc,
        secret,
        salt,
        publishInitialState: true,
      })
      providerRef.current = provider
      bindProviderStatus(provider, true)

      const sessionInfo = createSessionInfo(
        'lan-host',
        details,
        hostResult.hostUrls ?? [hostResult.primaryHostUrl],
      )
      setSessionInfo(sessionInfo)
      setStatus('hosting')
      return { sessionInfo, project: updatedProject }
    },
    [attachDocument, bindProviderStatus, persistResolvedProject, stop],
  )

  const joinLan = useCallback(
    async (
      project: ScriptProject,
      serverUrl: string,
      roomId: string,
      inviteCode: string,
      options: CollaborationStartOptions = {},
    ): Promise<CollaborationStartResult> => {
      void options
      await stop()
      const normalizedRoomId = roomId.trim()
      const normalizedServerUrl = serverUrl.trim()
      if (!normalizedRoomId || !normalizedServerUrl) {
        throw new Error('LAN server URL and room ID are required.')
      }

      if (desktopBridge.runtime !== 'web') {
        const result = await desktopBridge.joinLanCollaboration({
          serverUrl: normalizedServerUrl,
          roomId: normalizedRoomId,
        })
        if (!result.ok) {
          throw new Error(result.error ?? 'LAN collaboration join details were invalid.')
        }
      }

      const resolved = resolveCollaborationDetails(project, 'lan', {
        mode: 'lan',
        roomId: normalizedRoomId,
        inviteKey: inviteCode,
        lanServerUrl: normalizedServerUrl,
      })
      const details = resolved.details
      const updatedProject = resolved.project
      await persistResolvedProject(updatedProject)

      const { secret, salt } = parseInviteCode(details.inviteKey)
      const ydoc = scriptProjectToYDoc(updatedProject)
      await attachDocument(ydoc, details.roomId)
      const provider = new EncryptedLanProvider({
        roomId: details.roomId,
        serverUrl: normalizedServerUrl,
        ydoc,
        secret,
        salt,
        publishInitialState: false,
      })
      providerRef.current = provider
      bindProviderStatus(provider, false)

      const sessionInfo = createSessionInfo('lan-join', details, [normalizedServerUrl])
      setSessionInfo(sessionInfo)
      setStatus('reconnecting')
      return { sessionInfo, project: updatedProject }
    },
    [attachDocument, bindProviderStatus, persistResolvedProject, stop],
  )

  const startWebRtc = useCallback(
    async (
      project: ScriptProject,
      roomId?: string,
      inviteCode?: string,
      options: CollaborationStartOptions = {},
    ): Promise<CollaborationStartResult> => {
      void options
      await stop()
      const resolved = resolveCollaborationDetails(project, 'webrtc', {
        mode: 'webrtc',
        roomId,
        inviteKey: inviteCode,
      })
      await persistResolvedProject(resolved.project)

      const ydoc = scriptProjectToYDoc(resolved.project)
      await attachDocument(ydoc, resolved.details.roomId)
      const provider = new WebrtcProvider(resolved.details.roomId, ydoc, {
        signaling: DEFAULT_SIGNALING_SERVERS,
        password: resolved.details.inviteKey,
        peerOpts: { config: DEFAULT_RTC_CONFIGURATION },
      })
      providerRef.current = provider
      bindProviderStatus(provider, false)

      const sessionInfo = createSessionInfo('webrtc', resolved.details, DEFAULT_SIGNALING_SERVERS)
      setSessionInfo(sessionInfo)
      setStatus('connected')
      return { sessionInfo, project: resolved.project }
    },
    [attachDocument, bindProviderStatus, persistResolvedProject, stop],
  )

  const bootstrapFromInvite = useCallback(
    async (
      invite: string,
      options: BootstrapOptions = {},
    ): Promise<CollaborationBootstrapResult> => {
      await stop({ flush: false })
      options.onStatus?.('Bootstrapping collaboration project...')
      const details = parseCollaborationInvite(invite)
      const ydoc = new Y.Doc()
      await attachDocument(ydoc, details.roomId, { pauseRemoteUpdates: true })

      let provider: Provider
      if (details.mode === 'lan') {
        if (!details.lanServerUrl) {
          throw new Error('LAN invite is missing a server URL')
        }
        const { secret, salt } = parseInviteCode(details.inviteKey)
        provider = new EncryptedLanProvider({
          roomId: details.roomId,
          serverUrl: details.lanServerUrl,
          ydoc,
          secret,
          salt,
          publishInitialState: false,
        })
      } else {
        provider = new WebrtcProvider(details.roomId, ydoc, {
          signaling: DEFAULT_SIGNALING_SERVERS,
          password: details.inviteKey,
          peerOpts: { config: DEFAULT_RTC_CONFIGURATION },
        })
      }

      providerRef.current = provider
      bindProviderStatus(provider, false)
      const sessionInfo = createSessionInfo(
        details.mode === 'lan' ? 'lan-join' : 'webrtc',
        details,
        details.mode === 'lan' && details.lanServerUrl
          ? [details.lanServerUrl]
          : DEFAULT_SIGNALING_SERVERS,
      )
      setSessionInfo(sessionInfo)
      setStatus('reconnecting')
      options.onStatus?.('Waiting for host or peer...')

      try {
        await waitForRenderableProject(ydoc, {
          signal: options.signal,
          timeoutMs: options.timeoutMs,
        })
      } catch (error) {
        await destroyProvider()
        ydoc.destroy()
        if (ydocRef.current === ydoc) {
          ydocRef.current = null
        }
        remoteUpdatesPausedRef.current = false
        setSessionInfo(null)
        setStatus('offline')
        throw error
      }

      const project = applyCollaborationMeta(yDocToScriptProject(ydoc), details)
      return { sessionInfo, project }
    },
    [attachDocument, bindProviderStatus, destroyProvider, stop],
  )

  const finishBootstrap = useCallback(
    async (project: ScriptProject) => {
      const ydoc = ydocRef.current
      if (!ydoc) {
        return
      }

      lastProjectRef.current = project
      applyProjectToYDoc(ydoc, project, LOCAL_ORIGIN)
      remoteUpdatesPausedRef.current = false
      await autosaveProject(project)
    },
    [autosaveProject],
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
      bootstrapFromInvite,
      finishBootstrap,
      stop,
      syncProject,
      flushAutosave,
    }),
    [
      bootstrapFromInvite,
      finishBootstrap,
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
