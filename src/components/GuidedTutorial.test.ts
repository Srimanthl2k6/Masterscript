import { describe, expect, it } from 'vitest'
import {
  isTutorialAdvanceKey,
  shouldOpenTutorialAutomatically,
  tutorialSteps,
} from '../lib/tutorial'

describe('guided tutorial', () => {
  it('covers the complete first-time workflow in eight steps', () => {
    expect(tutorialSteps.map((step) => step.id)).toEqual([
      'home',
      'draft',
      'formatting',
      'outline',
      'find-replace',
      'workspace-rail',
      'file-actions',
      'collaboration-saving',
    ])
  })

  it('reopens incomplete onboarding but permanently suppresses legacy users', () => {
    expect(
      shouldOpenTutorialAutomatically(
        {
          kind: 'existing-tauri',
          tutorialCompleted: false,
          migrationVersion: null,
        },
        'tauri',
      ),
    ).toBe(true)
    expect(
      shouldOpenTutorialAutomatically(
        {
          kind: 'legacy-migrated',
          tutorialCompleted: true,
          migrationVersion: 1,
        },
        'tauri',
      ),
    ).toBe(false)
  })

  it('never starts automatic onboarding on the website', () => {
    expect(
      shouldOpenTutorialAutomatically(
        {
          kind: 'fresh',
          tutorialCompleted: false,
          migrationVersion: null,
        },
        'web',
      ),
    ).toBe(false)
  })

  it('captures an unmodified Enter key for tutorial navigation', () => {
    expect(
      isTutorialAdvanceKey({
        key: 'Enter',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        isComposing: false,
      }),
    ).toBe(true)
    expect(
      isTutorialAdvanceKey({
        key: 'Enter',
        altKey: false,
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        isComposing: false,
      }),
    ).toBe(false)
  })
})
