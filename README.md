# MasterScript

MasterScript is a Windows-first desktop screenwriting suite inspired by the capabilities of Celtx, Kit Scenarist, and Final Draft, built as a local-first application with no cloud storage dependency.

## Current Implementation (Sprint Slice)

This initial implementation includes:

- Tauri 2 desktop shell with Rust persistence and collaboration commands
- React + TypeScript app with screenplay-first editor
- Screenplay blocks and keyboard workflow
  - `Tab` cycles block element type
  - `Enter` inserts screenplay-aware next block
  - `Shift+Enter` inserts newline in current block
- Scene navigator and script statistics
- Scene context header shared across all tabs
- Revision mode with revision colors
- Revision sidebar counters and interactive color chips
- Local autosave and file-based open/save
- Fountain export
- Planning module upgrades
  - Beat card drag-and-drop reorder
  - Story structure template insertion (Three Act, Hero's Journey, Eight Sequence)
  - Stronger scene linking in planning cards
- Production module starter (schedule rows / stripboard baseline)
- Budget module starter
- Storyboard module starter
- Character/location catalog module starter with auto-detection
- Command palette search (Ctrl+K) across scenes, beats, schedule, and catalog entries
- Toolbar hierarchy refresh with keyboard hint badges
- Cinematic dark visual system tuned for low-glare desktop writing
- Unit tests for core screenplay behavior

## Run Locally

```bash
npm install
npm run dev
```

This starts the Vite renderer inside the Tauri 2 desktop shell.

## Scripts

- `npm run dev`: Run desktop app in development mode
- `npm run dev:web`: Run renderer only
- `npm run build:web`: Build web renderer
- `npm run build:desktop`: Build renderer and package desktop installer artifacts
- `npm run test`: Run unit tests
- `npm run lint`: Run ESLint

## Project Structure

```text
/src-tauri
  /src
    commands.rs
    persistence.rs
    migration.rs
/src
  App.tsx
  /components
    CommandPalette.tsx
    SceneContextHeader.tsx
  index.css
  /lib
    planningTemplates.ts
    planningTemplates.test.ts
    screenplay.ts
    screenplay.test.ts
  /types
    screenplay.ts
    desktop.d.ts
```

## Roadmap Alignment

This repository is now in implementation mode for the larger parity roadmap. The next slices are:

1. FDX/DOCX import-export adapters and normalization pipeline
2. Expanded production toolkit (breakdown entities, day-out-of-days, call sheet generation)
3. Advanced revision workflows (page locking, compare/merge)
4. Deeper planning tools (index card drag ordering, structure templates)
5. Reporting and print-ready outputs

## Notes

- All project data is local-first.
- Cloud sync is intentionally out of scope.
- Existing adapters are intentionally modular for later compatibility expansion.
