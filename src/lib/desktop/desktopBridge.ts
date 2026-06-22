import type { ScriptProject } from '../../types/screenplay'
import type {
  DesktopBridge,
  DesktopNativeApi,
  InstallState,
  MigrationManifestV1,
  OperationResult,
} from './types'
import {
  createTauriDesktopBridge,
  type TauriInvoker,
} from './tauriBridge'
import {
  recentProjectSnapshotsKey,
  tutorialCompletedKey,
} from './storageKeys'

const unavailableMessage = 'This operation is available only in the desktop app.'

const unavailable = async (): Promise<OperationResult> => ({
  ok: false,
  error: unavailableMessage,
})

const readBrowserRecentProjectSnapshots = (): Record<string, ScriptProject> => {
  try {
    const raw = globalThis.localStorage?.getItem(recentProjectSnapshotsKey)
    return raw ? (JSON.parse(raw) as Record<string, ScriptProject>) : {}
  } catch {
    return {}
  }
}

const writeBrowserRecentProjectSnapshot = (
  project: ScriptProject,
): OperationResult => {
  try {
    const snapshots = readBrowserRecentProjectSnapshots()
    const entries = Object.entries({ ...snapshots, [project.id]: project })
      .sort(
        ([, left], [, right]) =>
          Date.parse(right.meta.updatedAt) - Date.parse(left.meta.updatedAt),
      )
      .slice(0, 12)
    globalThis.localStorage?.setItem(
      recentProjectSnapshotsKey,
      JSON.stringify(Object.fromEntries(entries)),
    )
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Snapshot persistence failed',
    }
  }
}

const getBrowserInstallState = (): InstallState => {
  try {
    if (globalThis.localStorage?.getItem(tutorialCompletedKey) === '1') {
      return {
        kind: 'existing-tauri',
        tutorialCompleted: true,
        migrationVersion: null,
      }
    }
  } catch {
    // Treat unavailable browser storage as a fresh transient session.
  }
  return {
    kind: 'fresh',
    tutorialCompleted: false,
    migrationVersion: null,
  }
}

const createNonElectronBridge = (runtime: 'web' | 'tauri'): DesktopBridge => ({
  runtime,
  autosave: async () => ({ ok: true }),
  readAutosave: async () => ({ ok: true, project: null }),
  readRecentProjectSnapshots: async () => readBrowserRecentProjectSnapshots(),
  writeRecentProjectSnapshot: async (project) =>
    writeBrowserRecentProjectSnapshot(project),
  saveProject: unavailable,
  saveProjectPath: unavailable,
  openProject: unavailable,
  openProjectPath: unavailable,
  exportFountain: unavailable,
  importFountain: unavailable,
  importFdx: unavailable,
  exportFdx: unavailable,
  importDocx: unavailable,
  exportDocx: unavailable,
  exportPdf: unavailable,
  hostLanCollaboration: async () => ({ ok: false, error: unavailableMessage }),
  joinLanCollaboration: async () => ({ ok: false, error: unavailableMessage }),
  openLanTransport: async () => ({ ok: false, error: unavailableMessage }),
  sendLanTransport: unavailable,
  closeLanTransport: unavailable,
  stopLanCollaboration: async () => ({ ok: false, error: unavailableMessage }),
  getLanCollaborationStatus: async () => ({
    ok: false,
    running: false,
    error: unavailableMessage,
  }),
  exportMigrationManifest: unavailable,
  getInstallState: async (): Promise<InstallState> => getBrowserInstallState(),
  setTutorialCompleted: async (completed) => {
    try {
      if (completed) {
        globalThis.localStorage?.setItem(tutorialCompletedKey, '1')
      } else {
        globalThis.localStorage?.removeItem(tutorialCompletedKey)
      }
    } catch {
      // Tutorial state remains in memory for this session.
    }
  },
  bootstrapInstallation: async () => ({
    installState: getBrowserInstallState(),
    migrationManifest: null,
  }),
})

const createElectronBridge = (api: DesktopNativeApi): DesktopBridge => ({
  runtime: 'electron',
  autosave: (project) => api.autosave(project),
  readAutosave: () => api.readAutosave(),
  readRecentProjectSnapshots: () =>
    api.readRecentProjectSnapshots?.() ??
    Promise.resolve(readBrowserRecentProjectSnapshots()),
  writeRecentProjectSnapshot: (project) =>
    api.writeRecentProjectSnapshot?.(project) ??
    Promise.resolve(writeBrowserRecentProjectSnapshot(project)),
  saveProject: (project, title) => api.saveProject(project, title),
  saveProjectPath: (filePath, project) => api.saveProjectPath(filePath, project),
  openProject: () => api.openProject(),
  openProjectPath: (filePath) => api.openProjectPath(filePath),
  exportFountain: (title, content) => api.exportFountain(title, content),
  importFountain: () => api.importFountain(),
  importFdx: () => api.importFdx(),
  exportFdx: (title, content) => api.exportFdx(title, content),
  importDocx: () => api.importDocx(),
  exportDocx: (title, base64) => api.exportDocx(title, base64),
  exportPdf: (title, base64) => api.exportPdf(title, base64),
  hostLanCollaboration: (options) => api.hostLanCollaboration(options),
  joinLanCollaboration: (options) => api.joinLanCollaboration(options),
  openLanTransport: async () => ({ ok: false, error: unavailableMessage }),
  sendLanTransport: unavailable,
  closeLanTransport: unavailable,
  stopLanCollaboration: () => api.stopLanCollaboration(),
  getLanCollaborationStatus: () => api.getLanCollaborationStatus(),
  exportMigrationManifest: (manifest: MigrationManifestV1) =>
    api.exportMigrationManifest?.(manifest) ?? unavailable(),
  getInstallState: () =>
    api.getInstallState?.() ??
    Promise.resolve({
      kind: 'legacy-migrated',
      tutorialCompleted: true,
      migrationVersion: 1,
    }),
  setTutorialCompleted: (completed) =>
    api.setTutorialCompleted?.(completed) ?? Promise.resolve(),
  bootstrapInstallation: () =>
    api.bootstrapInstallation?.() ??
    Promise.resolve({
      installState: {
        kind: 'legacy-migrated',
        tutorialCompleted: true,
        migrationVersion: 1,
      },
      migrationManifest: null,
    }),
})

interface DesktopWindow extends Window {
  masterscript?: DesktopNativeApi
  __TAURI_INTERNALS__?: unknown
}

interface CreateDesktopBridgeOptions {
  tauriInvoke?: TauriInvoker
}

const invokeTauri: TauriInvoker = async (command, args) => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(command, args)
}

export const createDesktopBridge = (
  options: CreateDesktopBridgeOptions = {},
): DesktopBridge => {
  const desktopWindow =
    typeof window === 'undefined' ? undefined : (window as DesktopWindow)

  if (desktopWindow?.masterscript?.isElectron) {
    return createElectronBridge(desktopWindow.masterscript)
  }

  if (desktopWindow?.__TAURI_INTERNALS__) {
    return createTauriDesktopBridge(options.tauriInvoke ?? invokeTauri)
  }

  return createNonElectronBridge('web')
}

export const desktopBridge = createDesktopBridge()

export const isDesktopRuntime = (): boolean => desktopBridge.runtime !== 'web'

export type { ScriptProject }
