import type { ScriptProject } from '../../types/screenplay'
import type {
  BinaryImportResult,
  BootstrapInstallationResult,
  DesktopBridge,
  InstallState,
  LanCollaborationHostOptions,
  LanCollaborationHostResult,
  LanCollaborationJoinOptions,
  LanCollaborationJoinResult,
  LanCollaborationStatusResult,
  OpenProjectResult,
  OperationResult,
  TextImportResult,
} from './types'

export type TauriInvoker = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>

export const createTauriDesktopBridge = (
  invoke: TauriInvoker,
): DesktopBridge => ({
  runtime: 'tauri',
  autosave: (project: ScriptProject) =>
    invoke<{ ok: boolean; error?: string }>('project_autosave', { project }),
  readAutosave: () => invoke('project_read_autosave'),
  saveProject: (project, title) =>
    invoke<OperationResult>('project_save_file', { project, title }),
  saveProjectPath: (filePath, project) =>
    invoke<OperationResult>('project_save_path', { filePath, project }),
  openProject: () => invoke<OpenProjectResult>('project_open_file'),
  openProjectPath: (filePath) =>
    invoke<OpenProjectResult>('project_open_path', { filePath }),
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
})
