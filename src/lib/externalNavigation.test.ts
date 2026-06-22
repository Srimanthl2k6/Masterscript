import { describe, expect, it, vi } from 'vitest'
import { openExternalUrl } from './externalNavigation'

describe('external navigation', () => {
  it('opens external resources without granting opener access', () => {
    const openedWindow = { opener: {} }
    const open = vi.fn(() => openedWindow)

    openExternalUrl('https://www.copyright.gov/', open)

    expect(open).toHaveBeenCalledWith(
      'https://www.copyright.gov/',
      '_blank',
      'noopener,noreferrer',
    )
    expect(openedWindow.opener).toBeNull()
  })

  it('rejects non-HTTPS external destinations', () => {
    expect(() => openExternalUrl('javascript:alert(1)', vi.fn())).toThrow(
      /HTTPS/i,
    )
  })
})
