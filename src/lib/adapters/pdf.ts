import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type {
  ScriptProject,
  TextFormatRange,
} from '../../types/screenplay'
import { paginateProjectForPrint } from './pagination'
import { formatRuns } from '../richText'

interface PdfFontLoadResult {
  ok: boolean
  base64?: string
  embeddable?: boolean
  error?: string
}

interface PdfExportOptions {
  loadFont?: (family: string, style: string) => Promise<PdfFontLoadResult>
  onWarning?: (warning: string) => void
}

const base64Bytes = (value: string): Uint8Array => {
  const decoded = globalThis.atob(value)
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

const fontStyle = (
  bold: boolean,
  italic: boolean,
): 'regular' | 'bold' | 'italic' | 'bold-italic' =>
  bold ? (italic ? 'bold-italic' : 'bold') : italic ? 'italic' : 'regular'

const lineRanges = (
  line: ReturnType<typeof paginateProjectForPrint>['pages'][number]['lines'][number],
  project: ScriptProject,
): TextFormatRange[] => {
  if (
    !line.blockId ||
    line.sourceStart === undefined ||
    line.sourceEnd === undefined
  ) {
    return []
  }
  const block = project.blocks.find((candidate) => candidate.id === line.blockId)
  if (!block?.formatRanges?.length) {
    return []
  }
  const sourceLength = Math.max(1, line.sourceEnd - line.sourceStart)
  return block.formatRanges
    .filter(
      (range) =>
        range.end > (line.sourceStart ?? 0) &&
        range.start < (line.sourceEnd ?? 0),
    )
    .map((range) => ({
      start: Math.round(
        ((Math.max(range.start, line.sourceStart ?? 0) -
          (line.sourceStart ?? 0)) /
          sourceLength) *
          line.text.length,
      ),
      end: Math.round(
        ((Math.min(range.end, line.sourceEnd ?? 0) -
          (line.sourceStart ?? 0)) /
          sourceLength) *
          line.text.length,
      ),
      format: range.format,
    }))
}

export const exportProjectToPdf = async (
  project: ScriptProject,
  options: PdfExportOptions = {},
): Promise<ArrayBuffer> => {
  const layout = paginateProjectForPrint(project)
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const regularFont = await document.embedFont(StandardFonts.Courier)
  const boldFont = await document.embedFont(StandardFonts.CourierBold)
  const italicFont = await document.embedFont(StandardFonts.CourierOblique)
  const boldItalicFont = await document.embedFont(StandardFonts.CourierBoldOblique)
  const customFonts = new Map<string, Awaited<ReturnType<typeof document.embedFont>>>()

  if (options.loadFont) {
    const requests = new Set<string>()
    for (const block of project.blocks) {
      for (const range of block.formatRanges ?? []) {
        if (range.format.fontFamily) {
          requests.add(
            `${range.format.fontFamily}\u0000${fontStyle(
              range.format.bold === true,
              range.format.italic === true,
            )}`,
          )
        }
      }
    }
    for (const request of requests) {
      const [family, style] = request.split('\u0000')
      const result = await options.loadFont(family, style)
      if (!result.ok || !result.base64 || result.embeddable !== true) {
        options.onWarning?.(
          `${family} (${style}) could not be embedded; Courier Prime fallback was used.`,
        )
        continue
      }
      try {
        customFonts.set(
          request,
          await document.embedFont(base64Bytes(result.base64), { subset: true }),
        )
      } catch {
        options.onWarning?.(
          `${family} (${style}) could not be embedded; Courier Prime fallback was used.`,
        )
      }
    }
  }

  for (const layoutPage of layout.pages) {
    const page = document.addPage([layout.config.pageWidth, layout.config.pageHeight])

    if (layoutPage.revisionColor && layoutPage.revisionColor !== 'white') {
      const tint = revisionTint(layoutPage.revisionColor)
      page.drawRectangle({
        x: 0,
        y: 0,
        width: layout.config.pageWidth,
        height: layout.config.pageHeight,
        color: tint,
      })
    }

    for (const line of layoutPage.lines) {
      const runs = formatRuns(line.text, lineRanges(line, project))
      let x = line.x
      for (const run of runs) {
        const bold = line.bold || run.format.bold === true
        const italic = run.format.italic === true
        const style = fontStyle(bold, italic)
        const customKey = run.format.fontFamily
          ? `${run.format.fontFamily}\u0000${style}`
          : ''
        const font =
          customFonts.get(customKey) ??
          (bold
            ? italic
              ? boldItalicFont
              : boldFont
            : italic
              ? italicFont
              : regularFont)
        const letterSpacing = run.format.letterSpacing ? line.fontSize * 0.08 : 0
        let width = 0
        if (letterSpacing > 0) {
          for (const [characterIndex, character] of [...run.text].entries()) {
            page.drawText(character, {
              x: x + width,
              y: line.y,
              size: line.fontSize,
              font,
            })
            width += font.widthOfTextAtSize(character, line.fontSize)
            if (characterIndex < [...run.text].length - 1) {
              width += letterSpacing
            }
          }
        } else {
          page.drawText(run.text, {
            x,
            y: line.y,
            size: line.fontSize,
            font,
          })
          width = font.widthOfTextAtSize(run.text, line.fontSize)
        }
        if (run.format.underline) {
          page.drawLine({
            start: { x, y: line.y - 1.5 },
            end: { x: x + width, y: line.y - 1.5 },
            thickness: 0.7,
          })
        }
        x += width
      }
    }
  }

  const bytes = await document.save()
  return Uint8Array.from(bytes).buffer
}

const revisionTint = (color: string) => {
  switch (color) {
    case 'blue':
      return rgb(0.92, 0.96, 1)
    case 'pink':
      return rgb(1, 0.93, 0.97)
    case 'yellow':
      return rgb(1, 0.98, 0.86)
    case 'green':
      return rgb(0.91, 0.98, 0.92)
    case 'goldenrod':
      return rgb(1, 0.95, 0.78)
    case 'buff':
      return rgb(0.98, 0.94, 0.84)
    case 'salmon':
      return rgb(1, 0.9, 0.86)
    case 'cherry':
      return rgb(1, 0.88, 0.91)
    case 'tan':
      return rgb(0.95, 0.9, 0.82)
    default:
      return rgb(1, 1, 1)
  }
}
