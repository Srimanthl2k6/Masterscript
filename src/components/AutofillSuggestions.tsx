import type { AutofillSuggestion } from '../lib/useSmartAutofill'

interface Props {
  activeIndex: number
  blockId: string
  suggestions: AutofillSuggestion[]
  onSelect(blockId: string, suggestion: AutofillSuggestion): void
}

export default function AutofillSuggestions({
  activeIndex,
  blockId,
  suggestions,
  onSelect,
}: Props) {
  if (suggestions.length === 0) return null
  return (
    <div className="character-suggestions" role="listbox">
      {suggestions.map((suggestion, index) => (
        <button
          key={`${blockId}-${suggestion.id}`}
          className={`character-suggestion-btn${index === activeIndex ? ' active' : ''}`}
          role="option"
          aria-selected={index === activeIndex}
          onMouseDown={(event) => {
            event.preventDefault()
            onSelect(blockId, suggestion)
          }}
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  )
}
