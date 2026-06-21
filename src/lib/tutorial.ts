import type { InstallState } from './desktop/types'

export interface TutorialStep {
  id:
    | 'home'
    | 'draft'
    | 'formatting'
    | 'outline'
    | 'find-replace'
    | 'workspace-rail'
    | 'file-actions'
    | 'collaboration-saving'
  title: string
  description: string
  target: string
}

export const tutorialSteps: TutorialStep[] = [
  {
    id: 'home',
    title: 'Start or open a screenplay',
    description:
      'Create a new project, open an existing MasterScript file, or import a screenplay from the home screen.',
    target: '[data-tutorial="home-actions"]',
  },
  {
    id: 'draft',
    title: 'Write in screenplay blocks',
    description:
      'The draft editor keeps scene headings, action, characters, dialogue, and other screenplay elements correctly structured.',
    target: '[data-tutorial="draft-editor"]',
  },
  {
    id: 'formatting',
    title: 'Format the current block',
    description:
      'Use the formatting toolbar or keyboard shortcuts to change the selected screenplay element.',
    target: '[data-tutorial="formatting-toolbar"]',
  },
  {
    id: 'outline',
    title: 'Navigate by scene',
    description:
      'The writer panel and scene outline let you move through the screenplay while keeping context visible.',
    target: '[data-tutorial="scene-outline"]',
  },
  {
    id: 'find-replace',
    title: 'Find and replace quickly',
    description:
      'Type a term and press Enter to jump to the next match. The floating widget keeps the screenplay visible and interactive.',
    target: '[data-tutorial="find-replace"]',
  },
  {
    id: 'workspace-rail',
    title: 'Switch workspaces',
    description:
      'Use the workspace rail for preview, planning, productivity, production, reports, breakdown, and advanced tools.',
    target: '[data-tutorial="workspace-rail"]',
  },
  {
    id: 'file-actions',
    title: 'Import, export, and manage',
    description:
      'The File menu contains project, import, export, snapshot, theme, and editing actions.',
    target: '[data-tutorial="file-menu"]',
  },
  {
    id: 'collaboration-saving',
    title: 'Collaborate and save',
    description:
      'Start or join collaboration from the header, and use Share to save a portable MasterScript project.',
    target: '[data-tutorial="collaboration-saving"]',
  },
]

export const shouldOpenTutorialAutomatically = (
  installState: InstallState,
): boolean =>
  installState.kind !== 'legacy-migrated' && !installState.tutorialCompleted
