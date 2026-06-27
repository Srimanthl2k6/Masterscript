import { useMemo } from 'react'
import type { ScriptProject } from '../types/screenplay'
import { buildSmartTypeOptions } from './formattingEngine'
import { collectCharacterSuggestions } from './screenplay'

export const buildAutofillSourceProject = (
  project: ScriptProject,
  activeBlockId: string | null,
): ScriptProject =>
  activeBlockId
    ? {
        ...project,
        blocks: project.blocks.filter((block) => block.id !== activeBlockId),
      }
    : project

export const useAutofillSourceOptions = (
  project: ScriptProject,
  activeBlockId: string | null,
) => {
  const sourceProject = useMemo(
    () => buildAutofillSourceProject(project, activeBlockId),
    [activeBlockId, project],
  )
  const characterSuggestions = useMemo(
    () => collectCharacterSuggestions(sourceProject),
    [sourceProject],
  )
  const smartTypeOptions = useMemo(
    () => buildSmartTypeOptions(sourceProject),
    [sourceProject],
  )

  return { characterSuggestions, smartTypeOptions }
}
