import { describe, expect, it, vi } from 'vitest'
import { handleFindInputKeyDown } from './findReplace'

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
