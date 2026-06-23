import { createBlock, createEmptyProject } from '../screenplay'
import type {
  ScriptProject,
  TextFormat,
  TextFormatRange,
} from '../../types/screenplay'
import { AdapterParseError, AdapterValidationError } from './errors'
import {
  compactText,
  decodeEntities,
  escapeXml,
  mapBlockTypeToFdxType,
  mapFdxTypeToBlockType,
  sanitizeTitle,
  stripHtmlTags,
} from './normalize'
import type { ScriptProjectAdapterResult } from './types'
import { formatRuns } from '../richText'

const paragraphPattern = /<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/gi
const textPattern = /<Text\b([^>]*)>([\s\S]*?)<\/Text>/gi

const extractTextFormat = (attributes: string): TextFormat => {
  const style = attributes.match(/Style="([^"]+)"/i)?.[1] ?? ''
  const fontFamily = attributes.match(/Font="([^"]+)"/i)?.[1]
  return {
    bold: /\bBold\b/i.test(style) || undefined,
    italic: /\bItalic\b/i.test(style) || undefined,
    underline: /\bUnderline\b/i.test(style) || undefined,
    letterSpacing: /Tracking="(?!0\b)[^"]+"/i.test(attributes) || undefined,
    fontFamily,
  }
}

const extractParagraphText = (
  paragraphContent: string,
): { text: string; formatRanges: TextFormatRange[] } => {
  const textNodes = [...paragraphContent.matchAll(textPattern)]
  if (textNodes.length === 0) {
    return { text: stripHtmlTags(paragraphContent), formatRanges: [] }
  }

  let text = ''
  const formatRanges: TextFormatRange[] = []
  for (const match of textNodes) {
    const value = decodeEntities(match[2] ?? '')
    if (text && value && !/\s$/.test(text) && !/^\s/.test(value)) {
      text += ' '
    }
    const start = text.length
    text += value
    const format = extractTextFormat(match[1] ?? '')
    if (value && Object.values(format).some(Boolean)) {
      formatRanges.push({ start, end: text.length, format })
    }
  }
  return { text: compactText(text), formatRanges }
}

const extractParagraphType = (rawAttributes: string): string => {
  const typeMatch = rawAttributes.match(/Type="([^"]+)"/i)
  return compactText(typeMatch?.[1] ?? '')
}

const extractTitle = (xml: string): string => {
  const titleMatch = xml.match(/<Title\b[^>]*>([\s\S]*?)<\/Title>/i)
  if (titleMatch?.[1]) {
    return sanitizeTitle(stripHtmlTags(titleMatch[1]))
  }

  const firstTitleText = xml.match(
    /<TitlePage[\s\S]*?<Text\b[^>]*>([\s\S]*?)<\/Text>/i,
  )
  return sanitizeTitle(firstTitleText?.[1])
}

export const importFdxProject = (xml: string): ScriptProjectAdapterResult => {
  if (!compactText(xml)) {
    throw new AdapterParseError('FDX input was empty.')
  }

  if (!/<FinalDraft\b/i.test(xml)) {
    throw new AdapterParseError('The selected file does not appear to be a Final Draft FDX file.')
  }

  const warnings: ScriptProjectAdapterResult['warnings'] = []
  const blocks = [...xml.matchAll(paragraphPattern)]
    .map((match) => {
      const attributes = match[1] ?? ''
      const body = match[2] ?? ''
      const { text, formatRanges } = extractParagraphText(body)
      if (!text) {
        return null
      }

      const { blockType, warning } = mapFdxTypeToBlockType(extractParagraphType(attributes))
      if (warning) {
        warnings.push(warning)
      }

      return { ...createBlock(blockType, text), formatRanges }
    })
    .filter((block): block is NonNullable<typeof block> => block !== null)

  if (blocks.length === 0) {
    throw new AdapterValidationError('No screenplay paragraphs were found in the FDX file.')
  }

  const imported = createEmptyProject()
  imported.meta.title = extractTitle(xml)
  imported.blocks = blocks
  imported.cards = []
  imported.production.schedule = []
  imported.production.breakdown = []
  imported.budget.items = []
  imported.storyboards = []
  imported.catalog = []

  return {
    data: imported,
    warnings,
  }
}

export const exportProjectToFdx = (project: ScriptProject): string => {
  const paragraphs = project.blocks
    .map((block) => {
      const type = mapBlockTypeToFdxType(block.type)
      const textRuns = formatRuns(block.text, block.formatRanges)
        .map((run) => {
          const style = [
            run.format.bold ? 'Bold' : '',
            run.format.italic ? 'Italic' : '',
            run.format.underline ? 'Underline' : '',
          ].filter(Boolean).join('+')
          const attributes = [
            style ? ` Style="${style}"` : '',
            run.format.fontFamily
              ? ` Font="${escapeXml(run.format.fontFamily)}"`
              : '',
            run.format.letterSpacing ? ' Tracking="80"' : '',
          ].join('')
          return `<Text${attributes}>${escapeXml(run.text)}</Text>`
        })
        .join('')
      return `      <Paragraph Type="${type}">${textRuns}</Paragraph>`
    })
    .join('\n')

  const title = escapeXml(project.meta.title)

  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
  <TitlePage>
    <Content>
      <Paragraph Type="Title"><Text>${title}</Text></Paragraph>
    </Content>
  </TitlePage>
  <Content>
${paragraphs}
  </Content>
</FinalDraft>
`
}
