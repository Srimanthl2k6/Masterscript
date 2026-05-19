import { createBlock, createEmptyProject } from '../screenplay'
import type { ScriptProject } from '../../types/screenplay'
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

const paragraphPattern = /<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/gi
const textPattern = /<Text\b[^>]*>([\s\S]*?)<\/Text>/gi

const extractParagraphText = (paragraphContent: string): string => {
  const textNodes = [...paragraphContent.matchAll(textPattern)]
  if (textNodes.length === 0) {
    return stripHtmlTags(paragraphContent)
  }

  const merged = textNodes.map((match) => decodeEntities(match[1] ?? '')).join(' ')
  return compactText(merged)
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
      const text = extractParagraphText(body)
      if (!text) {
        return null
      }

      const { blockType, warning } = mapFdxTypeToBlockType(extractParagraphType(attributes))
      if (warning) {
        warnings.push(warning)
      }

      return createBlock(blockType, text)
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
      const text = escapeXml(block.text)
      return `      <Paragraph Type="${type}"><Text>${text}</Text></Paragraph>`
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
