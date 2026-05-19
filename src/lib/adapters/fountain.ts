import { createBlock, createEmptyProject } from '../screenplay'
import type { BlockType } from '../../types/screenplay'
import { AdapterParseError } from './errors'
import { compactText, sanitizeTitle } from './normalize'
import type { ScriptProjectAdapterResult } from './types'

const titleKeys = new Set([
  'title',
  'credit',
  'author',
  'authors',
  'source',
  'notes',
  'draft date',
  'contact',
  'copyright',
])

const sanitizeBodyLine = (line: string): string =>
  line.replace(/\t/g, '    ').replace(/\s+$/g, '')

const isSceneHeading = (line: string): boolean => {
  const upper = line.toUpperCase()
  return (
    upper.startsWith('INT.') ||
    upper.startsWith('EXT.') ||
    upper.startsWith('EST.') ||
    upper.startsWith('INT/EXT.') ||
    upper.startsWith('I/E.') ||
    line.startsWith('.')
  )
}

const isTransition = (line: string): boolean => {
  const upper = line.toUpperCase()
  return (
    line.startsWith('>') ||
    upper.endsWith(' TO:') ||
    upper === 'CUT TO:' ||
    upper === 'FADE OUT:' ||
    upper === 'FADE TO BLACK.'
  )
}

