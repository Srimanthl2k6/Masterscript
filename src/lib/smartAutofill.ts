import {
  parseSceneHeadingParts,
  sceneHeadingTimesOfDay,
} from './sceneHeading'
import type { BlockType } from '../types/screenplay'

const normalize = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toUpperCase()

const editDistance = (left: string, right: string): number => {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  )
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]
}

const suggestionScore = (query: string, candidate: string): number => {
  if (!query) {
    return 0
  }
  if (candidate.startsWith(query)) {
    return 400 - (candidate.length - query.length)
  }
  if (candidate.split(/\s+/).some((word) => word.startsWith(query))) {
    return 300 - candidate.indexOf(query)
  }
  if (candidate.includes(query)) {
    return 200 - candidate.indexOf(query)
  }
  const words = candidate.split(/\s+/)
  const distance = Math.min(
    editDistance(query, candidate),
    ...words.map((word) => editDistance(query, word.slice(0, query.length))),
  )
  return 100 - distance * 10 - Math.abs(candidate.length - query.length)
}

export const rankSuggestions = (
  query: string,
  candidates: readonly string[],
  limit = 8,
): string[] => {
  const normalizedQuery = normalize(query)
  const unique = new Map<string, string>()
  for (const candidate of candidates) {
    const normalizedCandidate = normalize(candidate)
    if (normalizedCandidate && !unique.has(normalizedCandidate)) {
      unique.set(normalizedCandidate, candidate.trim())
    }
  }

  return [...unique.entries()]
    .map(([normalizedCandidate, original]) => ({
      normalizedCandidate,
      original,
      score: suggestionScore(normalizedQuery, normalizedCandidate),
    }))
    .filter((entry) => !normalizedQuery || entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.normalizedCandidate.localeCompare(right.normalizedCandidate),
    )
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.original)
}

const prefixPattern = /^(INT\.\/EXT\.|INT\/EXT\.|I\/E|INT\.|EXT\.|EST\.)\s*/i
const sceneNumberPattern =
  /(?:[-.]?\s*)?(SCENE\s+[A-Z0-9]+|(?:S(?:C)?\.\s*|S(?:C)?\s+)[A-Z0-9]+)\.?\s*$/i

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const sceneHeadingLocationBody = (heading: string): string => {
  const normalized = normalize(heading)
  const prefix = normalized.match(prefixPattern)?.[1] ?? ''
  const bodyWithScene = normalized.replace(prefixPattern, '').trim()
  const body = bodyWithScene.replace(sceneNumberPattern, '').trim()
  const parsed = parseSceneHeadingParts(normalized)
  return parsed.timeOfDay
    ? body
        .replace(
          new RegExp(
            `(?:\\s+-\\s+|\\.\\s*|\\s+)${escapeRegExp(parsed.timeOfDay)}\\.?$`,
          ),
          '',
        )
        .trim()
    : body.replace(new RegExp(`^${escapeRegExp(prefix)}\\s+`), '').trim()
}

export const extractSceneHeadingLocationQuery = (heading: string): string => {
  const withoutTime = sceneHeadingLocationBody(heading)
  return normalize(
    withoutTime
      .split(/\s+-\s+/)[0]
      ?.replace(/[.\s]+$/, '')
      .trim() ?? '',
  )
}

interface AutofillEnterSuggestion {
  kind: 'character' | 'voice-cue' | 'location' | 'transition'
  value: string
}

interface AutofillEnterContext {
  characterSuggestions: readonly string[]
  locations: readonly string[]
}

export const shouldApplyAutofillSuggestionOnEnter = (
  block: { type: BlockType; text: string },
  suggestion: AutofillEnterSuggestion,
  context: AutofillEnterContext,
): boolean => {
  if (block.type === 'character' && suggestion.kind === 'character') {
    const typed = normalize(block.text)
    if (
      typed === normalize(suggestion.value) ||
      context.characterSuggestions.some((name) => normalize(name) === typed)
    ) {
      return false
    }
  }

  if (block.type === 'scene-heading' && suggestion.kind === 'location') {
    const typedLocation = extractSceneHeadingLocationQuery(block.text)
    if (
      typedLocation === normalize(suggestion.value) ||
      context.locations.some((location) => normalize(location) === typedLocation)
    ) {
      return false
    }

    if (typedLocation && parseSceneHeadingParts(normalize(block.text)).timeOfDay) {
      return false
    }
  }

  return true
}

export const replaceSceneHeadingLocation = (
  heading: string,
  location: string,
): string => {
  const normalized = normalize(heading)
  const prefix = normalized.match(prefixPattern)?.[1] ?? ''
  const bodyWithScene = normalized.replace(prefixPattern, '').trim()
  const sceneNumber = bodyWithScene.match(sceneNumberPattern)?.[1] ?? ''
  const body = sceneHeadingLocationBody(normalized)
  const parsed = parseSceneHeadingParts(normalized)
  const locationParts = body
    .split(/\s+-\s+/)
    .map((part) => part.replace(/[.\s]+$/, '').trim())
    .filter(Boolean)
  const selectedLocation = normalize(location)
  const pieces = [
    `${prefix ? `${prefix} ` : ''}${selectedLocation}`,
    ...locationParts.slice(1),
    ...(parsed.timeOfDay ? [parsed.timeOfDay] : []),
  ]
  return `${pieces.join(' - ')}${sceneNumber ? ` ${sceneNumber}` : ''}`.trim()
}

export const standardSceneTimes = sceneHeadingTimesOfDay
