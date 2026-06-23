import type { ScriptProject } from '../types/screenplay'
import { cloneProject, extractScenes } from './screenplay'

export const sanitizeSceneNumberSuffix = (input: string): string =>
  input
    .toUpperCase()
    .replace(/^\s*\d+/, '')
    .replace(/[^A-Z]/g, '')
    .slice(0, 6)

const sceneNumberMap = (
  project: ScriptProject,
  overrides: Record<string, string> = {},
): Record<string, string> =>
  Object.fromEntries(
    extractScenes(project).map((scene, index) => {
      const current =
        overrides[scene.blockId] ??
        project.advanced.sceneNumbering.numbers[scene.blockId] ??
        ''
      return [
        scene.blockId,
        `${index + 1}${sanitizeSceneNumberSuffix(current)}`,
      ]
    }),
  )

const sameNumberMap = (
  left: Record<string, string>,
  right: Record<string, string>,
): boolean => {
  const leftEntries = Object.entries(left)
  const rightEntries = Object.entries(right)
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value]) => right[key] === value)
  )
}

export const reconcileSceneNumberLabels = (
  project: ScriptProject,
): ScriptProject => {
  if (project.advanced.sceneNumbering.locked) {
    return project
  }

  const numbers = sceneNumberMap(project)
  if (sameNumberMap(numbers, project.advanced.sceneNumbering.numbers)) {
    return project
  }

  const next = cloneProject(project)
  next.advanced.sceneNumbering.numbers = numbers
  return next
}

export const updateSceneNumberLabel = (
  project: ScriptProject,
  blockId: string,
  input: string,
): ScriptProject => {
  if (project.advanced.sceneNumbering.locked) {
    return project
  }

  const scenes = extractScenes(project)
  if (!scenes.some((scene) => scene.blockId === blockId)) {
    return project
  }

  const numbers = sceneNumberMap(project, { [blockId]: input })
  if (sameNumberMap(numbers, project.advanced.sceneNumbering.numbers)) {
    return project
  }

  const next = cloneProject(project)
  next.advanced.sceneNumbering.numbers = numbers
  return next
}
