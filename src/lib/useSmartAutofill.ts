import { useMemo, useState } from 'react'
import type { ScriptBlock } from '../types/screenplay'
import type { CharacterVoiceCue } from './screenplay'
import type { SmartTypeOptions } from './formattingEngine'
import { rankSuggestions } from './smartAutofill'

export interface AutofillSuggestion {
  id: string
  label: string
  value: string
  kind: 'character' | 'voice-cue' | 'location' | 'transition'
}

const voiceCues: Array<{ label: string; cue: CharacterVoiceCue }> = [
  { label: 'Voice Over', cue: 'V.O.' },
  { label: 'Off Screen', cue: 'O.S.' },
]

export const useSmartAutofill = (
  selectedBlock: ScriptBlock | null,
  characterSuggestions: string[],
  smartTypeOptions: SmartTypeOptions,
) => {
  const [activeState, setActiveState] = useState<{ key: string | null; index: number }>({
    key: null,
    index: 0,
  })
  const [dismissedSuggestionKey, setDismissedSuggestionKey] = useState<string | null>(null)
  const selectedKey = selectedBlock
    ? `${selectedBlock.id}\u0000${selectedBlock.text}`
    : null
  const suggestions = useMemo<AutofillSuggestion[]>(() => {
    if (!selectedBlock || dismissedSuggestionKey === selectedKey) return []
    if (selectedBlock.type === 'character') {
      const openParenIndex = selectedBlock.text.lastIndexOf('(')
      const hasOpenVoiceCue =
        openParenIndex >= 0 &&
        !selectedBlock.text.slice(openParenIndex).includes(')') &&
        Boolean(selectedBlock.text.slice(0, openParenIndex).trim())
      if (hasOpenVoiceCue) {
        return voiceCues.map((option) => ({
          id: `voice-${option.cue}`,
          label: option.label,
          value: option.cue,
          kind: 'voice-cue',
        }))
      }
      const query = selectedBlock.text.trim()
      if (!query) return []
      return rankSuggestions(query, characterSuggestions)
        .filter((name) => name.trim().toUpperCase() !== query.toUpperCase())
        .map((name) => ({
          id: `character-${name}`,
          label: name,
          value: name,
          kind: 'character',
        }))
    }
    if (selectedBlock.type === 'scene-heading') {
      const query = selectedBlock.text
        .replace(/^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.|I\/E\.|EST\.)\s*/i, '')
        .split(/\s+(?:-|--|–|—|\.)\s+/)[0]
        .trim()
      if (!query) return []
      return rankSuggestions(query, smartTypeOptions.locations)
        .filter((location) => location.trim().toUpperCase() !== query.toUpperCase())
        .map((location) => ({
          id: `location-${location}`,
          label: location,
          value: location,
          kind: 'location',
        }))
    }
    if (selectedBlock.type === 'transition') {
      const query = selectedBlock.text.trim()
      const transitions = query
        ? rankSuggestions(query, smartTypeOptions.transitions)
        : smartTypeOptions.transitions.slice(0, 8)
      return transitions
        .filter((transition) => transition.trim().toUpperCase() !== query.toUpperCase())
        .map((transition) => ({
          id: `transition-${transition}`,
          label: transition,
          value: transition,
          kind: 'transition',
        }))
    }
    return []
  }, [characterSuggestions, dismissedSuggestionKey, selectedBlock, selectedKey, smartTypeOptions])

  const activeSuggestionIndex = activeState.key === selectedKey
    ? Math.min(activeState.index, Math.max(0, suggestions.length - 1))
    : 0
  return {
    suggestions,
    activeSuggestionIndex,
    setActiveSuggestionIndex: (
      update: number | ((current: number) => number),
    ) => setActiveState({
      key: selectedKey,
      index: typeof update === 'function' ? update(activeSuggestionIndex) : update,
    }),
    setDismissedSuggestionText: (text: string) =>
      setDismissedSuggestionKey(selectedBlock ? `${selectedBlock.id}\u0000${text}` : null),
  }
}