const isCharacterCue = (line: string): boolean => {
  if (line.startsWith('@')) {
    return true
  }

  const compacted = line.trim()
  if (!compacted || compacted.length > 42) {
    return false
  }

  if (/[^A-Z0-9 .\-()']/.test(compacted)) {
    return false
  }

  return compacted === compacted.toUpperCase()
}

const parseCharacterName = (line: string): string =>
  line.replace(/^@+/, '').trim().toUpperCase()

interface ParsedFountainBody {
  blocks: ReturnType<typeof createBlock>[]
  warnings: ScriptProjectAdapterResult['warnings']
}

const parseFountainBody = (body: string): ParsedFountainBody => {
  const warnings: ScriptProjectAdapterResult['warnings'] = []
  const normalized = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const boneyardMatches = normalized.match(/\/\*[\s\S]*?\*\//g)
  const withoutBoneyard = normalized.replace(/\/\*[\s\S]*?\*\//g, '')

  if (boneyardMatches && boneyardMatches.length > 0) {
    warnings.push({
      code: 'FOUNTAIN_BONEYARD_IGNORED',
      message: `Ignored ${boneyardMatches.length} boneyard comment block${boneyardMatches.length === 1 ? '' : 's'}.`,
    })
  }

  const blocks: ReturnType<typeof createBlock>[] = []
  const lines = withoutBoneyard.split('\n').map(sanitizeBodyLine)

  let index = 0
  while (index < lines.length) {
    const rawLine = lines[index]
    const line = rawLine.trim()

    if (!line) {
      index += 1
      continue
    }

    if (line.startsWith('/*')) {
      index += 1
      continue
    }

    if (line.startsWith('#')) {
      blocks.push(createBlock('note', line.replace(/^#+\s*/, 'SECTION: ')))
      warnings.push({
        code: 'FOUNTAIN_SECTION_CONVERTED',
        message: 'Section line imported as Note block.',
      })
      index += 1
      continue
    }

    if (line.startsWith('=')) {
      blocks.push(createBlock('note', line.replace(/^=+\s*/, 'SYNOPSIS: ')))
      warnings.push({
        code: 'FOUNTAIN_SYNOPSIS_CONVERTED',
        message: 'Synopsis line imported as Note block.',
      })
      index += 1
      continue
    }

    if (/^\[\[[\s\S]*\]\]$/.test(line)) {
      blocks.push(createBlock('note', line.slice(2, -2).trim()))
      index += 1
      continue
    }

    if (isSceneHeading(line)) {
      blocks.push(createBlock('scene-heading', line.replace(/^\./, '').trim()))
      index += 1
      continue
    }

    if (isTransition(line)) {
      blocks.push(createBlock('transition', line.replace(/^>/, '').replace(/<$/, '').trim()))
      index += 1
      continue
    }

    if (line.startsWith('!')) {
      blocks.push(createBlock('action', line.slice(1).trim()))
      index += 1
      continue
    }

    if (isCharacterCue(line)) {
      const character = parseCharacterName(line)
      blocks.push(createBlock('character', character))
      index += 1

      if (index < lines.length) {
        const parentheticalLine = lines[index]?.trim() ?? ''
        if (/^\(.+\)$/.test(parentheticalLine)) {
          blocks.push(createBlock('parenthetical', parentheticalLine))
          index += 1
        }
      }

      const dialogueLines: string[] = []
      while (index < lines.length) {
        const nextLine = lines[index]
        const compacted = nextLine.trim()

        if (!compacted) {
          break
        }

        if (isSceneHeading(compacted) || isTransition(compacted) || compacted.startsWith('#')) {
          break
        }

        if (isCharacterCue(compacted) && dialogueLines.length > 0) {
          break
        }

        if (/^\[\[[\s\S]*\]\]$/.test(compacted)) {
          break
        }

        dialogueLines.push(compacted)
        index += 1
      }

      if (dialogueLines.length > 0) {
        blocks.push(createBlock('dialogue', dialogueLines.join('\n')))
      }

      continue
    }

    const centeredMatch = line.match(/^>\s*(.+?)\s*<$/)
    if (centeredMatch?.[1]) {
      blocks.push(createBlock('action', centeredMatch[1]))
      index += 1
      continue
    }

    blocks.push(createBlock('action', line))
    index += 1
  }

  if (blocks.length === 0) {
    blocks.push(createBlock('action', ''))
  }

  return { blocks, warnings }
}

export const importFountainProject = (source: string): ScriptProjectAdapterResult => {
  const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!compactText(normalized)) {
    throw new AdapterParseError('Fountain input was empty.')
  }

  const lines = normalized.split('\n')
  const metadataLines: string[] = []
  const bodyLines: string[] = []
  let readingTitlePage = true

  for (const line of lines) {
    const trimmed = line.trim()
    if (readingTitlePage && (!trimmed || /^[A-Za-z][A-Za-z ]*:\s*/.test(trimmed))) {
      metadataLines.push(line)
      if (!trimmed) {
        readingTitlePage = false
      }
      continue
    }

    readingTitlePage = false
    bodyLines.push(line)
  }

  const project = createEmptyProject()
  const metadata = new Map<string, string>()

  for (const line of metadataLines) {
    const match = line.match(/^([A-Za-z][A-Za-z ]*):\s*(.*)$/)
    if (!match) {
      continue
    }

    const key = match[1].trim().toLowerCase()
    if (!titleKeys.has(key)) {
      continue
    }

    const value = match[2].trim()
    metadata.set(key, value)
  }

  const bodyResult = parseFountainBody(bodyLines.join('\n'))
  project.blocks = bodyResult.blocks

  const title = metadata.get('title')
  if (title) {
    project.meta.title = sanitizeTitle(title)
  }

  const author = metadata.get('author') ?? metadata.get('authors')
  if (author) {
    project.meta.author = compactText(author)
  }

  const credit = metadata.get('credit')
  if (credit) {
    project.meta.credits = compactText(credit)
  }

  const draftDate = metadata.get('draft date')
  if (draftDate) {
    project.meta.draftDate = compactText(draftDate)
  }

  const contact = metadata.get('contact')
  if (contact) {
    project.meta.contact = compactText(contact)
  }

  return {
    data: project,
    warnings: bodyResult.warnings,
  }
}

export const inferBlockTypeFromContinuousText = (
  segment: string,
  previousType: BlockType,
): BlockType => {
  const compacted = compactText(segment)
  if (!compacted) {
    return 'action'
  }

  if (/^\[\[[\s\S]*\]\]$/.test(compacted)) {
    return 'note'
  }

  if (isSceneHeading(compacted)) {
    return 'scene-heading'
  }

  if (/^\(.+\)$/.test(compacted)) {
    return 'parenthetical'
  }

  if (isTransition(compacted)) {
    return 'transition'
  }

  if (isCharacterCue(compacted)) {
    return 'character'
  }

  if (previousType === 'character' || previousType === 'parenthetical') {
    return 'dialogue'
  }

  return 'action'
}
