import { describe, expect, it, vi } from 'vitest'
import type { ScriptProject } from '../../types/screenplay'
import {
  createTauriDesktopBridge,
  type TauriInvoker,
} from './tauriBridge'

describe('createTauriDesktopBridge', () => {
  it('maps project persistence and file transfer operations to Rust commands', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'project_read_autosave') {
        return { ok: true, project: null }
      }
      return { ok: true, path: 'result-path' }
    })
    const bridge = createTauriDesktopBridge(invoke as unknown as TauriInvoker)
    const project = { id: 'project-1' } as ScriptProject

    await bridge.autosave(project)
    await bridge.readAutosave()
    await bridge.saveProject(project, 'Draft')
    await bridge.saveProjectPath('draft.msproj.json', project)
    await bridge.openProject()
    await bridge.openProjectPath('draft.msproj.json')
    await bridge.exportFountain('Draft', 'INT. ROOM - DAY')
    await bridge.importFountain()
    await bridge.importFdx()
    await bridge.exportFdx('Draft', '<FinalDraft />')
    await bridge.importDocx()
    await bridge.exportDocx('Draft', 'ZG9jeA==')
    await bridge.exportPdf('Draft', 'cGRm')

    expect(invoke.mock.calls.map(([command]) => command)).toEqual([
      'project_autosave',
      'project_read_autosave',
      'project_save_file',
      'project_save_path',
      'project_open_file',
      'project_open_path',
      'project_export_fountain',
      'project_import_fountain',
      'project_import_fdx',
      'project_export_fdx',
      'project_import_docx',
      'project_export_docx',
      'project_export_pdf',
    ])
    expect(invoke).toHaveBeenCalledWith('project_save_path', {
      filePath: 'draft.msproj.json',
      project,
    })
  })

  it('maps collaboration and installation operations to Rust commands', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'installation_get_state') {
        return {
          kind: 'existing-tauri',
          tutorialCompleted: true,
          migrationVersion: 1,
        }
      }
      if (command === 'bootstrap_installation') {
        return {
          installState: {
            kind: 'legacy-migrated',
            tutorialCompleted: true,
            migrationVersion: 1,
          },
          migrationManifest: null,
        }
      }
      return { ok: true }
    })
    const bridge = createTauriDesktopBridge(invoke as unknown as TauriInvoker)

    await bridge.hostLanCollaboration({ roomId: 'room-a', port: 0 })
    await bridge.joinLanCollaboration({
      serverUrl: 'ws://127.0.0.1:4567',
      roomId: 'room-a',
    })
    await bridge.getLanCollaborationStatus()
    await bridge.stopLanCollaboration()
    await bridge.bootstrapInstallation()
    await bridge.getInstallState()
    await bridge.setTutorialCompleted(true)

    expect(invoke.mock.calls.map(([command]) => command)).toEqual([
      'collaboration_lan_host',
      'collaboration_lan_join',
      'collaboration_lan_status',
      'collaboration_lan_stop',
      'bootstrap_installation',
      'installation_get_state',
      'installation_set_tutorial_completed',
    ])
  })
})
