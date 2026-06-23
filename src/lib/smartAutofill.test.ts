import { describe, expect, it } from 'vitest'
import {
  rankSuggestions,
  replaceSceneHeadingLocation,
} from './smartAutofill'

describe('smart autofill', () => {
  it('ranks prefix, word-prefix, substring, then typo matches deterministically', () => {
    expect(
      rankSuggestions('mar', [
        'SUPERMARKET',
        'MARKET STREET',
        'MARINA',
        'MORNING ROOM',
      ]),
    ).toEqual(['MARINA', 'MARKET STREET', 'SUPERMARKET', 'MORNING ROOM'])
  })

  it('deduplicates case-insensitively and limits results', () => {
    expect(
      rankSuggestions(
        '',
        ['CUT TO:', 'cut to:', 'DISSOLVE TO:', 'SMASH CUT TO:'],
        2,
      ),
    ).toEqual(['CUT TO:', 'DISSOLVE TO:'])
  })

  it('replaces only the primary scene location', () => {
    expect(
      replaceSceneHeadingLocation(
        'INT. MANSION - BALLROOM - LATE NIGHT SCENE 12A',
        'GRAND HOTEL',
      ),
    ).toBe('INT. GRAND HOTEL - BALLROOM - LATE NIGHT SCENE 12A')
  })

  it('preserves slash time and dotted scene-number suffixes', () => {
    expect(
      replaceSceneHeadingLocation(
        'EXT. OLD PIER. DAY/NIGHT. SCENE 7',
        'NEW PIER',
      ),
    ).toBe('EXT. NEW PIER - DAY/NIGHT SCENE 7')
  })
})
