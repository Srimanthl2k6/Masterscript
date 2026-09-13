import { useEffect, useState } from 'react'
import type { ScriptProject } from '../types/screenplay'

/** Report surfaces wait for a pause in incoming edits (including collaboration). */
export const useAnalysisProject = (project: ScriptProject): ScriptProject => {
  const [snapshot, setSnapshot] = useState(project)
  useEffect(() => {
    const timer = setTimeout(() => setSnapshot(project), 300)
    return () => clearTimeout(timer)
  }, [project])
  return snapshot.id === project.id ? snapshot : project
}
