import type { Dispatch, SetStateAction } from 'react'
import type { ScriptBlock, ScriptProject, TextFormat } from '../types/screenplay'
import { applyFormatPatch, formatAtOffset, normalizeTextFormat } from './richText'

interface Selection {
  start: number
  end: number
}

interface Options {
  activeBlock: ScriptBlock | null
  activeSelection: Selection
  commit(updater: (draft: ScriptProject) => void, status: string): void
  fontFamilies: string[]
  futureFormats: Record<string, TextFormat>
  getSelection(blockId: string): Selection
  isDesktop: boolean
  queueFocus(blockId: string, selection: Selection): void
  setFutureFormats: Dispatch<SetStateAction<Record<string, TextFormat>>>
  setStatus(message: string): void
}

export const useTextFormatting = ({
  activeBlock,
  activeSelection,
  commit,
  fontFamilies,
  futureFormats,
  getSelection,
  isDesktop,
  queueFocus,
  setFutureFormats,
  setStatus,
}: Options) => {
  const activeFormat = activeBlock
    ? {
        ...formatAtOffset(
          activeBlock.formatRanges,
          Math.max(0, activeSelection.start - (activeSelection.start > 0 ? 1 : 0)),
        ),
        ...futureFormats[activeBlock.id],
      }
    : {}
  const applyTextFormatting = (
    property: 'bold' | 'italic' | 'underline' | 'letterSpacing',
  ) => {
    if (!activeBlock) return
    const selection = getSelection(activeBlock.id)
    const current = selection.start === selection.end
      ? {
          ...formatAtOffset(
            activeBlock.formatRanges,
            Math.max(0, selection.start - (selection.start > 0 ? 1 : 0)),
          ),
          ...futureFormats[activeBlock.id],
        }
      : formatAtOffset(activeBlock.formatRanges, selection.start)
    const enabled = current[property] !== true
    if (selection.start === selection.end) {
      setFutureFormats((previous) => ({
        ...previous,
        [activeBlock.id]: normalizeTextFormat({
          ...previous[activeBlock.id],
          [property]: enabled,
        }),
      }))
      setStatus(`${enabled ? 'Enabled' : 'Disabled'} ${property} for typing`)
      return
    }
    commit((draft) => {
      const target = draft.blocks.find((block) => block.id === activeBlock.id)
      if (target) {
        target.formatRanges = applyFormatPatch(
          target.formatRanges,
          selection.start,
          selection.end,
          { [property]: enabled },
          target.text.length,
        )
      }
    }, `${enabled ? 'Applied' : 'Removed'} ${property}`)
    queueFocus(activeBlock.id, selection)
  }

  const applyFontFamily = (fontFamily: string) => {
    if (!activeBlock) return
    if (
      fontFamily &&
      isDesktop &&
      !fontFamilies.some((family) => family.toLowerCase() === fontFamily.toLowerCase())
    ) {
      setStatus(`${fontFamily} is not installed; Courier Prime will be used as fallback`)
    }
    const selection = getSelection(activeBlock.id)
    if (selection.start === selection.end) {
      setFutureFormats((previous) => ({
        ...previous,
        [activeBlock.id]: normalizeTextFormat({
          ...previous[activeBlock.id],
          fontFamily,
        }),
      }))
      return
    }
    commit((draft) => {
      const target = draft.blocks.find((block) => block.id === activeBlock.id)
      if (target) {
        target.formatRanges = applyFormatPatch(
          target.formatRanges,
          selection.start,
          selection.end,
          { fontFamily },
          target.text.length,
        )
      }
    }, fontFamily ? `Applied ${fontFamily}` : 'Cleared font family')
    queueFocus(activeBlock.id, selection)
  }

  const clearTextFormatting = () => {
    if (!activeBlock) return
    const selection = getSelection(activeBlock.id)
    if (selection.start === selection.end) {
      setFutureFormats((previous) => ({ ...previous, [activeBlock.id]: {} }))
      return
    }
    commit((draft) => {
      const target = draft.blocks.find((block) => block.id === activeBlock.id)
      if (target) {
        target.formatRanges = applyFormatPatch(
          target.formatRanges,
          selection.start,
          selection.end,
          {
            bold: false,
            italic: false,
            underline: false,
            letterSpacing: false,
            fontFamily: '',
          },
          target.text.length,
        )
      }
    }, 'Cleared text formatting')
    queueFocus(activeBlock.id, selection)
  }

  return { activeFormat, applyTextFormatting, applyFontFamily, clearTextFormatting }
}
