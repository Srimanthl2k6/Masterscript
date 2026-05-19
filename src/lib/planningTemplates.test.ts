import { describe, expect, it } from 'vitest'
import { buildCardsFromTemplate, storyTemplates } from './planningTemplates'

describe('planning templates', () => {
  it('builds cards from a known template', () => {
    const cards = buildCardsFromTemplate('three-act')

    expect(cards.length).toBeGreaterThan(0)
    expect(cards[0].title).toContain('Act')
    expect(cards.every((card) => card.id.length > 0)).toBe(true)
  })

  it('returns no cards for unknown template id', () => {
    expect(buildCardsFromTemplate('missing-template')).toEqual([])
  })

  it('ships at least three structure templates', () => {
    expect(storyTemplates.length).toBeGreaterThanOrEqual(3)
  })
})
