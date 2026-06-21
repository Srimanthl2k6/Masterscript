import type { ScriptProject } from '../../types/screenplay'

export type DesktopRuntime = 'web' | 'electron' | 'tauri'

export interface RecentProjectEntry {
  label: string
  source: 'project' | 'import'
  updatedAt: string
  projectId?: string
}

export interface InstallState {
  kind: 'fresh' | 'legacy-migrated' | 'existing-tauri'
  tutorialCompleted: boolean
  migrationVersion: number | null
}

export interface MigrationManifestV1 {
  schemaVersion: 1
  sourceVersion: string
  exportedAt: string
  legacyInstall: true
  tutorialCompleted: true
  theme: 'dark' | 'light'
  recentProjects: RecentProjectEntry[]
  recentProjectSnapshots: Record<string, ScriptProject>
  hostedLanRooms: string[]
  autosavePath: string | null
}

export interface BootstrapInstallationResult {
  installState: InstallState
  migrationManifest: MigrationManifestV1 | null
}

export interface LanCollaborationHostOptions {
  roomId?: string
  port?: number
}

export interface LanCollaborationJoinOptions {
  serverUrl: string
  roomId: string
}

export interface LanCollaborationHostResult {
  ok: boolean
  roomId?: string
  port?: number
  hostUrls?: string[]
  primaryHostUrl?: string
  error?: string
}

export interface LanCollaborationJoinResult {
  ok: boolean
  serverUrl?: string
  roomId?: string
  error?: string
}

export interface LanCollaborationStatusResult extends LanCollaborationHostResult {
  running?: boolean
}

export interface OperationResult {
  ok: boolean
  path?: string
  cancelled?: boolean
  error?: string
}

export interface OpenProjectResult extends OperationResult {
  project?: ScriptProject
}

export interface TextImportResult extends OperationResult {
  content?: string
}

export interface BinaryImportResult extends OperationResult {
  base64?: string
}

export interface AutosaveReadResult {
  ok: boolean
  project: ScriptProject | null
  error?: string
}

export interface DesktopNativeApi {
  isElectron: true
  autosave(project: ScriptProject): Promise<{ ok: boolean; error?: string }>
  readAutosave(): Promise<AutosaveReadResult>
  saveProject(project: ScriptProject, title: string): Promise<OperationResult>
  saveProjectPath(filePath: string, project: ScriptProject): Promise<OperationResult>
  openProject(): Promise<OpenProjectResult>
  openProjectPath(filePath: string): Promise<OpenProjectResult>
  exportFountain(title: string, content: string): Promise<OperationResult>
  importFountain(): Promise<TextImportResult>
  importFdx(): Promise<TextImportResult>
  exportFdx(title: string, content: string): Promise<OperationResult>
  importDocx(): Promise<BinaryImportResult>
  exportDocx(title: string, base64: string): Promise<OperationResult>
  exportPdf(title: string, base64: string): Promise<OperationResult>
  hostLanCollaboration(
    options: LanCollaborationHostOptions,
  ): Promise<LanCollaborationHostResult>
  joinLanCollaboration(
    options: LanCollaborationJoinOptions,
  ): Promise<LanCollaborationJoinResult>
  stopLanCollaboration(): Promise<{ ok: boolean; error?: string }>
  getLanCollaborationStatus(): Promise<LanCollaborationStatusResult>
  exportMigrationManifest?(
    manifest: MigrationManifestV1,
  ): Promise<OperationResult>
  getInstallState?(): Promise<InstallState>
  setTutorialCompleted?(completed: boolean): Promise<void>
  bootstrapInstallation?(): Promise<BootstrapInstallationResult>
}

export interface DesktopBridge extends Omit<DesktopNativeApi, 'isElectron'> {
  runtime: DesktopRuntime
  exportMigrationManifest(manifest: MigrationManifestV1): Promise<OperationResult>
  getInstallState(): Promise<InstallState>
  setTutorialCompleted(completed: boolean): Promise<void>
  bootstrapInstallation(): Promise<BootstrapInstallationResult>
}
