import { describe, expect, it, vi } from 'vitest'
import { handleFindInputKeyDown, handleFindPanelKeyDown } from './findReplace'

describe('handleFindInputKeyDown', () => {
  it('prevents the default Enter action and runs Find Next', () => {
    const preventDefault = vi.fn()
    const findNext = vi.fn()

    const handled = handleFindInputKeyDown(
      { key: 'Enter', preventDefault },
      findNext,
    )

    expect(handled).toBe(true)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(findNext).toHaveBeenCalledOnce()
  })

  it('does not intercept other keys', () => {
    const preventDefault = vi.fn()
    const findNext = vi.fn()

    const handled = handleFindInputKeyDown(
      { key: 'ArrowDown', preventDefault },
      findNext,
    )

    expect(handled).toBe(false)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(findNext).not.toHaveBeenCalled()
  })
})

describe('handleFindPanelKeyDown', () => {
  it('captures Enter anywhere while the panel is open and runs Find Next', () => {
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const findNext = vi.fn()
    const closePanel = vi.fn()

    const handled = handleFindPanelKeyDown(
      { key: 'Enter', preventDefault, stopPropagation },
      findNext,
      closePanel,
    )

    expect(handled).toBe(true)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(findNext).toHaveBeenCalledOnce()
    expect(closePanel).not.toHaveBeenCalled()
  })

  it('captures Escape anywhere while the panel is open and closes the panel', () => {
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const findNext = vi.fn()
    const closePanel = vi.fn()

    const handled = handleFindPanelKeyDown(
      { key: 'Escape', preventDefault, stopPropagation },
      findNext,
      closePanel,
    )

    expect(handled).toBe(true)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(findNext).not.toHaveBeenCalled()
    expect(closePanel).toHaveBeenCalledOnce()
  })

  it('does not intercept unrelated keys', () => {
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const findNext = vi.fn()
    const closePanel = vi.fn()

    const handled = handleFindPanelKeyDown(
      { key: 'ArrowDown', preventDefault, stopPropagation },
      findNext,
      closePanel,
    )

    expect(handled).toBe(false)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(stopPropagation).not.toHaveBeenCalled()
    expect(findNext).not.toHaveBeenCalled()
    expect(closePanel).not.toHaveBeenCalled()
  })
})
