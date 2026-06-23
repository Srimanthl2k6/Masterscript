import { formatRuns } from '../lib/richText'
import type { PrintLayoutLine } from '../lib/adapters/pagination'
import type { ScriptBlock } from '../types/screenplay'

interface Props {
  line: PrintLayoutLine
  block?: ScriptBlock
}

export default function FormattedPrintLineText({ line, block }: Props) {
  if (
    !block?.formatRanges?.length ||
    line.sourceStart === undefined ||
    line.sourceEnd === undefined
  ) {
    return line.text
  }
  const sourceLength = Math.max(1, line.sourceEnd - line.sourceStart)
  const ranges = block.formatRanges
    .filter((range) => range.end > line.sourceStart! && range.start < line.sourceEnd!)
    .map((range) => ({
      start: Math.round(
        ((Math.max(range.start, line.sourceStart!) - line.sourceStart!) /
          sourceLength) *
          line.text.length,
      ),
      end: Math.round(
        ((Math.min(range.end, line.sourceEnd!) - line.sourceStart!) /
          sourceLength) *
          line.text.length,
      ),
      format: range.format,
    }))
  return formatRuns(line.text, ranges).map((run) => (
    <span
      key={`${line.id}-${run.start}-${run.end}`}
      style={{
        fontFamily: run.format.fontFamily
          ? `"${run.format.fontFamily}", "Courier Prime", monospace`
          : undefined,
        fontStyle: run.format.italic ? 'italic' : undefined,
        fontWeight: run.format.bold ? 700 : undefined,
        letterSpacing: run.format.letterSpacing ? '0.08em' : undefined,
        textDecoration: run.format.underline ? 'underline' : undefined,
      }}
    >
      {run.text}
    </span>
  ))
}
