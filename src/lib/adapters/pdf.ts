import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { ScriptProject } from '../../types/screenplay'
import { paginateProjectForPrint } from './pagination'

export const exportProjectToPdf = async (
  project: ScriptProject,
): Promise<ArrayBuffer> => {
  const layout = paginateProjectForPrint(project)
  const document = await PDFDocument.create()
  const regularFont = await document.embedFont(StandardFonts.Courier)
  const boldFont = await document.embedFont(StandardFonts.CourierBold)

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
      page.drawText(line.text, {
        x: line.x,
        y: line.y,
        size: line.fontSize,
        font: line.bold ? boldFont : regularFont,
      })
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
