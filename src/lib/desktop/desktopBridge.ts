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

const unavailableMessage = 'This operation is available only in the desktop app.'

const unavailable = async (): Promise<OperationResult> => ({
  ok: false,
  error: unavailableMessage,
})

const createNonElectronBridge = (runtime: 'web' | 'tauri'): DesktopBridge => ({
  runtime,
  autosave: async () => ({ ok: true }),
  readAutosave: async () => ({ ok: true, project: null }),
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
  stopLanCollaboration: async () => ({ ok: false, error: unavailableMessage }),
  getLanCollaborationStatus: async () => ({
    ok: false,
    running: false,
    error: unavailableMessage,
  }),
  exportMigrationManifest: unavailable,
  getInstallState: async (): Promise<InstallState> => ({
    kind: 'fresh',
    tutorialCompleted: false,
    migrationVersion: null,
  }),
  setTutorialCompleted: async () => undefined,
  bootstrapInstallation: async () => ({
    installState: {
      kind: 'fresh',
      tutorialCompleted: false,
      migrationVersion: null,
    },
    migrationManifest: null,
  }),
})

const createElectronBridge = (api: DesktopNativeApi): DesktopBridge => ({
  runtime: 'electron',
  autosave: (project) => api.autosave(project),
  readAutosave: () => api.readAutosave(),
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
