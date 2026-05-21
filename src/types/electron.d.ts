import type { ScriptProject } from './screenplay'

interface LanCollaborationHostOptions {
  roomId?: string
  port?: number
}

interface LanCollaborationJoinOptions {
  serverUrl: string
  roomId: string
}

interface LanCollaborationHostResult {
  ok: boolean
  roomId?: string
  port?: number
  hostUrls?: string[]
  primaryHostUrl?: string
  error?: string
}

interface LanCollaborationJoinResult {
  ok: boolean
  serverUrl?: string
  roomId?: string
  error?: string
}

interface LanCollaborationStatusResult extends LanCollaborationHostResult {
  running?: boolean
}

declare global {
  interface Window {
    masterscript?: {
      isElectron: true
      autosave: (project: ScriptProject) => Promise<{ ok: boolean }>
      readAutosave: () => Promise<{ ok: boolean; project: ScriptProject | null }>
      saveProject: (
        project: ScriptProject,
        title: string,
      ) => Promise<{ ok: boolean; path?: string; cancelled?: boolean }>
      saveProjectPath: (
        filePath: string,
        project: ScriptProject,
      ) => Promise<{ ok: boolean; path?: string; error?: string }>
      openProject: () => Promise<{
        ok: boolean
        project?: ScriptProject
        path?: string
        cancelled?: boolean
      }>
      openProjectPath: (filePath: string) => Promise<{
        ok: boolean
        project?: ScriptProject
        path?: string
        error?: string
      }>
      exportFountain: (
        title: string,
        content: string,
      ) => Promise<{ ok: boolean; path?: string; cancelled?: boolean }>
      importFountain: () => Promise<{
        ok: boolean
        content?: string
        path?: string
        cancelled?: boolean
      }>
      importFdx: () => Promise<{
        ok: boolean
        content?: string
        path?: string
        cancelled?: boolean
      }>
      exportFdx: (
        title: string,
        content: string,
      ) => Promise<{ ok: boolean; path?: string; cancelled?: boolean }>
      importDocx: () => Promise<{
        ok: boolean
        base64?: string
        path?: string
        cancelled?: boolean
      }>
      exportDocx: (
        title: string,
        base64: string,
      ) => Promise<{ ok: boolean; path?: string; cancelled?: boolean }>
      exportPdf: (
        title: string,
        base64: string,
      ) => Promise<{ ok: boolean; path?: string; cancelled?: boolean }>
      hostLanCollaboration: (
        options: LanCollaborationHostOptions,
      ) => Promise<LanCollaborationHostResult>
      joinLanCollaboration: (
        options: LanCollaborationJoinOptions,
      ) => Promise<LanCollaborationJoinResult>
      stopLanCollaboration: () => Promise<{ ok: boolean }>
      getLanCollaborationStatus: () => Promise<LanCollaborationStatusResult>
    }
  }
}

export {}
