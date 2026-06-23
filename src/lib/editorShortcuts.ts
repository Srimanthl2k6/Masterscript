import type { BlockType } from '../types/screenplay'

export const shortcutBlockTypes: BlockType[] = [
  'scene-heading', 'action', 'character', 'dialogue',
  'parenthetical', 'transition', 'shot',
]

export const defaultScreenplayShortcuts: Record<string, string> = {
  'scene-heading': 'Ctrl+Alt+1',
  action: 'Ctrl+Alt+2',
  character: 'Ctrl+Alt+3',
  dialogue: 'Ctrl+Alt+4',
  parenthetical: 'Ctrl+Alt+5',
  transition: 'Ctrl+Alt+6',
  shot: 'Ctrl+Alt+7',
  'format-bold': 'Ctrl+B',
  'format-italic': 'Ctrl+I',
  'format-underline': 'Ctrl+U',
}

export const formattingActions = [
  { id: 'format-bold', label: 'Bold', property: 'bold' },
  { id: 'format-italic', label: 'Italic', property: 'italic' },
  { id: 'format-underline', label: 'Underline', property: 'underline' },
] as const

export const shortcutSignature = (shortcut: string): string =>
  shortcut.split('+').map((part) => part.trim().toLowerCase()).filter(Boolean).join('+')

interface ShortcutKeyboardEvent {
  altKey: boolean
  ctrlKey: boolean
  key: string
  metaKey: boolean
  shiftKey: boolean
}

export const shortcutFromKeyEvent = (event: ShortcutKeyboardEvent): string | null => {
  if (['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) return null
  const key = event.key.length === 1
    ? event.key.toUpperCase()
    : event.key === ' ' ? 'Space' : event.key
  const hasModifier = event.ctrlKey || event.altKey || event.metaKey || event.shiftKey
  if (!hasModifier && !/^F\d{1,2}$/i.test(key)) return null
  return [
    event.ctrlKey ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Meta' : '',
    key,
  ].filter(Boolean).join('+')
}
