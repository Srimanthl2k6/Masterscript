import type { ScriptProject, TextFormatRange } from '../types/screenplay'
import { cloneProject, createBlock, nextTypeForEnter } from './screenplay'

const clipRanges = (ranges: TextFormatRange[] | undefined, start: number, end: number): TextFormatRange[] =>
  (ranges ?? []).flatMap(range => {
    const left = Math.max(start, range.start)
    const right = Math.min(end, range.end)
    return right > left ? [{ start: left - start, end: right - start, format: { ...range.format } }] : []
  })

/** A single model transaction, shared by input surfaces and normal project history. */
export const splitBlock = (project: ScriptProject, blockId: string, selection: { start: number; end: number }) => {
  const index = project.blocks.findIndex(block => block.id === blockId)
  const original = project.blocks[index]
  const heading = project.blocks.slice(0, index + 1).findLast(block => block.type === 'scene-heading')
  if (!original || original.locked || original.omitted || heading?.omitted || heading?.locked) {
    return { project, blocked: true, focusBlockId: blockId, selection }
  }
  const clamp = (value: number) => Math.max(0, Math.min(original.text.length, Number.isFinite(value) ? value : 0))
  const start = clamp(Math.min(selection.start, selection.end))
  const end = clamp(Math.max(selection.start, selection.end))
  // A separator space at the split becomes the paragraph boundary. Preserve indentation at offset zero.
  const suffix = original.text.slice(end)
  const rightStart = end + (start > 0 ? suffix.length - suffix.trimStart().length : 0)
  const next = cloneProject(project)
  const left = next.blocks[index]
  left.text = original.text.slice(0, start)
  left.formatRanges = clipRanges(original.formatRanges, 0, start)
  const right = createBlock(nextTypeForEnter(original.type), original.text.slice(rightStart))
  right.formatRanges = clipRanges(original.formatRanges, rightStart, original.text.length)
  right.revision = original.revision
  right.revisionMark = original.revisionMark
  right.lockedPageLabel = original.lockedPageLabel
  if (['character', 'dialogue', 'parenthetical'].includes(original.type)) {
    right.dualDialogueId = original.dualDialogueId
    right.dualDialogueSide = original.dualDialogueSide
  }
  if (next.meta.revisionMode) {
    for (const block of [left, right]) {
      block.revision = next.meta.activeRevision
      block.revisionMark = true
    }
  }
  next.blocks.splice(index + 1, 0, right)
  // Keep manual range anchors attached to the text that actually moved.
  next.tagging.tags = next.tagging.tags.flatMap(tag => {
    if (tag.blockId !== blockId) return [tag]
    const halves = [{ from: 0, to: start, block: left }, { from: rightStart, to: original.text.length, block: right }]
    return halves.flatMap(({ from, to, block }) => {
      const a = Math.max(tag.start, from)
      const b = Math.min(tag.end, to)
      return b > a ? [{ ...tag, id: block === left ? tag.id : `${tag.id}:${right.id}`, blockId: block.id,
        start: a - from, end: b - from, text: original.text.slice(a, b),
        sceneId: block.type === 'scene-heading' ? block.id : tag.sceneId }] : []
    })
  })
  return { project: next, blocked: false, focusBlockId: right.id, selection: { start: 0, end: 0 } }
}
