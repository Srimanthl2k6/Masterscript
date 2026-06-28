import type { ScriptProject } from '../types/screenplay'
import { cloneProject, extractScenes } from './screenplay'

export const sanitizeSceneNumberSuffix = (input: string): string =>
  input
    .toUpperCase()
    .replace(/^\s*\d+/, '')
    .replace(/[^A-Z]/g, '')
    .slice(0, 6)

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

const preservedSceneNumberMap = (
  project: ScriptProject,
): Record<string, string> => {
  const scenes = extractScenes(project)
  const usedNumbers = new Set<number>()
  const numbers: Record<string, string> = {}

  for (const [index, scene] of scenes.entries()) {
    const current = project.advanced.sceneNumbering.numbers[scene.blockId]
    if (!current) {
      continue
    }

    const parsed = parseSceneNumberLabel(current, index + 1)
    numbers[scene.blockId] = formatSceneNumberLabel(parsed)
    usedNumbers.add(parsed.number)
  }

  let nextNumber = 1
  for (const scene of scenes) {
    if (numbers[scene.blockId]) {
      continue
    }

    while (usedNumbers.has(nextNumber)) {
      nextNumber += 1
    }

    numbers[scene.blockId] = String(nextNumber)
    usedNumbers.add(nextNumber)
  }

  return numbers
}

const reflowSceneNumberMap = (
  project: ScriptProject,
  blockId: string,
  input: string,
): Record<string, string> => {
  const normalizedNumbers = preservedSceneNumberMap(project)
  const scenes = extractScenes(project)
  const entries = scenes.map((scene, index) => ({
    blockId: scene.blockId,
    current: parseSceneNumberLabel(
      normalizedNumbers[scene.blockId] ?? String(index + 1),
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
      if (targetNumber !== oldNumber && number > oldNumber) {
        number = Math.max(1, number - 1)
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
  if (project.advanced.sceneNumbering.locked) {
    return project
  }

  const numbers = preservedSceneNumberMap(project)
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

  const numbers = reflowSceneNumberMap(project, blockId, input)
  if (sameNumberMap(numbers, project.advanced.sceneNumbering.numbers)) {
    return project
  }

  const next = cloneProject(project)
  next.advanced.sceneNumbering.numbers = numbers
  return next
}
