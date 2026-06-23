import type {
  TextFormat,
  TextFormatRange,
} from '../types/screenplay'

export interface TextFormatRun extends TextFormatRange {
  text: string
}

export interface TextEdit {
  start: number
  end: number
  insertedText: string
}

const formatKeys = [
  'bold',
  'italic',
  'underline',
  'letterSpacing',
  'fontFamily',
] as const satisfies ReadonlyArray<keyof TextFormat>

export const normalizeTextFormat = (format: TextFormat): TextFormat => {
  const normalized: TextFormat = {}
  for (const key of formatKeys) {
    const value = format[key]
    if (key === 'fontFamily') {
      const family = typeof value === 'string' ? value.trim() : ''
      if (family) {
        normalized.fontFamily = family.slice(0, 128)
      }
    } else if (value === true) {
      normalized[key] = true
    }
  }
  return normalized
}

const formatSignature = (format: TextFormat): string =>
  JSON.stringify(normalizeTextFormat(format))

const mergeFormats = (
  base: TextFormat,
  patch: Partial<TextFormat>,
): TextFormat => {
  const next: TextFormat = { ...base }
  for (const key of formatKeys) {
    if (!(key in patch)) {
      continue
    }
    const value = patch[key]
    if (
      value === false ||
      value === null ||
      value === undefined ||
      (key === 'fontFamily' && value === '')
    ) {
      delete next[key]
    } else {
      ;(next as Record<string, unknown>)[key] = value
    }
  }
  return normalizeTextFormat(next)
}

export const formatAtOffset = (
  ranges: readonly TextFormatRange[] | undefined,
  offset: number,
): TextFormat => {
  const clamped = Math.max(0, offset)
  const match = (ranges ?? []).find(
    (range) => range.start <= clamped && clamped < range.end,
  )
  return normalizeTextFormat(match?.format ?? {})
}

export const normalizeFormatRanges = (
  ranges: readonly TextFormatRange[] | undefined,
  textLength: number,
): TextFormatRange[] => {
  const maximum = Math.max(0, textLength)
  const source = (ranges ?? [])
    .map((range) => ({
      start: Math.max(0, Math.min(maximum, Math.floor(range.start))),
      end: Math.max(0, Math.min(maximum, Math.floor(range.end))),
      format: normalizeTextFormat(range.format),
    }))
    .filter(
      (range) =>
        range.end > range.start && Object.keys(range.format).length > 0,
    )

  const boundaries = [
    ...new Set(source.flatMap((range) => [range.start, range.end])),
  ].sort((left, right) => left - right)
  const normalized: TextFormatRange[] = []

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index]
    const end = boundaries[index + 1]
    let format: TextFormat = {}
    for (const range of source) {
      if (range.start <= start && range.end >= end) {
        format = mergeFormats(format, range.format)
      }
    }
    if (Object.keys(format).length === 0) {
      continue
    }
    const previous = normalized.at(-1)
    if (
      previous &&
      previous.end === start &&
      formatSignature(previous.format) === formatSignature(format)
    ) {
      previous.end = end
    } else {
      normalized.push({ start, end, format })
    }
  }
  return normalized
}

export const applyFormatPatch = (
  ranges: readonly TextFormatRange[] | undefined,
  selectionStart: number,
  selectionEnd: number,
  patch: Partial<TextFormat>,
  textLength: number,
): TextFormatRange[] => {
  const start = Math.max(0, Math.min(textLength, selectionStart, selectionEnd))
  const end = Math.max(0, Math.min(textLength, Math.max(selectionStart, selectionEnd)))
  if (end <= start) {
    return normalizeFormatRanges(ranges, textLength)
  }

  const current = normalizeFormatRanges(ranges, textLength)
  const boundaries = [
    ...new Set([
      0,
      textLength,
      start,
      end,
      ...current.flatMap((range) => [range.start, range.end]),
    ]),
  ].sort((left, right) => left - right)
  const next: TextFormatRange[] = []

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const segmentStart = boundaries[index]
    const segmentEnd = boundaries[index + 1]
    if (segmentEnd <= segmentStart) {
      continue
    }
    const base = formatAtOffset(current, segmentStart)
    const format =
      segmentStart >= start && segmentEnd <= end
        ? mergeFormats(base, patch)
        : base
    if (Object.keys(format).length > 0) {
      next.push({ start: segmentStart, end: segmentEnd, format })
    }
  }
  return normalizeFormatRanges(next, textLength)
}

