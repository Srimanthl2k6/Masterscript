# MasterScript Stability, Duplication, and Scene Numbers Design

## Scope

This release addresses five user-visible requirements:

1. Open the desktop application maximized without a delayed white flash.
2. Prevent the whole application from disappearing when a dialogue line is erased.
3. Add project duplication.
4. Rename “Remap shortcuts” to “Shortcuts”.
5. Make scene-number suffixes editable while preserving automatic numeric renumbering.

It also reconciles the local `v0.4.0` history with the newer remote rich-text and release-workflow commits before publishing `v0.5.0`.

## Root Causes

### Startup flash

The Tauri window is created visible at a fixed size. Maximizing it after launch exposes the webview’s default white surface while the renderer resizes. The app should instead be created hidden and maximized, with a dark background matching MasterScript, then shown after the initial page load finishes.

### Black window after erasing dialogue

`RichScriptBlockEditor` renders React-owned `<span>` children inside `contentEditable`. Browser editing mutates or removes those spans before React reconciles the new project state. When the last text is erased, React attempts to remove an already-removed span and throws:

`NotFoundError: Failed to execute 'removeChild' on 'Node'`

React then unmounts the application root, leaving only the dark body background.

## Considered Approaches

### Rich-text editor

1. Revert to `<textarea>`.
   - Safest editing primitive, but loses inline rich-text rendering.
2. Keep React-rendered spans and intercept every browser edit.
   - Retains the current rendering model, but remains fragile across IME, paste, selection deletion, and browser-specific DOM mutations.
3. Use an imperative `contentEditable` DOM island.
   - React owns only the editor root. Formatting spans are created imperatively, and the browser may mutate them without conflicting with React’s child reconciliation.

Approach 3 is selected because it preserves rich formatting and removes the ownership conflict at its source.

### Scene numbers

1. Add a schema migration from full labels to a separate suffix map.
   - Clean model, but adds migration complexity and touches every number consumer.
2. Keep the existing `numbers` map and reconcile each unlocked label as `<automatic index><alphabetic suffix>`.
   - Backward compatible and localized.

Approach 2 is selected. For example, stored `12A` becomes `13A` if a scene is inserted before it. Production-locked numbering remains stable.

### Project duplication

1. Copy the current project file at the filesystem layer.
   - Preserves the same project ID and collaboration identity, which can merge recent-project entries and reconnect both copies to the same collaboration room.
2. Clone the project in the application, assign a new project ID and title, clear collaboration identity, and save through the normal picker.
   - Produces an independent project while preserving screenplay content and metadata.

Approach 2 is selected.

## Architecture

- `RichScriptBlockEditor.tsx` becomes an uncontrolled DOM island with imperative formatted-run rendering and selection restoration.
- `sceneNumbering.ts` owns suffix sanitization, label reconciliation, and immutable label updates.
- `projectDuplication.ts` owns independent project cloning.
- `App.tsx` wires duplication into the File menu and scene-number editing into the outline.
- `tauri.conf.json` starts the main window hidden, maximized, and dark; `src-tauri/src/lib.rs` reveals it on `PageLoadEvent::Finished`.
- Existing project-history commit paths reconcile unlocked scene labels so insertion, deletion, and reordering remain automatic.

## Error Handling

- Invalid scene-number characters are discarded; suffixes are uppercase A-Z and may contain multiple letters.
- Scene-number inputs are disabled when production numbering is locked.
- Cancelling the duplicate save leaves the original project active and unchanged.
- Duplicate projects clear collaboration room, key, mode, LAN URL, and protocol fields.
- Window reveal failures are logged to stderr without terminating the application.

## Testing

- A headless Chromium reproduction must fail before the editor fix with the `removeChild` exception and blank app root, then pass after the fix.
- Unit tests cover duplicate identity/title/collaboration behavior.
- Unit tests cover suffix preservation and renumbering after insertion/reordering.
- UI source tests cover the File-menu item, “Shortcuts” label, and editable scene-number control.
- Tauri scaffold tests cover hidden/maximized/dark startup and reveal-on-load.
- Full Vitest, ESLint, TypeScript/Vite build, Rust formatting/tests, and desktop bundle checks run before release.
