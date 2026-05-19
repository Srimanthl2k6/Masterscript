# Sections 9-11 And Groups A-X Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MasterScript's remaining script formats, import/export/title/security workflows, and the requested production, linting, print, accessibility, series, timing, and writer-room toolsets.

**Architecture:** Keep the implementation local-first and project-file based by extending `ScriptProject` with one `advanced` state branch and adding pure helper modules for format definitions, import/export transforms, pagination/lint checks, production coordination, series management, coverage, print modes, and legal workflow helpers. Wire these into a compact in-app "Advanced" workspace panel rather than adding another state store.

**Tech Stack:** React, TypeScript, Vite, Electron, pdf-lib, existing parser/export utilities, Vitest, lightweight SVG/CSS for visualization.

---

### Task 1: Advanced State And Core Definitions

**Files:**
- Modify: `src/types/screenplay.ts`
- Modify: `src/lib/screenplay.ts`
- Create: `src/lib/advancedMasterScript.ts`
- Create: `src/lib/advancedMasterScript.test.ts`

- [ ] Write tests for script format templates, slug normalization, title/security fields, revision logs, clean/dirty export settings, production draft setup, cast status propagation, sides packages, one-liner schedule rows, timing estimates, lint results, series tools, coverage templates, writer-room storage, print settings, accessibility formats, and legal links.
- [ ] Run `npm test -- src/lib/advancedMasterScript.test.ts` and confirm the module is missing.
- [ ] Add `advanced` state with formatting preferences, scene numbering, title production fields, revision distribution logs, locked page metadata, cast statuses, series metadata, lint settings, coverage records, writer-room records, print settings, accessibility formats, and copyright workflow notes.
- [ ] Implement the pure helper functions required by the tests.
- [ ] Re-run `npm test -- src/lib/advancedMasterScript.test.ts`.

### Task 2: Adapter And Export Completion

**Files:**
- Modify: `src/lib/adapters/index.ts`
- Modify: `src/App.tsx`

- [ ] Export helper functions for TXT, RTF, HTML, CSV, report workbook XML, Celtx ZIP/XML text extraction, and PDF text import approximation.
- [ ] Add one-click clean, dirty, revised-pages-only, table-read, coverage, revision-log, one-liner, and watermark-oriented export actions.

### Task 3: Advanced Workspace UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] Add an `advanced` workspace tab and rail icon.
- [ ] Render controls for sections 9-11, Groups A-X: format/template chooser, style/script check, revision distribution log, title/security settings, production draft actions, cast status, sides/share links, one-liner schedule, timing, series/episode data, writer-room tools, coverage, print/watermark/accessibility/legal tools.
- [ ] Hydrate old projects with `advanced` fallback state.

### Task 4: Final Verification

**Files:**
- No new files.

- [ ] Run `npm test; if ($LASTEXITCODE -eq 0) { npm run build:web }`.
- [ ] Fix any test or build failures.
- [ ] Report the exact verification output and any remaining limitations.
