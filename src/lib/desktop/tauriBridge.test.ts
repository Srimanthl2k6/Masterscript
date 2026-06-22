import { describe, expect, it, vi } from 'vitest'
import type { ScriptProject } from '../../types/screenplay'
import {
  createTauriDesktopBridge,
  type TauriChannelFactory,
  type TauriInvoker,
} from './tauriBridge'

describe('createTauriDesktopBridge', () => {
  it('maps project persistence and file transfer operations to Rust commands', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'project_read_autosave') {
        return { ok: true, project: null }
      }
      return {
        ok: true,
        fileRef: { grantId: 'grant-1', displayPath: 'result-path' },
      }
    })
    const bridge = createTauriDesktopBridge(invoke as unknown as TauriInvoker)
    const project = { id: 'project-1' } as ScriptProject

    await bridge.autosave(project)
    await bridge.readAutosave()
    await bridge.readRecentProjectSnapshots()
    await bridge.writeRecentProjectSnapshot(project)
    await bridge.saveProject(project, 'Draft')
    await bridge.saveProjectRef('grant-1', project)
    await bridge.openProject()
    await bridge.openProjectRef('grant-1')
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
      'project_read_recent_snapshots',
      'project_write_recent_snapshot',
      'project_save_file',
      'project_save_ref',
      'project_open_file',
      'project_open_ref',
      'project_export_fountain',
      'project_import_fountain',
      'project_import_fdx',
      'project_export_fdx',
      'project_import_docx',
      'project_export_docx',
      'project_export_pdf',
    ])
    expect(invoke).toHaveBeenCalledWith('project_save_ref', {
      grantId: 'grant-1',
      project,
    })
    expect(invoke).toHaveBeenCalledWith('project_open_ref', {
      grantId: 'grant-1',
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
    const channelFactory = vi.fn((onMessage: (event: unknown) => void) => ({
      onmessage: onMessage,
      channel: 'fake',
    }))
    const bridge = createTauriDesktopBridge(
      invoke as unknown as TauriInvoker,
      channelFactory as TauriChannelFactory,
    )

    await bridge.hostLanCollaboration({
      roomId: 'room-a',
      authKey: 'auth-key',
      port: 0,
    })
    await bridge.joinLanCollaboration({
      serverUrl: 'ws://127.0.0.1:4567',
      roomId: 'room-a',
    })
    const onMessage = vi.fn()
    await bridge.openLanTransport(
      {
        serverUrl: 'ws://127.0.0.1:4567',
        roomId: 'room-a',
        authKey: 'auth-key',
      },
      onMessage,
    )
    await bridge.sendLanTransport('session-a', '{"type":"state"}')
    await bridge.closeLanTransport('session-a')
    await bridge.getLanCollaborationStatus()
    await bridge.stopLanCollaboration()
    await bridge.bootstrapInstallation()
    await bridge.getInstallState()
    await bridge.setTutorialCompleted(true)

    expect(invoke.mock.calls.map(([command]) => command)).toEqual([
      'collaboration_lan_host',
      'collaboration_lan_join',
      'collaboration_lan_transport_open',
      'collaboration_lan_transport_send',
      'collaboration_lan_transport_close',
      'collaboration_lan_status',
      'collaboration_lan_stop',
      'bootstrap_installation',
      'installation_get_state',
      'installation_set_tutorial_completed',
    ])
    expect(channelFactory).toHaveBeenCalledWith(onMessage)
    expect(invoke).toHaveBeenCalledWith('collaboration_lan_transport_open', {
      options: {
        serverUrl: 'ws://127.0.0.1:4567',
        roomId: 'room-a',
        authKey: 'auth-key',
      },
      onEvent: expect.objectContaining({ channel: 'fake' }),
    })
  })
})