export const deriveTextEdit = (
  previousText: string,
  nextText: string,
): TextEdit => {
  let prefix = 0
  const maximumPrefix = Math.min(previousText.length, nextText.length)
  while (
    prefix < maximumPrefix &&
    previousText[prefix] === nextText[prefix]
  ) {
    prefix += 1
  }

  let suffix = 0
  const maximumSuffix = maximumPrefix - prefix
  while (
    suffix < maximumSuffix &&
    previousText[previousText.length - 1 - suffix] ===
      nextText[nextText.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const oldEnd = previousText.length - suffix
  const newEnd = nextText.length - suffix
  return {
    start: prefix,
    end: oldEnd,
    insertedText: nextText.slice(prefix, newEnd),
  }
}

export const updateRangesForEdits = (
  sourceText: string,
  sourceRanges: readonly TextFormatRange[] | undefined,
  edits: readonly TextEdit[],
): { text: string; ranges: TextFormatRange[] } => {
  let text = sourceText
  let ranges = normalizeFormatRanges(sourceRanges, sourceText.length)
  for (const edit of [...edits].sort((left, right) => right.start - left.start)) {
    const start = Math.max(0, Math.min(text.length, edit.start))
    const end = Math.max(start, Math.min(text.length, edit.end))
    const nextText = `${text.slice(0, start)}${edit.insertedText}${text.slice(end)}`
    ranges = updateRangesForTextEdit(
      text,
      nextText,
      ranges,
      formatAtOffset(ranges, start),
    )
    text = nextText
  }
  return { text, ranges }
}

export const updateRangesForTextEdit = (
  previousText: string,
  nextText: string,
  ranges: readonly TextFormatRange[] | undefined,
  futureTypingFormat?: TextFormat,
): TextFormatRange[] => {
  if (previousText === nextText) {
    return normalizeFormatRanges(ranges, nextText.length)
  }

  let prefix = 0
  const maximumPrefix = Math.min(previousText.length, nextText.length)
  while (
    prefix < maximumPrefix &&
    previousText[prefix] === nextText[prefix]
  ) {
    prefix += 1
  }

  let suffix = 0
  const maximumSuffix = maximumPrefix - prefix
  while (
    suffix < maximumSuffix &&
    previousText[previousText.length - 1 - suffix] ===
      nextText[nextText.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const oldEnd = previousText.length - suffix
  const newEnd = nextText.length - suffix
  const insertedLength = newEnd - prefix
  const removedLength = oldEnd - prefix
  const delta = insertedLength - removedLength
  const current = normalizeFormatRanges(ranges, previousText.length)
  const next: TextFormatRange[] = []

  for (const range of current) {
    if (range.start < prefix) {
      next.push({
        start: range.start,
        end: Math.min(range.end, prefix),
        format: range.format,
      })
    }
    if (range.end > oldEnd) {
      next.push({
        start: Math.max(range.start, oldEnd) + delta,
        end: range.end + delta,
        format: range.format,
      })
    }
  }

  if (insertedLength > 0) {
    const inherited =
      removedLength === 0
        ? formatAtOffset(current, Math.max(0, prefix - (prefix > 0 ? 1 : 0)))
        : {}
    const format = mergeFormats(inherited, futureTypingFormat ?? {})
    if (Object.keys(format).length > 0) {
      next.push({
        start: prefix,
        end: newEnd,
        format,
      })
    }
  }

  return normalizeFormatRanges(next, nextText.length)
}

export const formatRuns = (
  text: string,
  ranges: readonly TextFormatRange[] | undefined,
): TextFormatRun[] => {
  if (!text) {
    return []
  }
  const normalized = normalizeFormatRanges(ranges, text.length)
  const boundaries = [
    ...new Set([
      0,
      text.length,
      ...normalized.flatMap((range) => [range.start, range.end]),
    ]),
  ].sort((left, right) => left - right)

  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]
    return {
      start,
      end,
      text: text.slice(start, end),
      format: formatAtOffset(normalized, start),
    }
  })
}
