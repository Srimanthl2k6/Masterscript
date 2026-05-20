import type { ScriptProject } from './screenplay'

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
    }
  }
}

export {}
