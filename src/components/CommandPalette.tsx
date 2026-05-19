import { useCallback, useEffect, useRef, useState } from 'react'

export interface CommandResult {
  id: string
  label: string
  detail: string
  typeLabel: string
}

interface CommandPaletteProps {
  isOpen: boolean
  query: string
  results: CommandResult[]
  onQueryChange: (value: string) => void
  onSelect: (item: CommandResult) => void
  onClose: () => void
}

function CommandPalette({
  isOpen,
  query,
  results,
  onQueryChange,
  onSelect,
  onClose,
}: CommandPaletteProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const safeActiveIndex = Math.max(
    0,
    Math.min(activeIndex, Math.max(results.length - 1, 0)),
  )

  const closePalette = useCallback(() => {
    setActiveIndex(0)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePalette()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((previous) =>
          Math.min(previous + 1, Math.max(results.length - 1, 0)),
        )
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((previous) => Math.max(previous - 1, 0))
        return
      }

      if (event.key === 'Enter' && results.length > 0) {
        event.preventDefault()
        onSelect(results[safeActiveIndex])
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closePalette, isOpen, onSelect, results, safeActiveIndex])

  if (!isOpen) {
    return null
  }

  return (
    <div className="palette-overlay" onMouseDown={closePalette}>
      <section className="palette" onMouseDown={(event) => event.stopPropagation()}>
        <label className="palette-input-wrap">
          <span>Command Palette</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search scenes, beats, schedule, and catalog"
          />
        </label>

        <ul className="palette-results">
          {results.length === 0 && (
            <li className="palette-empty">No matches found. Keep typing to refine your query.</li>
          )}

          {results.map((item, index) => (
            <li key={item.id}>
              <button
                className={
                  index === safeActiveIndex ? 'palette-result active' : 'palette-result'
                }
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onSelect(item)}
              >
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
                <span>{item.typeLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export default CommandPalette
