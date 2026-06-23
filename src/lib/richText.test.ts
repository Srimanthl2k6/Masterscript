import { describe, expect, it } from 'vitest'
import {
  applyFormatPatch,
  deriveTextEdit,
  formatAtOffset,
  formatRuns,
  updateRangesForEdits,
  updateRangesForTextEdit,
} from './richText'
import type { TextFormatRange } from '../types/screenplay'

describe('rich text formatting ranges', () => {
  it('creates normalized mixed-style ranges for selected text', () => {
    const ranges = applyFormatPatch([], 2, 7, { bold: true }, 10)
    const underlined = applyFormatPatch(
      ranges,
      5,
      9,
      { underline: true },
      10,
    )

    expect(underlined).toEqual([
      { start: 2, end: 5, format: { bold: true } },
      {
        start: 5,
        end: 7,
        format: { bold: true, underline: true },
      },
      { start: 7, end: 9, format: { underline: true } },
    ])
  })

  it('toggles an already active selected style off', () => {
    const ranges: TextFormatRange[] = [
      { start: 0, end: 5, format: { italic: true } },
    ]

    expect(applyFormatPatch(ranges, 1, 4, { italic: false }, 5)).toEqual([
      { start: 0, end: 1, format: { italic: true } },
      { start: 4, end: 5, format: { italic: true } },
    ])
  })

  it('shifts ranges after insertion and applies future typing format', () => {
    const ranges: TextFormatRange[] = [
      { start: 0, end: 4, format: { bold: true } },
      { start: 4, end: 8, format: { italic: true } },
    ]

    expect(
      updateRangesForTextEdit(
        'ABCDEFGH',
        'ABxxCDEFGH',
        ranges,
        { underline: true },
      ),
    ).toEqual([
      { start: 0, end: 2, format: { bold: true } },
      {
        start: 2,
        end: 4,
        format: { bold: true, underline: true },
      },
      { start: 4, end: 6, format: { bold: true } },
      { start: 6, end: 10, format: { italic: true } },
    ])
  })

  it('clips and shifts ranges after replacing selected text', () => {
    const ranges: TextFormatRange[] = [
      { start: 0, end: 3, format: { bold: true } },
      { start: 3, end: 8, format: { italic: true } },
    ]

    expect(updateRangesForTextEdit('ABCDEFGH', 'ABZZGH', ranges)).toEqual([
      { start: 0, end: 2, format: { bold: true } },
      { start: 4, end: 6, format: { italic: true } },
    ])
  })

  it('returns formatting at the caret and plain/styled render runs', () => {
    const ranges: TextFormatRange[] = [
      {
        start: 1,
        end: 3,
        format: { fontFamily: 'Inter', letterSpacing: true },
      },
    ]

    expect(formatAtOffset(ranges, 2)).toEqual({
      fontFamily: 'Inter',
      letterSpacing: true,
    })
    expect(formatRuns('ABCD', ranges)).toEqual([
      { start: 0, end: 1, text: 'A', format: {} },
      {
        start: 1,
        end: 3,
        text: 'BC',
        format: { fontFamily: 'Inter', letterSpacing: true },
      },
      { start: 3, end: 4, text: 'D', format: {} },
    ])
  })

  it('derives the smallest replacement between two text values', () => {
    expect(deriveTextEdit('Hello brave world', 'Hello bright world')).toEqual({
      start: 8,
      end: 11,
      insertedText: 'ight',
    })
  })

  it('preserves formatting around multiple replacements', () => {
    expect(
      updateRangesForEdits(
        'RED then RED',
        [{ start: 0, end: 12, format: { bold: true } }],
        [
          { start: 0, end: 3, insertedText: 'BLUE' },
          { start: 9, end: 12, insertedText: 'BLUE' },
        ],
      ),
    ).toEqual({
      text: 'BLUE then BLUE',
      ranges: [{ start: 0, end: 14, format: { bold: true } }],
    })
  })
})
