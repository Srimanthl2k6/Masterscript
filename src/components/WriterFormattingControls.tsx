import { useState } from 'react'
import { formattingActions } from '../lib/editorShortcuts'
import type { TextFormat } from '../types/screenplay'

interface Props {
  activeFormat: TextFormat
  fontFamilies: string[]
  formattingShortcuts: Array<{ id: string; shortcut: string }>
  onClear(): void
  onFontFamily(fontFamily: string): void
  onToggle(property: 'bold' | 'italic' | 'underline' | 'letterSpacing'): void
}

export default function WriterFormattingControls({
  activeFormat,
  fontFamilies,
  formattingShortcuts,
  onClear,
  onFontFamily,
  onToggle,
}: Props) {
  const [fontFamily, setFontFamily] = useState(
    activeFormat.fontFamily ?? 'Courier Prime',
  )
  const applyFont = () => onFontFamily(fontFamily.trim())

  return (
    <div className="text-formatting-panel" aria-label="Text formatting">
      <div className="text-formatting-buttons">
        {formattingActions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={activeFormat[action.property] ? 'active' : ''}
            aria-pressed={activeFormat[action.property] === true}
            title={`${action.label} (${
              formattingShortcuts.find((item) => item.id === action.id)?.shortcut ?? ''
            })`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onToggle(action.property)}
          >
            {action.id === 'format-bold' ? 'B' : action.id === 'format-italic' ? 'I' : 'U'}
          </button>
        ))}
        <button
          type="button"
          className={activeFormat.letterSpacing ? 'active' : ''}
          aria-pressed={activeFormat.letterSpacing === true}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onToggle('letterSpacing')}
        >
          Spaced
        </button>
      </div>
      <label className="font-family-control">
        <span>Font</span>
        <input
          list="masterscript-font-families"
          value={fontFamily}
          onChange={(event) => setFontFamily(event.target.value)}
          onBlur={applyFont}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              applyFont()
              event.currentTarget.blur()
            }
          }}
          placeholder="Installed font family"
        />
        <datalist id="masterscript-font-families">
          {fontFamilies.map((family) => <option key={family} value={family} />)}
        </datalist>
      </label>
      <button
        type="button"
        className="subtle-action"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClear}
      >
        Clear formatting
      </button>
    </div>
  )
}
