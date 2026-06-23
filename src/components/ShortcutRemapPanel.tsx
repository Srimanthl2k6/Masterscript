import type { KeyboardEvent } from 'react'
import { blockTypeLabels, type BlockType } from '../types/screenplay'

interface Props {
  formatting: Array<{ id: string; label: string; shortcut: string }>
  screenplay: Array<{ type: BlockType; shortcut: string }>
  onCapture(
    event: KeyboardEvent<HTMLInputElement>,
    action: string,
    label: string,
  ): void
  onReset(): void
}

export default function ShortcutRemapPanel({
  formatting,
  screenplay,
  onCapture,
  onReset,
}: Props) {
  return (
    <details className="shortcut-remap-panel">
      <summary>Remap shortcuts</summary>
      <div className="shortcut-remap-list">
        {screenplay.map((item) => (
          <label key={`remap-${item.type}`}>
            <span>{blockTypeLabels[item.type]}</span>
            <input
              value={item.shortcut}
              readOnly
              onKeyDown={(event) =>
                onCapture(event, item.type, blockTypeLabels[item.type])
              }
              onFocus={(event) => event.currentTarget.select()}
              aria-label={`Shortcut for ${blockTypeLabels[item.type]}`}
            />
          </label>
        ))}
        {formatting.map((item) => (
          <label key={`remap-${item.id}`}>
            <span>{item.label}</span>
            <input
              value={item.shortcut}
              readOnly
              onKeyDown={(event) => onCapture(event, item.id, item.label)}
              onFocus={(event) => event.currentTarget.select()}
              aria-label={`Shortcut for ${item.label}`}
            />
          </label>
        ))}
      </div>
      <button className="subtle-action" onClick={onReset}>
        Reset defaults
      </button>
    </details>
  )
}
