import { useEffect, useRef } from 'react'
import type { ScriptProject } from '../../types/screenplay'
import type { ProjectFileRef } from './types'
import { desktopBridge } from './desktopBridge'
import { startDesktopUpdater } from './updater'

export const useDesktopUpdater = (project: ScriptProject, file: ProjectFileRef | null, appView: string, collaborationStatus: string, status: (message: string) => void) => {
  const activityAt = useRef(0)
  const current = useRef({ project, file, appView, collaborationStatus })
  useEffect(() => {
    current.current = { project, file, appView, collaborationStatus }
    activityAt.current = Date.now()
  }, [project, file, appView, collaborationStatus])
  useEffect(() => {
    let frozen = false
    const activity = (event: Event) => {
      activityAt.current = Date.now()
      if (frozen) { event.preventDefault(); event.stopImmediatePropagation() }
    }
    window.addEventListener('keydown', activity, true)
    window.addEventListener('pointerdown', activity, true)
    const stop = startDesktopUpdater({
      canInstall: () => (current.current.appView === 'home' || document.hidden) &&
        current.current.collaborationStatus === 'offline' && Date.now() - activityAt.current > 120_000,
      freeze: value => {
        frozen = value
        const root = document.getElementById('root')
        if (root) root.inert = value
      },
      preserve: async () => {
        const snapshot = current.current.project
        if (!(await desktopBridge.autosave(snapshot)).ok) return false
        const savedFile = current.current.file
        if (savedFile && !(await desktopBridge.saveProjectRef(savedFile.grantId, snapshot)).ok) return false
        if (!(await desktopBridge.writeRecentProjectSnapshot(snapshot)).ok) return false
        return snapshot === current.current.project
      },
    }, status)
    return () => {
      stop()
      window.removeEventListener('keydown', activity, true)
      window.removeEventListener('pointerdown', activity, true)
    }
  }, [status])
}
