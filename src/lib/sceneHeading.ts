export const sceneHeadingTimesOfDay = [
  'MOMENTS LATER',
  'MAGIC HOUR',
  'SAME TIME',
  'CONTINUOUS',
  'EVENING',
  'MORNING',
  'AFTERNOON',
  'LATER',
  'DAWN',
  'DUSK',
  'DAY',
  'NIGHT',
]

const prefixPattern = /^(INT\.\/EXT\.|INT\/EXT\.|I\/E|INT\.|EXT\.|EST\.)\s*/

const normalizePrefix = (value: string): string => {
  switch (value) {
    case 'INT/EXT.':
    case 'I/E':
      return 'INT./EXT.'
    default:
      return value
  }
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const stripSceneNumberSuffix = (value: string): string =>
  value
    .replace(/\s*(?:[-.]?\s*)SCENE\s+[A-Z0-9]+\.?\s*$/i, '')
    .replace(/\s*(?:[-.]?\s*)S(?:C)?\.?\s*[A-Z0-9]+\.?\s*$/i, '')
    .trim()

export const parseSceneHeadingParts = (heading: string) => {
  const normalized = heading.trim().replace(/\s+/g, ' ').toUpperCase()
  const prefixMatch = normalized.match(prefixPattern)
  const intExt = prefixMatch ? normalizePrefix(prefixMatch[1]) : ''
  const withoutPrefix = normalized.replace(prefixPattern, '').trim()
  const withoutSceneNumber = stripSceneNumberSuffix(withoutPrefix)

  const timeOfDay =
    sceneHeadingTimesOfDay.find((time) => {
      const escaped = escapeRegExp(time)
      return new RegExp(`(?:\\s+-\\s+|\\.\\s*|\\s+)${escaped}\\.?$`).test(
        withoutSceneNumber,
      )
    }) ?? ''

  const location = (timeOfDay
    ? withoutSceneNumber.replace(
        new RegExp(
          `(?:\\s+-\\s+|\\.\\s*|\\s+)${escapeRegExp(timeOfDay)}\\.?$`,
        ),
        '',
      )
    : withoutSceneNumber
  )
    .split(/\s+-\s+/)[0]
    .replace(/[.\s]+$/, '')
    .trim()

  return {
    intExt,
    dayNight: timeOfDay,
    timeOfDay,
    location,
    normalized,
  }
}
