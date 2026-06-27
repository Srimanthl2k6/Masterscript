import type { ScriptBlock } from '../types/screenplay'

interface SceneNumberInlineInputProps {
  block: ScriptBlock
  locked: boolean
  numberLabel: string
  onCommit(blockId: string, value: string): void
  onDismissSuggestions(text: string): void
  onFocusScene(blockId: string): void
}

export default function SceneNumberInlineInput({
  block,
  locked,
  numberLabel,
  onCommit,
  onDismissSuggestions,
  onFocusScene,
}: SceneNumberInlineInputProps) {
  return (
    <input
      key={`scene-number-${block.id}-${numberLabel}`}
      className="scene-number-inline-input"
      defaultValue={numberLabel}
      disabled={locked}
      aria-label={`Scene number for ${block.text || 'scene heading'}`}
      title={
        locked
          ? 'Scene numbers are locked for this production draft'
          : 'Edit the full scene number and optional letter suffix'
      }
      draggable={false}
      onFocus={(event) => {
        event.currentTarget.select()
        onFocusScene(block.id)
        onDismissSuggestions(block.text)
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') {
          event.preventDefault()
          onCommit(block.id, event.currentTarget.value)
          event.currentTarget.blur()
          return
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          event.currentTarget.value = numberLabel
          event.currentTarget.blur()
        }
      }}
      onBlur={(event) => onCommit(block.id, event.currentTarget.value)}
    />
  )
}
