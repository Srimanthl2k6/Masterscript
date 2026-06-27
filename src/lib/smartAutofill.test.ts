import { describe, expect, it } from 'vitest'
import {
  shouldApplyAutofillSuggestionOnEnter,
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

  it('does not accept a character autofill on Enter for exact typed names', () => {
    expect(
      shouldApplyAutofillSuggestionOnEnter(
        { type: 'character', text: 'SRIRAM' },
        { kind: 'character', value: 'MAHI' },
        {
          characterSuggestions: ['MAHI', 'SRIRAM'],
          locations: [],
        },
      ),
    ).toBe(false)
    expect(
      shouldApplyAutofillSuggestionOnEnter(
        { type: 'character', text: 'SRIRAM' },
        { kind: 'character', value: 'SRIRAM' },
        {
          characterSuggestions: ['MAHI'],
          locations: [],
        },
      ),
    ).toBe(false)
  })

  it('still accepts a character autofill on Enter for partial input', () => {
    expect(
      shouldApplyAutofillSuggestionOnEnter(
        { type: 'character', text: 'SRIRA' },
        { kind: 'character', value: 'SRIRAM' },
        {
          characterSuggestions: ['MAHI', 'SRIRAM'],
          locations: [],
        },
      ),
    ).toBe(true)
  })

  it('accepts a partial character even when the live block text is in suggestions', () => {
    expect(
      shouldApplyAutofillSuggestionOnEnter(
        { type: 'character', text: 'SRIRA' },
        { kind: 'character', value: 'SRIRAM' },
        {
          characterSuggestions: ['MAHI', 'SRIRA', 'SRIRAM'],
          exactCharacterSuggestions: ['MAHI', 'SRIRAM'],
          locations: [],
        },
      ),
    ).toBe(true)
  })

  it('does not accept weak unrelated character matches on Enter', () => {
    expect(
      shouldApplyAutofillSuggestionOnEnter(
        { type: 'character', text: 'ROAD' },
        { kind: 'character', value: 'MAHI' },
        {
          characterSuggestions: ['MAHI', 'SRIRAM'],
          locations: [],
        },
      ),
    ).toBe(false)
  })

  it('does not accept a location autofill on Enter for exact or complete headings', () => {
    expect(
      shouldApplyAutofillSuggestionOnEnter(
        { type: 'scene-heading', text: 'EXT. MAHI HOUSE - DAY' },
        { kind: 'location', value: 'SRIRAM HOUSE' },
        {
          characterSuggestions: [],
          locations: ['MAHI HOUSE', 'SRIRAM HOUSE'],
        },
      ),
    ).toBe(false)
    expect(
      shouldApplyAutofillSuggestionOnEnter(
        { type: 'scene-heading', text: 'EXT. ROAD - DAY' },
        { kind: 'location', value: 'MAHI HOUSE' },
        {
          characterSuggestions: [],
          locations: ['MAHI HOUSE', 'SRIRAM HOUSE'],
        },
      ),
    ).toBe(false)
  })

  it('still accepts a location autofill on Enter for partial headings', () => {
    expect(
      shouldApplyAutofillSuggestionOnEnter(
        { type: 'scene-heading', text: 'EXT. MAH' },
        { kind: 'location', value: 'MAHI HOUSE' },
        {
          characterSuggestions: [],
          locations: ['MAHI HOUSE', 'SRIRAM HOUSE'],
        },
      ),
    ).toBe(true)
  })

  it('accepts a partial location even when the heading already has a time of day', () => {
    expect(
      shouldApplyAutofillSuggestionOnEnter(
        { type: 'scene-heading', text: 'EXT. SRIRA - DAY' },
        { kind: 'location', value: 'SRIRAM HOUSE' },
        {
          characterSuggestions: [],
          locations: ['MAHI HOUSE', 'SRIRAM HOUSE'],
        },
      ),
    ).toBe(true)
  })
})
