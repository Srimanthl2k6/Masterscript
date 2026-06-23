import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import type {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
} from 'react'
import { formatRuns } from '../lib/richText'
import type { ScriptBlock, TextFormat } from '../types/screenplay'

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

const hasFormatting = (format: TextFormat): boolean =>
  Object.keys(format).length > 0

const applyRunStyle = (element: HTMLSpanElement, format: TextFormat) => {
  if (format.fontFamily) {
    element.style.fontFamily = `"${format.fontFamily}", "Courier Prime", monospace`
  }
  if (format.italic) {
    element.style.fontStyle = 'italic'
  }
  if (format.bold) {
    element.style.fontWeight = '700'
  }
  if (format.letterSpacing) {
    element.style.letterSpacing = '0.08em'
  }
  if (format.underline) {
    element.style.textDecoration = 'underline'
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
  const pendingSelectionRef = useRef<TextSelection | null>(null)
  const renderedSignatureRef = useRef('')
  const renderedWithFormattingRef = useRef(false)
  const runs = useMemo(
    () => formatRuns(block.text, block.formatRanges),
    [block.formatRanges, block.text],
  )
  const renderSignature = useMemo(
    () =>
      JSON.stringify(
        runs.map((run) => [
          run.start,
          run.end,
          run.text,
          run.format,
        ]),
      ),
    [runs],
  )
  const renderHasFormatting = useMemo(
    () => runs.some((run) => hasFormatting(run.format)),
    [runs],
  )

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const currentText = root.innerText.replace(/\r/g, '')
    const textMatches = (currentText === '\n' ? '' : currentText) === block.text
    if (
      textMatches &&
      renderSignature === renderedSignatureRef.current
    ) {
      return
    }
    if (
      textMatches &&
      !renderHasFormatting &&
      !renderedWithFormattingRef.current
    ) {
      renderedSignatureRef.current = renderSignature
      return
    }

    const selection =
      document.activeElement === root
        ? pendingSelectionRef.current ?? selectionWithin(root)
        : null
    const fragment = document.createDocumentFragment()
    for (const run of runs) {
      if (!hasFormatting(run.format)) {
        fragment.append(document.createTextNode(run.text))
        continue
      }
      const span = document.createElement('span')
      span.textContent = run.text
      applyRunStyle(span, run.format)
      fragment.append(span)
    }
    root.replaceChildren(fragment)
    renderedSignatureRef.current = renderSignature
    renderedWithFormattingRef.current = renderHasFormatting
    pendingSelectionRef.current = null

    if (selection && document.activeElement === root) {
      restoreSelection(root, selection.start, selection.end)
    }
  }, [block.text, renderHasFormatting, renderSignature, runs])

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
        pendingSelectionRef.current = { start, end }
        restoreSelection(rootRef.current, start, end)
      }
    },
    getValue: () => rootRef.current?.innerText.replace(/\r/g, '') ?? block.text,
  }))

  const reportSelection = () => onSelectionChange(readSelection())

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const text = event.currentTarget.innerText.replace(/\r/g, '')
    const selection = selectionWithin(event.currentTarget)
    pendingSelectionRef.current = selection
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
    />
  )
})

export default RichScriptBlockEditor
