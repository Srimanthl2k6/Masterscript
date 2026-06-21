import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScriptProject } from '../../types/screenplay'
import { createDesktopBridge } from './desktopBridge'

describe('createDesktopBridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses a web bridge when no desktop runtime is present', async () => {
    vi.stubGlobal('window', {})

    const bridge = createDesktopBridge()

    expect(bridge.runtime).toBe('web')
    expect(await bridge.readAutosave()).toEqual({ ok: true, project: null })
    expect(await bridge.getInstallState()).toEqual({
      kind: 'fresh',
      tutorialCompleted: false,
      migrationVersion: null,
    })
  })

  it('wraps the existing Electron preload API without changing its results', async () => {
    const project = { id: 'project-1' } as ScriptProject
    const autosave = vi.fn().mockResolvedValue({ ok: true })
    const readAutosave = vi.fn().mockResolvedValue({ ok: true, project })
    const electronApi = {
      isElectron: true as const,
      autosave,
      readAutosave,
    }
    vi.stubGlobal('window', { masterscript: electronApi })

    const bridge = createDesktopBridge()

    expect(bridge.runtime).toBe('electron')
    await expect(bridge.autosave(project)).resolves.toEqual({ ok: true })
    await expect(bridge.readAutosave()).resolves.toEqual({ ok: true, project })
    expect(autosave).toHaveBeenCalledWith(project)
  })

  it('identifies a Tauri shell without exposing unimplemented native operations', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })

    const bridge = createDesktopBridge()

    expect(bridge.runtime).toBe('tauri')
    await expect(bridge.saveProject({} as ScriptProject, 'Draft')).resolves.toEqual({
      ok: false,
      error: 'Desktop operation is not available in this Pass 1 Tauri shell.',
    })
  })
})
