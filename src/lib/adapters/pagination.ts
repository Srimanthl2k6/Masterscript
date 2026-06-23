import type {
  BlockType,
  RevisionColor,
  ScriptBlock,
  ScriptProject,
} from '../../types/screenplay'
import { compactText, sanitizeTitle } from './normalize'

interface BlockRenderStyle {
  indent: number
  maxWidth: number
  uppercase: boolean
  bold: boolean
  rightAligned: boolean
  spacingBefore: number
  spacingAfter: number
}

export type PrintLayoutLineRole =
  | 'title'
  | 'title-meta'
  | 'header'
  | 'footer'
  | 'scene-number'
  | 'revision-mark'
  | 'body'

export interface PrintLayoutLine {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  bold: boolean
  role: PrintLayoutLineRole
  pageIndex: number
  blockId?: string
  blockType?: BlockType
  sourceStart?: number
  sourceEnd?: number
}

export interface PrintLayoutPage {
  index: number
  kind: 'title' | 'script'
  scriptPageNumber: number | null
  revisionColor?: RevisionColor | null
  lines: PrintLayoutLine[]
}

export interface PrintLayoutConfig {
  pageWidth: number
  pageHeight: number
  marginLeft: number
  marginRight: number
  marginTop: number
  marginBottom: number
  fontSize: number
  lineHeight: number
  titleFontSize: number
  headerFooterFontSize: number
  charWidthFactor: number
  includeTitlePage: boolean
  showPageNumbers: boolean
  showSceneNumbers: boolean
  showDraftDate: boolean
}

export interface PrintLayoutResult {
  config: PrintLayoutConfig
  pages: PrintLayoutPage[]
}

export const DEFAULT_PRINT_LAYOUT_CONFIG: PrintLayoutConfig = {
  pageWidth: 612,
  pageHeight: 792,
  marginLeft: 108,
  marginRight: 64,
  marginTop: 108,
  marginBottom: 54,
  fontSize: 12,
  lineHeight: 13,
  titleFontSize: 24,
  headerFooterFontSize: 10,
  charWidthFactor: 0.6,
  includeTitlePage: true,
  showPageNumbers: true,
  showSceneNumbers: false,
  showDraftDate: false,
}

const measureMonospaceWidth = (
  value: string,
  fontSize: number,
  charWidthFactor: number,
): number => value.length * fontSize * charWidthFactor

const widthToMaxChars = (
  width: number,
  fontSize: number,
  charWidthFactor: number,
): number => {
  if (width <= 0) {
    return 1
  }

  return Math.max(1, Math.floor(width / (fontSize * charWidthFactor)))
}

const splitLongWord = (word: string, maxChars: number): string[] => {
  if (word.length <= maxChars) {
    return [word]
  }

  const chunks: string[] = []
  let cursor = 0

  while (cursor < word.length) {
    chunks.push(word.slice(cursor, cursor + maxChars))
    cursor += maxChars
  }

  return chunks.length > 0 ? chunks : [word]
}

