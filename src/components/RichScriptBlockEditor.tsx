import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import type {
  ClipboardEvent,
  CSSProperties,
  FormEvent,
  KeyboardEvent,
} from 'react'
import { formatRuns } from '../lib/richText'
import type { ScriptBlock } from '../types/screenplay'

export interface TextSelection {
  start: number
  end: number
}

export interface RichScriptBlockEditorHandle {
  focus(): void
  scrollIntoView(options?: ScrollIntoViewOptions): void
  getSelection(): TextSelection
  setSelectionRange(start: number, end: number): void
  getValue(): string
}

interface RichScriptBlockEditorProps {
  block: ScriptBlock
  className: string
  placeholder: string
  onChange: (text: string, selection: TextSelection) => void
  onFocus: () => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onSelectionChange: (selection: TextSelection) => void
}

const textLength = (node: Node): number => node.textContent?.length ?? 0

const pointAtOffset = (
  root: HTMLElement,
  requestedOffset: number,
): { node: Node; offset: number } => {
  const offset = Math.max(0, Math.min(textLength(root), requestedOffset))
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let current = walker.nextNode()
  while (current) {
    const length = textLength(current)
    if (remaining <= length) {
      return { node: current, offset: remaining }
    }
    remaining -= length
    current = walker.nextNode()
  }
  return { node: root, offset: root.childNodes.length }
}

const selectionWithin = (root: HTMLElement): TextSelection => {
  const selection = window.getSelection()
  if (
    !selection ||
    selection.rangeCount === 0 ||
    !selection.anchorNode ||
    !selection.focusNode ||
    !root.contains(selection.anchorNode) ||
    !root.contains(selection.focusNode)
  ) {
    const end = textLength(root)
    return { start: end, end }
  }

  const anchorRange = document.createRange()
  anchorRange.selectNodeContents(root)
  anchorRange.setEnd(selection.anchorNode, selection.anchorOffset)
  const focusRange = document.createRange()
  focusRange.selectNodeContents(root)
  focusRange.setEnd(selection.focusNode, selection.focusOffset)
  const anchor = anchorRange.toString().length
  const focus = focusRange.toString().length
  return {
    start: Math.min(anchor, focus),
    end: Math.max(anchor, focus),
  }
}

const restoreSelection = (
  root: HTMLElement,
  start: number,
  end: number,
) => {
  const selection = window.getSelection()
  if (!selection) {
    return
  }
  const startPoint = pointAtOffset(root, start)
  const endPoint = pointAtOffset(root, end)
  const range = document.createRange()
  range.setStart(startPoint.node, startPoint.offset)
  range.setEnd(endPoint.node, endPoint.offset)
  selection.removeAllRanges()
  selection.addRange(range)
}

const runStyle = (block: ScriptBlock, index: number): CSSProperties => {
  const format = formatRuns(block.text, block.formatRanges)[index]?.format ?? {}
  return {
    fontFamily: format.fontFamily
      ? `"${format.fontFamily}", "Courier Prime", monospace`
      : undefined,
    fontStyle: format.italic ? 'italic' : undefined,
    fontWeight: format.bold ? 700 : undefined,
    letterSpacing: format.letterSpacing ? '0.08em' : undefined,
    textDecoration: format.underline ? 'underline' : undefined,
  }
}

const RichScriptBlockEditor = forwardRef<
  RichScriptBlockEditorHandle,
  RichScriptBlockEditorProps
>(function RichScriptBlockEditor(
  {
    block,
    className,
    placeholder,
    onChange,
    onFocus,
    onKeyDown,
    onSelectionChange,
  },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const runs = useMemo(
    () => formatRuns(block.text, block.formatRanges),
    [block.formatRanges, block.text],
  )

  const readSelection = (): TextSelection => {
    const root = rootRef.current
    return root
      ? selectionWithin(root)
      : { start: block.text.length, end: block.text.length }
  }

  useImperativeHandle(forwardedRef, () => ({
    focus: () => rootRef.current?.focus(),
    scrollIntoView: (options) => rootRef.current?.scrollIntoView(options),
    getSelection: readSelection,
    setSelectionRange: (start, end) => {
      if (rootRef.current) {
        restoreSelection(rootRef.current, start, end)
      }
    },
    getValue: () => rootRef.current?.innerText.replace(/\r/g, '') ?? block.text,
  }))

  const reportSelection = () => onSelectionChange(readSelection())

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const text = event.currentTarget.innerText.replace(/\r/g, '')
    const selection = selectionWithin(event.currentTarget)
    onChange(text === '\n' ? '' : text, selection)
  }

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
  }

  return (
    <div
      ref={rootRef}
      className={className}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={`${block.type} screenplay block`}
      data-placeholder={placeholder}
      spellCheck
      onFocus={() => {
        onFocus()
        reportSelection()
      }}
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onKeyUp={reportSelection}
      onMouseUp={reportSelection}
      onPaste={handlePaste}
    >
      {runs.map((run, index) => (
        <span key={`${run.start}-${run.end}`} style={runStyle(block, index)}>
          {run.text}
        </span>
      ))}
    </div>
  )
})

export default RichScriptBlockEditor
