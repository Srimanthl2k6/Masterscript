# MasterScript Stability, Duplication, and Scene Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship MasterScript 0.5.0 with stable rich-text deletion, flash-free maximized startup, project duplication, renamed shortcut settings, and editable auto-renumbering scene suffixes.

**Architecture:** The editor becomes an imperative DOM island so React does not reconcile browser-mutated children. Pure helpers own duplication and scene-number rules, while App wiring remains thin. Tauri creates the main window hidden/maximized and reveals it after initial page load.

**Tech Stack:** React 19, TypeScript 6, Vitest 4, Vite 8, Tauri 2.11, Rust 2021, GitHub Actions

---

### Task 1: Add failing behavior tests

**Files:**
- Modify: `src-tauri/tauri-scaffold.test.ts`
- Modify: `src/workspaceUi.test.ts`
- Create: `src/lib/projectDuplication.test.ts`
- Create: `src/lib/sceneNumbering.test.ts`

- [ ] **Step 1: Add startup-shell expectations**

Assert that the main Tauri window has `maximized: true`, `visible: false`, `backgroundColor: "#0a0a0a"`, and that `src-tauri/src/lib.rs` contains `PageLoadEvent::Finished` plus `window.show()`.

- [ ] **Step 2: Add UI expectations**

Expect the File menu to include `Duplicate`, the shortcut summary to contain `Shortcuts` without `Remap shortcuts`, and the outline source to render `scene-number-input`.

- [ ] **Step 3: Add duplication tests**

Create a project with collaboration metadata and assert that `duplicateProject`:

```ts
expect(copy.id).not.toBe(source.id)
expect(copy.meta.title).toBe('Draft Copy')
expect(copy.blocks).toEqual(source.blocks)
expect(copy.meta.collaborationRoomId).toBeUndefined()
expect(source.meta.title).toBe('Draft')
```

- [ ] **Step 4: Add scene-number tests**

Create scenes with `1`, `2A`, and `3`, insert a scene before the second scene, and assert reconciled labels are `1`, `2`, `3A`, `4`. Also assert locked numbering is unchanged and invalid suffix characters are removed.

- [ ] **Step 5: Run tests and verify RED**

Run:

```powershell
npm test -- src-tauri/tauri-scaffold.test.ts src/workspaceUi.test.ts src/lib/projectDuplication.test.ts src/lib/sceneNumbering.test.ts
```

Expected: failures for missing startup flags, missing helpers, missing Duplicate UI, and the old shortcut label.

### Task 2: Fix rich-text DOM ownership

**Files:**
- Modify: `src/components/RichScriptBlockEditor.tsx`

- [ ] **Step 1: Remove React-managed editor children**

Render only the root `<div contentEditable>` from JSX. Do not render `runs.map(...)` as React children.

- [ ] **Step 2: Add imperative formatted-run rendering**

Use `useLayoutEffect` and `document.createElement('span')` to build formatted runs. Call `root.replaceChildren(...)` only when text or formatting differs from the current DOM, then restore the pending selection.

- [ ] **Step 3: Preserve normal browser edits**

During `onInput`, read text and selection and forward them without synchronously rewriting the DOM. The next render should skip replacement when the browser DOM already matches plain text and formatting.

- [ ] **Step 4: Verify the original browser reproduction**

Run the local headless-browser reproduction that selects an entire dialogue line and presses Backspace.

Expected: `.app-shell` remains present, the dialogue editor remains empty, and no `NotFoundError` or React uncaught error is recorded.

### Task 3: Add scene-number suffix behavior

**Files:**
- Create: `src/lib/sceneNumbering.ts`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Implement pure helpers**

Export:

```ts
sanitizeSceneNumberSuffix(input: string): string
reconcileSceneNumberLabels(project: ScriptProject): ScriptProject
updateSceneNumberLabel(project: ScriptProject, blockId: string, input: string): ScriptProject
```

Unlocked labels use the current scene index plus the existing alphabetic suffix. Locked projects return unchanged clones.

- [ ] **Step 2: Reconcile all project-history writes**

Wrap both updater-based commits and replacement commits so unlocked scene labels are reconciled after mutations.

- [ ] **Step 3: Render editable labels**

Replace the outline’s single button with a container holding:

```tsx
<input
  className="scene-number-input"
  value={sceneNumberLabelById.get(scene.blockId) ?? ''}
  disabled={project.advanced.sceneNumbering.locked}
  aria-label={`Scene number for ${scene.heading}`}
/>
```

The adjacent heading button retains scene navigation.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- src/lib/sceneNumbering.test.ts src/workspaceUi.test.ts
```

Expected: all focused tests pass.

### Task 4: Add independent project duplication

**Files:**
- Create: `src/lib/projectDuplication.ts`
- Modify: `src/workspaceFileMenu.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement duplication helper**

Deep-clone the source project, assign a new UUID, append ` Copy` unless already present, refresh `createdAt` and `updatedAt`, and delete all collaboration identity fields.

- [ ] **Step 2: Add File > Duplicate**

Add `duplicate` to `WorkspaceFileMenuItemId` and the Project menu group after Open.

- [ ] **Step 3: Save and activate the duplicate**

Desktop flow:

```ts
const duplicate = duplicateProject(project)
const result = await desktopBridge.saveProject(duplicate, duplicate.meta.title)
```

Only after a successful save should the duplicate replace the active history and saved file reference. Web flow downloads and activates the independent copy.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- src/lib/projectDuplication.test.ts src/workspaceUi.test.ts
```

Expected: all focused tests pass.

### Task 5: Fix startup flash and labels

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/components/ShortcutRemapPanel.tsx`

- [ ] **Step 1: Configure startup window**

Set:

```json
"maximized": true,
"visible": false,
"backgroundColor": "#0a0a0a"
```

- [ ] **Step 2: Reveal after page load**

Register `Builder::on_page_load`; on `PageLoadEvent::Finished`, call `window.maximize()` and `window.show()`.

- [ ] **Step 3: Rename shortcut section**

Change the summary text from `Remap shortcuts` to `Shortcuts`.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- src-tauri/tauri-scaffold.test.ts src/workspaceUi.test.ts
```

Expected: all focused tests pass.

### Task 6: Prepare and verify 0.5.0

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Synchronize versions**

Set JavaScript, Tauri, and Rust package versions to `0.5.0`.

- [ ] **Step 2: Correct release notes**

Replace stale security-hardening updater/release notes with wording covering editor stability, project duplication, scene numbers, and startup behavior.

- [ ] **Step 3: Run complete verification**

Run:

```powershell
npm test
npm run lint
npm run build:web
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build -- --config src-tauri/tauri.ci.conf.json --bundles nsis
```

Expected: every command exits 0. Rust commands must run from a Visual Studio developer environment that exposes `link.exe`.

### Task 7: Review, publish, and release

**Files:**
- Review all changed files

- [ ] **Step 1: Review the final diff**

Confirm no unrelated user changes, temporary browser scripts, generated logs, or build outputs are tracked.

- [ ] **Step 2: Commit and push**

Commit with:

```powershell
git commit -m "Release MasterScript 0.5.0"
git push -u origin codex/stability-duplication-scene-numbers
```

- [ ] **Step 3: Create and merge the pull request**

Create a ready PR summarizing root cause, features, and verification. Merge it into `main` after checks pass.

- [ ] **Step 4: Tag and publish**

Create and push annotated tag `v0.5.0`, monitor the `Tauri Desktop Release` workflow, and verify the published GitHub release contains the required Windows, macOS, Linux, updater, and checksum assets.
