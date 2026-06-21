import { describe, expect, it } from 'vitest'
import {
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
      shouldOpenTutorialAutomatically({
        kind: 'existing-tauri',
        tutorialCompleted: false,
        migrationVersion: null,
      }),
    ).toBe(true)
    expect(
      shouldOpenTutorialAutomatically({
        kind: 'legacy-migrated',
        tutorialCompleted: true,
        migrationVersion: 1,
      }),
    ).toBe(false)
  })
})