const wrapParagraph = (paragraph: string, maxChars: number): string[] => {
  const words = paragraph.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return []
  }

  const lines: string[] = []
  let current = ''

  for (const rawWord of words) {
    const segments = splitLongWord(rawWord, maxChars)

    for (const word of segments) {
      const candidate = current ? `${current} ${word}` : word
      if (!current || candidate.length <= maxChars) {
        current = candidate
        continue
      }

      lines.push(current)
      current = word
    }
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

const wrapBlockText = (text: string, maxChars: number): string[] => {
  const paragraphs = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (paragraphs.length === 0) {
    return []
  }

  const lines: string[] = []
  for (const paragraph of paragraphs) {
    lines.push(...wrapParagraph(paragraph, maxChars))
  }

  return lines
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getBlockStyle = (
  type: BlockType,
  contentWidth: number,
  block?: Pick<ScriptBlock, 'dualDialogueSide'>,
): BlockRenderStyle => {
  if (block?.dualDialogueSide) {
    const isRight = block.dualDialogueSide === 'right'
    const columnIndent = isRight ? 270 : 48
    const base = getBlockStyle(type, contentWidth)
    return {
      ...base,
      indent:
        type === 'character'
          ? columnIndent + 46
          : type === 'parenthetical'
            ? columnIndent + 24
            : columnIndent,
      maxWidth: 170,
      rightAligned: false,
    }
  }

  switch (type) {
    case 'scene-heading':
      return {
        indent: 0,
        maxWidth: contentWidth,
        uppercase: true,
        bold: true,
        rightAligned: false,
        spacingBefore: 6,
        spacingAfter: 8,
      }
    case 'character':
      return {
        indent: 137,
        maxWidth: 160,
        uppercase: true,
        bold: true,
        rightAligned: false,
        spacingBefore: 8,
        spacingAfter: 2,
      }
    case 'dialogue':
      return {
        indent: 65,
        maxWidth: 300,
        uppercase: false,
        bold: false,
        rightAligned: false,
        spacingBefore: 0,
        spacingAfter: 7,
      }
    case 'parenthetical':
      return {
        indent: 101,
        maxWidth: 220,
        uppercase: false,
        bold: false,
        rightAligned: false,
        spacingBefore: 0,
        spacingAfter: 4,
      }
    case 'transition':
      return {
        indent: 0,
        maxWidth: contentWidth,
        uppercase: true,
        bold: true,
        rightAligned: true,
        spacingBefore: 8,
        spacingAfter: 8,
      }
    case 'shot':
    case 'super':
    case 'insert':
    case 'intercut':
    case 'flashback':
    case 'end-flashback':
    case 'montage':
    case 'end-montage':
      return {
        indent: 0,
        maxWidth: contentWidth,
        uppercase: true,
        bold: true,
        rightAligned: false,
        spacingBefore: 6,
        spacingAfter: 8,
      }
    case 'note':
      return {
        indent: 24,
        maxWidth: contentWidth - 24,
        uppercase: false,
        bold: false,
        rightAligned: false,
        spacingBefore: 2,
        spacingAfter: 6,
      }
    case 'action':
    default:
      return {
        indent: 0,
        maxWidth: contentWidth,
        uppercase: false,
        bold: false,
        rightAligned: false,
        spacingBefore: 2,
        spacingAfter: 6,
      }
  }
}

const centerX = (
  value: string,
  pageWidth: number,
  fontSize: number,
  charWidthFactor: number,
  minX: number,
): number => {
  const width = measureMonospaceWidth(value, fontSize, charWidthFactor)
  return Math.max(minX, (pageWidth - width) / 2)
}

const rightAlignX = (
  value: string,
  pageWidth: number,
  marginRight: number,
  fontSize: number,
  charWidthFactor: number,
): number =>
  pageWidth -
  marginRight -
  measureMonospaceWidth(value, fontSize, charWidthFactor)

export const paginateProjectForPrint = (
  project: ScriptProject,
  overrides: Partial<PrintLayoutConfig> = {},
): PrintLayoutResult => {
  const config: PrintLayoutConfig = {
    ...DEFAULT_PRINT_LAYOUT_CONFIG,
    includeTitlePage: project.meta.includeTitlePage,
    showPageNumbers: project.meta.showPageNumbers,
    showSceneNumbers: project.meta.showSceneNumbers,
    ...overrides,
  }

  const contentWidth = config.pageWidth - config.marginLeft - config.marginRight
  const pages: PrintLayoutPage[] = []
  let scriptPageCounter = 1
  let lineCounter = 0
  const preparedBlocks = project.blocks.map((block) => {
    const cleaned = compactText(block.text)
    const style = getBlockStyle(block.type, contentWidth, block)
    const content = style.uppercase ? cleaned.toUpperCase() : cleaned
    const maxChars = widthToMaxChars(
      style.maxWidth,
      config.fontSize,
      config.charWidthFactor,
    )

    const lines = wrapBlockText(content, maxChars)
    const source = style.uppercase ? block.text.toUpperCase() : block.text
    let sourceOffset = 0
    const lineOffsets = lines.map((line) => {
      if (!block.formatRanges?.length) {
        return { start: undefined, end: undefined }
      }
      const pattern = line
        .split(/\s+/)
        .map(escapeRegExp)
        .join('\\s+')
      const match = source.slice(sourceOffset).match(new RegExp(pattern))
      const start = match?.index === undefined ? sourceOffset : sourceOffset + match.index
      const end = start + (match?.[0].length ?? line.length)
      sourceOffset = end
      return {
        start,
        end,
      }
    })

    return {
      block,
      cleaned,
      style,
      lines,
      lineOffsets,
    }
  })
  const nextPrintableBlockIndex = new Array<number | null>(
    preparedBlocks.length,
  ).fill(null)
  let nextPrintableIndex: number | null = null

  for (let blockIndex = preparedBlocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
    nextPrintableBlockIndex[blockIndex] = nextPrintableIndex
    if (preparedBlocks[blockIndex].lines.length > 0) {
      nextPrintableIndex = blockIndex
    }
  }

  const minimumPlacementHeight = (blockIndex: number): number => {
    const prepared = preparedBlocks[blockIndex]
    if (!prepared || prepared.lines.length === 0) {
      return 0
    }

    const { block, style } = prepared
    let height = style.spacingBefore + config.lineHeight
    const followingPrintableIndex = nextPrintableBlockIndex[blockIndex]
    const followingPrintable =
      followingPrintableIndex === null
        ? null
        : preparedBlocks[followingPrintableIndex]

    if (
      block.type === 'character' &&
      followingPrintable &&
      (followingPrintable.block.type === 'dialogue' ||
        followingPrintable.block.type === 'parenthetical')
    ) {
      height +=
        style.spacingAfter +
        followingPrintable.style.spacingBefore +
        config.lineHeight
    }

    return height
  }

  const addPage = (kind: 'title' | 'script'): PrintLayoutPage => {
    const page: PrintLayoutPage = {
      index: pages.length,
      kind,
      scriptPageNumber: kind === 'script' ? scriptPageCounter++ : null,
      revisionColor:
        kind === 'script' && project.meta.revisionMode ? project.meta.activeRevision : null,
      lines: [],
    }

    pages.push(page)
    return page
  }

  const pushLine = (
    page: PrintLayoutPage,
    line: Omit<PrintLayoutLine, 'id' | 'pageIndex'>,
  ) => {
    lineCounter += 1
    page.lines.push({
      id: `line-${page.index}-${lineCounter}`,
      pageIndex: page.index,
      ...line,
    })
  }

  const addScriptHeaderAndFooter = (page: PrintLayoutPage) => {
    const title = sanitizeTitle(project.meta.title).toUpperCase()
    const headerY = config.pageHeight - config.marginTop / 2

    pushLine(page, {
      text: title,
      x: config.marginLeft,
      y: headerY,
      fontSize: config.headerFooterFontSize,
      bold: false,
      role: 'header',
    })

    const draftDate = config.showDraftDate ? compactText(project.meta.draftDate) : ''
    if (draftDate) {
      pushLine(page, {
        text: draftDate,
        x: rightAlignX(
          draftDate,
          config.pageWidth,
          config.marginRight,
          config.headerFooterFontSize,
          config.charWidthFactor,
        ),
        y: headerY,
        fontSize: config.headerFooterFontSize,
        bold: false,
        role: 'header',
      })
    }

    if (config.showPageNumbers && page.scriptPageNumber !== null) {
      const pageLabel = String(page.scriptPageNumber)
      pushLine(page, {
        text: pageLabel,
        x: rightAlignX(
          pageLabel,
          config.pageWidth,
          config.marginRight,
          config.headerFooterFontSize,
          config.charWidthFactor,
        ),
        y: config.marginBottom / 2,
        fontSize: config.headerFooterFontSize,
        bold: false,
        role: 'footer',
      })
    }
  }

  if (config.includeTitlePage) {
    const titlePage = addPage('title')
    const title = sanitizeTitle(project.meta.title).toUpperCase()
    const credits = compactText(project.meta.credits)
    const author = compactText(project.meta.author)
    const contact = compactText(project.meta.contact)
    const draftDate = compactText(project.meta.draftDate)
    const notes = compactText(project.meta.titlePageNotes)

    const titleY = config.pageHeight * 0.68
    pushLine(titlePage, {
      text: title,
      x: centerX(
        title,
        config.pageWidth,
        config.titleFontSize,
        config.charWidthFactor,
        config.marginLeft,
      ),
      y: titleY,
      fontSize: config.titleFontSize,
      bold: true,
      role: 'title',
    })

    if (credits) {
      pushLine(titlePage, {
        text: credits,
        x: centerX(
          credits,
          config.pageWidth,
          config.fontSize,
          config.charWidthFactor,
          config.marginLeft,
        ),
        y: titleY - 56,
        fontSize: config.fontSize,
        bold: false,
        role: 'title-meta',
      })
    }

    if (author) {
      const maxChars = widthToMaxChars(
        contentWidth,
        config.fontSize,
        config.charWidthFactor,
      )
      const authorLines = wrapParagraph(author, maxChars)
      authorLines.forEach((line, index) => {
        pushLine(titlePage, {
          text: line,
          x: centerX(
            line,
            config.pageWidth,
            config.fontSize,
            config.charWidthFactor,
            config.marginLeft,
          ),
          y: titleY - 78 - index * config.lineHeight,
          fontSize: config.fontSize,
          bold: false,
          role: 'title-meta',
        })
      })
    }

    if (notes) {
      const maxChars = widthToMaxChars(
        contentWidth * 0.7,
        config.fontSize,
        config.charWidthFactor,
      )
      const noteLines = wrapParagraph(notes, maxChars)
      noteLines.slice(0, 6).forEach((line, index) => {
        pushLine(titlePage, {
          text: line,
          x: centerX(
            line,
            config.pageWidth,
            config.fontSize,
            config.charWidthFactor,
            config.marginLeft,
          ),
          y: config.pageHeight * 0.34 - index * config.lineHeight,
          fontSize: config.fontSize,
          bold: false,
          role: 'title-meta',
        })
      })
    }

    if (contact) {
      const maxChars = widthToMaxChars(
        contentWidth * 0.45,
        config.fontSize,
        config.charWidthFactor,
      )
      const contactLines = wrapParagraph(contact, maxChars)
      contactLines.slice(0, 5).forEach((line, index) => {
        pushLine(titlePage, {
          text: line,
          x: config.marginLeft,
          y: config.marginBottom + 86 - index * config.lineHeight,
          fontSize: config.fontSize,
          bold: false,
          role: 'title-meta',
        })
      })
    }

    if (draftDate) {
      pushLine(titlePage, {
        text: draftDate,
        x: rightAlignX(
          draftDate,
          config.pageWidth,
          config.marginRight,
          config.fontSize,
          config.charWidthFactor,
        ),
        y: config.marginBottom + 86,
        fontSize: config.fontSize,
        bold: false,
        role: 'title-meta',
      })
    }
  }

  let activePage = addPage('script')
  addScriptHeaderAndFooter(activePage)
  let y = config.pageHeight - config.marginTop
  let sceneCounter = 0
  let activeDialogueCharacter: string | null = null

  const moveToNextScriptPage = () => {
    activePage = addPage('script')
    addScriptHeaderAndFooter(activePage)
    y = config.pageHeight - config.marginTop
  }

  const pushContinuationCue = (
    text: string,
    block: ScriptBlock,
    style: BlockRenderStyle,
  ) => {
    const x = config.marginLeft + style.indent
    pushLine(activePage, {
      text,
      x,
      y,
      fontSize: config.fontSize,
      bold: true,
      role: 'body',
      blockId: block.id,
      blockType: block.type,
    })
    y -= config.lineHeight
  }

  for (let blockIndex = 0; blockIndex < preparedBlocks.length; blockIndex += 1) {
    const { block, cleaned, style, lines, lineOffsets } = preparedBlocks[blockIndex]
    if (!cleaned) {
      continue
    }

    if (block.type === 'scene-heading') {
      sceneCounter += 1
    }

    if (block.type === 'character') {
      activeDialogueCharacter = cleaned.toUpperCase()
    } else if (
      block.type !== 'dialogue' &&
      block.type !== 'parenthetical'
    ) {
      activeDialogueCharacter = null
    }

    if (lines.length === 0) {
      continue
    }

    let neededHeight = minimumPlacementHeight(blockIndex)
    const followingPrintableIndex = nextPrintableBlockIndex[blockIndex]

    if (block.type === 'scene-heading' && followingPrintableIndex !== null) {
      const sceneHeadingGroupHeight =
        style.spacingBefore +
        lines.length * config.lineHeight +
        style.spacingAfter +
        minimumPlacementHeight(followingPrintableIndex)
      const freshPageY = config.pageHeight - config.marginTop

      if (freshPageY - sceneHeadingGroupHeight >= config.marginBottom) {
        neededHeight = sceneHeadingGroupHeight
      }
    }

    if (y - neededHeight < config.marginBottom) {
      moveToNextScriptPage()
    }

    y -= style.spacingBefore

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex]
      if (y - config.lineHeight < config.marginBottom) {
        if (
          block.type === 'dialogue' &&
          activeDialogueCharacter &&
          lineIndex > 0
        ) {
          const moreStyle = getBlockStyle('parenthetical', contentWidth, block)
          if (y - config.lineHeight >= config.marginBottom) {
            pushContinuationCue('(MORE)', block, moreStyle)
          } else {
            y = config.marginBottom
            pushContinuationCue('(MORE)', block, moreStyle)
          }
        }

        moveToNextScriptPage()

        if (block.type === 'dialogue' && activeDialogueCharacter) {
          const characterStyle = getBlockStyle('character', contentWidth, block)
          pushContinuationCue(`${activeDialogueCharacter} (CONT'D)`, block, characterStyle)
        }
      }

      const textWidth = measureMonospaceWidth(
        line,
        config.fontSize,
        config.charWidthFactor,
      )
      const x = style.rightAligned
        ? config.pageWidth - config.marginRight - textWidth
        : config.marginLeft + style.indent

      pushLine(activePage, {
        text: line,
        x,
        y,
        fontSize: config.fontSize,
        bold: style.bold,
        role: 'body',
        blockId: block.id,
        blockType: block.type,
        sourceStart: lineOffsets[lineIndex]?.start,
        sourceEnd: lineOffsets[lineIndex]?.end,
      })

      if (block.revisionMark) {
        pushLine(activePage, {
          text: '*',
          x: config.pageWidth - config.marginRight + 18,
          y,
          fontSize: config.fontSize,
          bold: true,
          role: 'revision-mark',
          blockId: block.id,
          blockType: block.type,
        })
      }

      if (
        config.showSceneNumbers &&
        block.type === 'scene-heading' &&
        lineIndex === 0
      ) {
        const sceneLabel = String(sceneCounter)
        pushLine(activePage, {
          text: sceneLabel,
          x: Math.max(
            12,
            config.marginLeft -
              measureMonospaceWidth(
                sceneLabel,
                config.headerFooterFontSize,
                config.charWidthFactor,
              ) -
              12,
          ),
          y,
          fontSize: config.headerFooterFontSize,
          bold: false,
          role: 'scene-number',
          blockId: block.id,
          blockType: block.type,
        })
      }

      y -= config.lineHeight
    }

    y -= style.spacingAfter
  }

  return {
    config,
    pages,
  }
}
