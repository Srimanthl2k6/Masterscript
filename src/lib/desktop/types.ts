import type { ScriptProject } from '../../types/screenplay'

export type DesktopRuntime = 'web' | 'electron' | 'tauri'

export interface RecentProjectEntry {
  label: string
  source: 'project' | 'import'
  updatedAt: string
  projectId?: string
  fileGrantId?: string
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
  authKey: string
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

export interface LanTransportOpenOptions {
  serverUrl: string
  roomId: string
  authKey: string
}

export interface LanTransportOpenResult {
  ok: boolean
  sessionId?: string
  error?: string
}

export interface LanTransportEvent {
  eventType: 'message' | 'disconnected'
  payload?: string
  error?: string
}

export interface ProjectFileRef {
  grantId: string
  displayPath: string
}

export interface OperationResult {
  ok: boolean
  fileRef?: ProjectFileRef
  cancelled?: boolean
  error?: string
}

export interface OpenProjectResult extends OperationResult {
  project?: ScriptProject
}

export interface TextImportResult extends OperationResult {
  content?: string
  displayPath?: string
}

export interface BinaryImportResult extends OperationResult {
  base64?: string
  displayPath?: string
}

export interface FontFamilyDescriptor {
  family: string
  styles: Array<'regular' | 'bold' | 'italic' | 'bold-italic'>
}

export interface FontLoadResult {
  ok: boolean
  base64?: string
  embeddable?: boolean
  error?: string
}

export interface LegacyOperationResult extends Omit<OperationResult, 'fileRef'> {
  path?: string
}

export interface LegacyOpenProjectResult extends LegacyOperationResult {
  project?: ScriptProject
}

export interface LegacyTextImportResult extends LegacyOperationResult {
  content?: string
}

export interface LegacyBinaryImportResult extends LegacyOperationResult {
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
  readRecentProjectSnapshots?(): Promise<Record<string, ScriptProject>>
  writeRecentProjectSnapshot?(project: ScriptProject): Promise<OperationResult>
  saveProject(project: ScriptProject, title: string): Promise<LegacyOperationResult>
  saveProjectPath(
    filePath: string,
    project: ScriptProject,
  ): Promise<LegacyOperationResult>
  openProject(): Promise<LegacyOpenProjectResult>
  openProjectPath(filePath: string): Promise<LegacyOpenProjectResult>
  exportFountain(title: string, content: string): Promise<OperationResult>
  importFountain(): Promise<LegacyTextImportResult>
  importFdx(): Promise<LegacyTextImportResult>
  exportFdx(title: string, content: string): Promise<OperationResult>
  importDocx(): Promise<LegacyBinaryImportResult>
  exportDocx(title: string, base64: string): Promise<OperationResult>
  exportPdf(title: string, base64: string): Promise<OperationResult>
  hostLanCollaboration(
    options: LanCollaborationHostOptions,
  ): Promise<LanCollaborationHostResult>
  joinLanCollaboration(
    options: LanCollaborationJoinOptions,
  ): Promise<LanCollaborationJoinResult>
  openLanTransport(
    options: LanTransportOpenOptions,
    onEvent: (event: LanTransportEvent) => void,
  ): Promise<LanTransportOpenResult>
  sendLanTransport(sessionId: string, payload: string): Promise<OperationResult>
  closeLanTransport(sessionId: string): Promise<OperationResult>
  stopLanCollaboration(): Promise<{ ok: boolean; error?: string }>
  getLanCollaborationStatus(): Promise<LanCollaborationStatusResult>
  exportMigrationManifest?(
    manifest: MigrationManifestV1,
  ): Promise<OperationResult>
  getInstallState?(): Promise<InstallState>
  setTutorialCompleted?(completed: boolean): Promise<void>
  bootstrapInstallation?(): Promise<BootstrapInstallationResult>
}

export interface DesktopBridge
  extends Omit<
    DesktopNativeApi,
    | 'isElectron'
    | 'saveProject'
    | 'saveProjectPath'
    | 'openProject'
    | 'openProjectPath'
    | 'importFountain'
    | 'importFdx'
    | 'importDocx'
  > {
  runtime: DesktopRuntime
  saveProject(project: ScriptProject, title: string): Promise<OperationResult>
  saveProjectRef(
    grantId: string,
    project: ScriptProject,
  ): Promise<OperationResult>
  openProject(): Promise<OpenProjectResult>
  openProjectRef(grantId: string): Promise<OpenProjectResult>
  importFountain(): Promise<TextImportResult>
  importFdx(): Promise<TextImportResult>
  importDocx(): Promise<BinaryImportResult>
  readRecentProjectSnapshots(): Promise<Record<string, ScriptProject>>
  writeRecentProjectSnapshot(project: ScriptProject): Promise<OperationResult>
  exportMigrationManifest(manifest: MigrationManifestV1): Promise<OperationResult>
  getInstallState(): Promise<InstallState>
  setTutorialCompleted(completed: boolean): Promise<void>
  bootstrapInstallation(): Promise<BootstrapInstallationResult>
  listInstalledFonts(): Promise<FontFamilyDescriptor[]>
  loadFontForExport(family: string, style: string): Promise<FontLoadResult>
}
