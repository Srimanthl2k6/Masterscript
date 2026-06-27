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

interface ParsedSceneNumber {
  number: number
  suffix: string
}

const parseSceneNumberLabel = (
  input: string,
  fallbackNumber: number,
): ParsedSceneNumber => {
  const numeric = input.trim().match(/^(\d+)/)?.[1]
  return {
    number: numeric ? Math.max(1, Number(numeric)) : fallbackNumber,
    suffix: sanitizeSceneNumberSuffix(input),
  }
}

const formatSceneNumberLabel = ({ number, suffix }: ParsedSceneNumber): string =>
  `${number}${suffix}`

const manualSceneNumberMap = (
  project: ScriptProject,
  blockId: string,
  input: string,
): Record<string, string> => {
  const scenes = extractScenes(project)
  const entries = scenes.map((scene, index) => ({
    blockId: scene.blockId,
    current: parseSceneNumberLabel(
      project.advanced.sceneNumbering.numbers[scene.blockId] ?? String(index + 1),
      index + 1,
    ),
  }))
  const selected = entries.find((entry) => entry.blockId === blockId)
  if (!selected) {
    return project.advanced.sceneNumbering.numbers
  }

  const requested = parseSceneNumberLabel(input, selected.current.number)
  const oldNumber = selected.current.number
  const targetNumber = requested.number

  return Object.fromEntries(
    entries.map((entry) => {
      if (entry.blockId === blockId) {
        return [entry.blockId, formatSceneNumberLabel(requested)]
      }

      let number = entry.current.number
      if (targetNumber < oldNumber) {
        if (number >= targetNumber && number < oldNumber) {
          number += 1
        }
      } else if (targetNumber > oldNumber) {
        if (number <= targetNumber && number > oldNumber) {
          number -= 1
        }
      }

      return [
        entry.blockId,
        formatSceneNumberLabel({
          number,
          suffix: entry.current.suffix,
        }),
      ]
    }),
  )
}

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
  if (
    project.advanced.sceneNumbering.locked ||
    project.advanced.sceneNumbering.manualMode
  ) {
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

  const numbers = project.advanced.sceneNumbering.manualMode
    ? manualSceneNumberMap(project, blockId, input)
    : sceneNumberMap(project, { [blockId]: input })
  if (sameNumberMap(numbers, project.advanced.sceneNumbering.numbers)) {
    return project
  }

  const next = cloneProject(project)
  next.advanced.sceneNumbering.numbers = numbers
  return next
}
