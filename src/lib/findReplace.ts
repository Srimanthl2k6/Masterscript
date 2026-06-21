interface FindInputKeyEvent {
  key: string
  preventDefault(): void
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
