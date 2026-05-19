import { createBlock, createEmptyProject } from '../screenplay'
import { AdapterParseError, AdapterValidationError } from './errors'
import {
  compactText,
  inferBlockTypeFromDocxText,
  sanitizeTitle,
  stripHtmlTags,
} from './normalize'
import type { ScriptBlock, ScriptProject } from '../../types/screenplay'
import type { ScriptProjectAdapterResult } from './types'

interface MammothMessage {
  type: 'warning' | 'error'
  message: string
}

interface MammothResult {
  value: string
  messages: MammothMessage[]
}

interface MammothLike {
  convertToHtml: (
    input: { arrayBuffer: ArrayBuffer } | { buffer: unknown },
  ) => Promise<MammothResult>
}

const htmlParagraphPattern = /<(p|h[1-6]|li)\b[^>]*>([\s\S]*?)<\/\1>/gi

const resolveMammoth = async (): Promise<MammothLike> => {
  const mammothModule = await import('mammoth')
  const candidate =
    'default' in mammothModule
      ? (mammothModule.default as unknown)
      : (mammothModule as unknown)

  if (
    !candidate ||
    typeof candidate !== 'object' ||
    typeof (candidate as MammothLike).convertToHtml !== 'function'
  ) {
    throw new AdapterParseError('Mammoth could not be loaded for DOCX import.')
  }

  return candidate as MammothLike
}

const paragraphToBlock = (tag: string, rawContent: string): ScriptBlock | null => {
  const text = stripHtmlTags(rawContent)
  if (!text) {
    return null
  }

  const blockType = inferBlockTypeFromDocxText(text, tag)
  return createBlock(blockType, text)
}

const toDocxParagraph = async (project: ScriptProject) => {
  const docxModule = await import('docx')
  const { Paragraph, TextRun, HeadingLevel, AlignmentType } = docxModule

  return project.blocks.map((block) => {
    const commonChildren = [new TextRun(block.text)]

    if (block.type === 'scene-heading') {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: block.text.toUpperCase(), bold: true })],
        spacing: { after: 180 },
      })
    }

    if (block.type === 'character') {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: block.text.toUpperCase(), bold: true })],
        spacing: { before: 120, after: 60 },
      })
    }

    if (block.type === 'dialogue') {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        indent: { left: 1100, right: 1100 },
        children: commonChildren,
        spacing: { after: 80 },
      })
    }

    if (block.type === 'parenthetical') {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        indent: { left: 1400, right: 1400 },
        children: [new TextRun({ text: block.text, italics: true })],
        spacing: { after: 60 },
      })
    }

    if (block.type === 'transition') {
      return new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: block.text.toUpperCase(), bold: true })],
        spacing: { before: 120, after: 180 },
      })
    }

    return new Paragraph({
      children: commonChildren,
      spacing: { after: 120 },
    })
  })
}

export const importDocxProject = async (
  buffer: ArrayBuffer,
): Promise<ScriptProjectAdapterResult> => {
  if (buffer.byteLength === 0) {
    throw new AdapterParseError('DOCX input was empty.')
  }

  const mammoth = await resolveMammoth()
  const globalWithBuffer = globalThis as {
    Buffer?: {
      from: (input: ArrayBuffer) => unknown
    }
  }

  const mammothInput = globalWithBuffer.Buffer
    ? { buffer: globalWithBuffer.Buffer.from(buffer) }
    : { arrayBuffer: buffer }

  const mammothResult = await mammoth.convertToHtml(mammothInput)

  const warnings = mammothResult.messages.map((message) => ({
    code: message.type === 'error' ? 'DOCX_IMPORT_ERROR' : 'DOCX_IMPORT_WARNING',
    message: message.message,
  }))

  const blocks = [...mammothResult.value.matchAll(htmlParagraphPattern)]
    .map((match) => paragraphToBlock(match[1] ?? 'p', match[2] ?? ''))
    .filter((block): block is NonNullable<typeof block> => block !== null)

  if (blocks.length === 0) {
    const fallbackText = compactText(stripHtmlTags(mammothResult.value))
    if (!fallbackText) {
      throw new AdapterValidationError('No screenplay paragraphs were found in the DOCX file.')
    }

    blocks.push(createBlock('action', fallbackText))
    warnings.push({
      code: 'DOCX_FALLBACK_ACTION',
      message: 'DOCX content was imported as a single Action block.',
    })
  }

  const imported = createEmptyProject()
  imported.meta.title = sanitizeTitle(imported.meta.title)
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

export const exportProjectToDocx = async (
  project: ScriptProject,
): Promise<ArrayBuffer> => {
  const docxModule = await import('docx')
  const { Document, Packer } = docxModule

  const children = await toDocxParagraph(project)

  const document = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(document)
  return blob.arrayBuffer()
}
