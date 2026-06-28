interface FindInputKeyEvent {
  key: string
  preventDefault(): void
}

interface FindPanelKeyEvent extends FindInputKeyEvent {
  stopPropagation(): void
}

export const handleFindInputKeyDown = (
  event: FindInputKeyEvent,
  findNext: () => void,
): boolean => {
  if (event.key !== 'Enter') {
    return false
  }

  event.preventDefault()
  findNext()
  return true
}

export const handleFindPanelKeyDown = (
  event: FindPanelKeyEvent,
  findNext: () => void,
  closePanel: () => void,
): boolean => {
  if (event.key !== 'Enter' && event.key !== 'Escape') {
    return false
  }

  event.preventDefault()
  event.stopPropagation()

  if (event.key === 'Escape') {
    closePanel()
  } else {
    findNext()
  }

  return true
}
