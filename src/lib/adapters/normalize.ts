import type { BlockType } from '../../types/screenplay'
import type { AdapterWarning } from './types'

const fdxTypeMap: Record<string, BlockType> = {
  'scene heading': 'scene-heading',
  action: 'action',
  character: 'character',
  dialogue: 'dialogue',
  parenthetical: 'parenthetical',
  transition: 'transition',
  shot: 'shot',
  super: 'super',
  insert: 'insert',
  intercut: 'intercut',
  flashback: 'flashback',
  'end flashback': 'end-flashback',
  montage: 'montage',
  'end montage': 'end-montage',
  note: 'note',
}

const blockTypeToFdxMap: Record<BlockType, string> = {
  'scene-heading': 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
  shot: 'Shot',
  super: 'Action',
  insert: 'Action',
  intercut: 'Action',
  flashback: 'Action',
  'end-flashback': 'Action',
  montage: 'Action',
  'end-montage': 'Action',
  card: 'Action',
  title: 'Action',
  chyron: 'Action',
  crawl: 'Action',
  prelap: 'Action',
  'audio-description': 'Action',
  recap: 'Action',
  'two-column-av': 'Action',
  'cold-open': 'Action',
  'act-break': 'Action',
  'title-over-black': 'Action',
  'over-black': 'Action',
  'the-end': 'Action',
  note: 'Action',
}

export const compactText = (value: string): string =>
  value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()

export const sanitizeTitle = (value: string | null | undefined): string => {
  const cleaned = compactText(value ?? '')
  return cleaned || 'Imported Screenplay'
}

export const decodeEntities = (value: string): string =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const stripHtmlTags = (value: string): string =>
  compactText(
    decodeEntities(
      value
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<[^>]+>/g, ' '),
    ),
  )

export const mapFdxTypeToBlockType = (
  typeValue: string,
): { blockType: BlockType; warning?: AdapterWarning } => {
  const normalized = compactText(typeValue).toLowerCase()
  const mapped = fdxTypeMap[normalized]

  if (mapped) {
    return { blockType: mapped }
  }

  return {
    blockType: 'action',
    warning: {
      code: 'UNMAPPED_FDX_TYPE',
      message: `Unmapped FDX paragraph type "${typeValue}" was imported as Action.`,
    },
  }
}

export const mapBlockTypeToFdxType = (type: BlockType): string =>
  blockTypeToFdxMap[type]

const looksLikeCharacterName = (text: string): boolean => {
  if (!text || text.length > 42) {
    return false
  }

  if (!/^[A-Z0-9 .\-()']+$/.test(text)) {
    return false
  }

  return text === text.toUpperCase()
}

export const inferBlockTypeFromDocxText = (
  text: string,
  sourceTag?: string,
): BlockType => {
  const compacted = compactText(text)
  const upper = compacted.toUpperCase()

  if (!compacted) {
    return 'action'
  }

  if (sourceTag && /^h[1-6]$/i.test(sourceTag)) {
    return 'scene-heading'
  }

  if (/^(INT\.|EXT\.|INT\/EXT\.|EST\.)/.test(upper)) {
    return 'scene-heading'
  }

  if (/^\(.+\)$/.test(compacted)) {
    return 'parenthetical'
  }

  if (
    /TO:$/.test(upper) ||
    upper === 'FADE OUT:' ||
    upper === 'CUT TO:' ||
    upper === 'DISSOLVE TO:' ||
    upper === 'SMASH CUT TO:' ||
    upper === 'MATCH CUT TO:'
  ) {
    return 'transition'
  }

  if (/^SUPER:?/.test(upper)) {
    return 'super'
  }

  if (/^INSERT\b/.test(upper)) {
    return 'insert'
  }

  if (looksLikeCharacterName(compacted)) {
    return 'character'
  }

  return 'action'
}
