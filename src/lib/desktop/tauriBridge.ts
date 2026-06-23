import type { ScriptProject } from '../../types/screenplay'
import type {
  BinaryImportResult,
  BootstrapInstallationResult,
  DesktopBridge,
  FontFamilyDescriptor,
  FontLoadResult,
  InstallState,
  LanCollaborationHostOptions,
  LanCollaborationHostResult,
  LanCollaborationJoinOptions,
  LanCollaborationJoinResult,
  LanCollaborationStatusResult,
  LanTransportEvent,
  LanTransportOpenOptions,
  LanTransportOpenResult,
  OpenProjectResult,
  OperationResult,
  TextImportResult,
} from './types'

export type TauriInvoker = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>

export type TauriChannelFactory = <T>(
  onMessage: (message: T) => void,
) => unknown | Promise<unknown>

const createRuntimeChannel: TauriChannelFactory = async <T>(
  onMessage: (message: T) => void,
) => {
  const { Channel } = await import('@tauri-apps/api/core')
  return new Channel<T>(onMessage)
}

export const createTauriDesktopBridge = (
  invoke: TauriInvoker,
  createChannel: TauriChannelFactory = createRuntimeChannel,
): DesktopBridge => ({
  runtime: 'tauri',
  autosave: (project: ScriptProject) =>
    invoke<{ ok: boolean; error?: string }>('project_autosave', { project }),
  readAutosave: () => invoke('project_read_autosave'),
  readRecentProjectSnapshots: () =>
    invoke<Record<string, ScriptProject>>('project_read_recent_snapshots'),
  writeRecentProjectSnapshot: (project) =>
    invoke<OperationResult>('project_write_recent_snapshot', { project }),
  saveProject: (project, title) =>
    invoke<OperationResult>('project_save_file', { project, title }),
  saveProjectRef: (grantId, project) =>
    invoke<OperationResult>('project_save_ref', { grantId, project }),
  openProject: () => invoke<OpenProjectResult>('project_open_file'),
  openProjectRef: (grantId) =>
    invoke<OpenProjectResult>('project_open_ref', { grantId }),
  exportFountain: (title, content) =>
    invoke<OperationResult>('project_export_fountain', { title, content }),
  importFountain: () =>
    invoke<TextImportResult>('project_import_fountain'),
  importFdx: () => invoke<TextImportResult>('project_import_fdx'),
  exportFdx: (title, content) =>
    invoke<OperationResult>('project_export_fdx', { title, content }),
  importDocx: () => invoke<BinaryImportResult>('project_import_docx'),
  exportDocx: (title, base64) =>
    invoke<OperationResult>('project_export_docx', { title, base64 }),
  exportPdf: (title, base64) =>
    invoke<OperationResult>('project_export_pdf', { title, base64 }),
  hostLanCollaboration: (options: LanCollaborationHostOptions) =>
    invoke<LanCollaborationHostResult>('collaboration_lan_host', { options }),
  joinLanCollaboration: (options: LanCollaborationJoinOptions) =>
    invoke<LanCollaborationJoinResult>('collaboration_lan_join', { options }),
  openLanTransport: async (
    options: LanTransportOpenOptions,
    onEvent: (event: LanTransportEvent) => void,
  ) => {
    const onEventChannel = await createChannel(onEvent)
    return invoke<LanTransportOpenResult>('collaboration_lan_transport_open', {
      options,
      onEvent: onEventChannel,
    })
  },
  sendLanTransport: (sessionId, payload) =>
    invoke<OperationResult>('collaboration_lan_transport_send', {
      sessionId,
      payload,
    }),
  closeLanTransport: (sessionId) =>
    invoke<OperationResult>('collaboration_lan_transport_close', { sessionId }),
  stopLanCollaboration: () =>
    invoke<{ ok: boolean; error?: string }>('collaboration_lan_stop'),
  getLanCollaborationStatus: () =>
    invoke<LanCollaborationStatusResult>('collaboration_lan_status'),
  exportMigrationManifest: async () => ({
    ok: false,
    error: 'Migration manifests are exported only by the final Electron bridge.',
  }),
  getInstallState: () =>
    invoke<InstallState>('installation_get_state'),
  setTutorialCompleted: (completed) =>
    invoke<void>('installation_set_tutorial_completed', { completed }),
  bootstrapInstallation: () =>
    invoke<BootstrapInstallationResult>('bootstrap_installation'),
  listInstalledFonts: () =>
    invoke<FontFamilyDescriptor[]>('font_list_installed'),
  loadFontForExport: (family, style) =>
    invoke<FontLoadResult>('font_load_for_export', { family, style }),
})
