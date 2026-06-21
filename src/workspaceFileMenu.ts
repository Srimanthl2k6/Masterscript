export type WorkspaceFileMenuItemId =
  | 'home'
  | 'new'
  | 'open'
  | 'import-fdx'
  | 'import-fountain'
  | 'import-docx'
  | 'export-fdx'
  | 'export-docx'
  | 'export-pdf'
  | 'print-preview'
  | 'theme'
  | 'snapshots'
  | 'tutorial'
  | 'undo'
  | 'redo'

export interface WorkspaceFileMenuItem {
  id: WorkspaceFileMenuItemId
  label: string
}

interface WorkspaceFileMenuGroup {
  id: string
  label: string
  items: WorkspaceFileMenuItem[]
}

export const workspaceFileMenuGroups: WorkspaceFileMenuGroup[] = [
  {
    id: 'project',
    label: 'Project',
    items: [
      { id: 'home', label: 'Home' },
      { id: 'new', label: 'New' },
      { id: 'open', label: 'Open' },
    ],
  },
  {
    id: 'import',
    label: 'Import',
    items: [
      { id: 'import-fdx', label: 'Import FDX' },
      { id: 'import-fountain', label: 'Import Fountain' },
      { id: 'import-docx', label: 'Import DOCX' },
    ],
  },
  {
    id: 'export',
    label: 'Export',
    items: [
      { id: 'export-fdx', label: 'Export FDX' },
      { id: 'export-docx', label: 'Export DOCX' },
      { id: 'export-pdf', label: 'Export PDF' },
      { id: 'print-preview', label: 'Print Preview' },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'theme', label: 'Theme' },
      { id: 'snapshots', label: 'Snapshots' },
      { id: 'tutorial', label: 'Tutorial' },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { id: 'undo', label: 'Undo' },
      { id: 'redo', label: 'Redo' },
    ],
  },
]
