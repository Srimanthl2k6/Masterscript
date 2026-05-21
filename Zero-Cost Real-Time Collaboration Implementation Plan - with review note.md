# Zero-Cost Real-Time Collaboration Implementation Plan

## Summary

MasterScript is currently a local-first React/Electron app with one central document state: `history.present` in `src/App.tsx`, typed as `ScriptProject` from `src/types/screenplay.ts`. There is no store/context layer, no networking code, and no sync code today. All document edits ultimately mutate a cloned `ScriptProject` through `commit(...)` or direct `setHistory(...)`, then autosave writes the whole project JSON to Electron user data via `project:autosave`.

Implement collaboration as an opt-in session layer that attaches only after a project is loaded or created, mirrors the current `ScriptProject` into a Yjs document, routes document edits through Yjs while collaboration is active, and keeps existing autosave/file/import/export JSON behavior intact.

## 1. Data Model

Current exact top-level `ScriptProject` shape is defined in `src/types/screenplay.ts`:

```ts
{
  id: string
  schemaVersion: number
  meta: ScriptProjectMeta
  blocks: ScriptBlock[]
  revisionSnapshots: RevisionSnapshot[]
  revisionDraftSets: RevisionDraftSet[]
  dialogueStash: DialogueStashItem[]
  cards: StoryCard[]
  production: { schedule: ScheduleEntry[]; breakdown: BreakdownEntity[]; shots: ShotListItem[]; crew: CrewMember[] }
  budget: { items: BudgetItem[] }
  storyboards: StoryboardPanel[]
  catalog: CatalogEntry[]
  story: StoryDevelopmentState
  characters: CharacterToolsState
  productivity: ProductivityState
  tagging: TaggingState
  advanced: AdvancedState
}
```

`ScriptBlock` is the primary editor unit:

```ts
{
  id: string
  type: BlockType
  text: string
  revision: RevisionColor | null
  extension?: ScriptExtension | null
  dualDialogueId?: string | null
  dualDialogueSide?: DualDialogueSide | null
  revisionMark?: boolean
  locked?: boolean
  omitted?: boolean
  omittedText?: string | null
  lockedPageLabel?: string | null
}
```

Yjs should not wrap the current object as one opaque JSON blob because concurrent edits to `blocks[*].text` would degrade into last-writer-style replacement. Use a structured Yjs model:

- `ydoc.getMap('project')` for scalar/top-level project fields.
- `project.get('meta')` as `Y.Map`.
- `project.get('blocks')` as `Y.Array<Y.Map>`.
- Each block map stores scalar fields plus `text: Y.Text`.
- Lower-risk nested arrays/maps such as `cards`, `production`, `story`, `characters`, `tagging`, and `advanced` can start as JSON values in `Y.Map` and be promoted later if those tabs need fine-grained simultaneous editing.

Shared in v1:

- `id`, `schemaVersion`, `meta`, `blocks`, `revisionSnapshots`, `revisionDraftSets`, `dialogueStash`.
- Keep full-project serialization compatible so existing `.msproj.json`, autosave, and export paths still receive a normal `ScriptProject`.

Local-only:

- React UI state in `src/App.tsx`: `appView`, `activeTab`, `selectedSceneId`, drag IDs, selected report/tag/cast fields, command/find state, `selectedBlockId`, `previewZoom`, `previewPageIndex`, `sceneFilterQuery`, `recentProjects`, `themeMode`.
- Cursor/selection should be local by default, optionally broadcast as Yjs awareness only, never saved into `ScriptProject`.
- `productivity.settings` is currently stored inside the project; leave it as project data for compatibility, but avoid using it for collaborator presence or session state.

## 2. Yjs Integration Point

Add a collaboration module rather than expanding `src/App.tsx` further:

- Create `src/lib/collaboration/projectYjs.ts` for `scriptProjectToYDoc`, `yDocToScriptProject`, `applyProjectToYDoc`, `applyTextDiff`, and block lookup helpers.
- Create `src/lib/collaboration/useCollaborationSession.ts` for provider lifecycle, awareness, status, encryption config, and autosave flushing.
- Import the hook into `src/App.tsx` near the existing `history` state around `const project = history.present`.

Initialization flow:

1. Existing load paths stay first:
   - Autosave restore: `restoreAutosave` in `src/App.tsx`.
   - Desktop file open: `openProject`.
   - Browser file open: `onProjectFilePicked`.
   - Imports: `applyImportedProject`.
   - New document: `createNewProject`.
2. After `hydrateProject(...)` or `createEmptyProject()` sets `history.present`, collaboration may attach to that hydrated project.
3. Yjs must never initialize from an unhydrated parsed JSON object.

Edit routing:

- Replace the current `commit(updater, status)` internals with a document mutation gateway.
- When collaboration is inactive, preserve current behavior exactly.
- When collaboration is active:
  - Clone current `project`.
  - Apply the existing updater to the clone.
  - Write the resulting document into Yjs using `ydoc.transact(..., LOCAL_ORIGIN)`.
  - Render React state from `yDocToScriptProject(ydoc)`.
- Refactor direct `setHistory(...)` document mutations into the same gateway. Important direct writers include `onBlockTextChange`, `beginRevisionSet`, `lockSelectedScene`, `unlockSelectedScene`, `omitSelectedScene`, `unomitSelectedScene`, `stashContinuousSelection`, `swapStashIntoFirstDialogue`, `markRecentDialogueAsDual`, character arc/profile helpers, and import/open/new reset paths.

Text writes:

- `onBlockTextChange` currently calls `updateBlockTextWithRevisionTracking(project, blockId, text)` and then `setHistory(...)`.
- In collaborative mode, keep the locked/revision checks, but apply text changes to the target block’s `Y.Text` using a prefix/suffix diff so concurrent typing benefits from Yjs text CRDT behavior.
- `onContinuousDraftChange` currently reparses the entire textarea into `draft.blocks`; keep it disabled from collaboration initially or route it as a full block-array replacement because it cannot reliably preserve concurrent per-block edits. Since `useContinuousDraftEditor` is currently `false`, this is not a v1 blocker.

Feedback-loop prevention:

- Use `LOCAL_ORIGIN = Symbol('masterscript-local')`.
- Use `REMOTE_ORIGIN = Symbol('masterscript-remote')` or provider origin checks.
- Yjs observers update React only when `transaction.origin !== LOCAL_ORIGIN`, or update through a single `syncReactFromYDoc` path guarded by `isApplyingYjsRef`.
- Autosave listens to React `project` as today, plus a collaboration disconnect flush that serializes directly from Yjs.

## 3. LAN Mode

Start/stop the local WebSocket server in `electron/main.cjs`.

Add main-process state:

- `collaborationServer`
- `collaborationHttpServer`
- `collaborationPort`
- `collaborationRoomId`

Use `y-websocket@2.1.0`, not `3.0.0`, because `3.0.0` no longer ships the server. Use `setupWSConnection` from `y-websocket/bin/utils` with a Node `http` server and `ws`.

Add IPC handlers in `electron/main.cjs`:

- `collaboration:lan-host`:
  - Accept `{ roomId?: string; port?: number }`.
  - Start on requested port or `0` for an available port.
  - Bind to `0.0.0.0`.
  - Return `{ ok, roomId, port, hostUrls, primaryHostUrl }`.
- `collaboration:lan-stop`:
  - Close WebSocket clients, close the HTTP server, clear state.
  - Return `{ ok: true }`.
- `collaboration:lan-status`:
  - Return running state and connection info.
- `collaboration:lan-join`:
  - Renderer primarily handles joining, but expose this to validate/normalize `{ serverUrl, roomId }` and keep the preload API symmetrical.

Expose in `electron/preload.cjs` under `window.masterscript`:

- `hostLanCollaboration(options)`
- `joinLanCollaboration(options)`
- `stopLanCollaboration()`
- `getLanCollaborationStatus()`

Update `src/types/electron.d.ts` with the exact return types.

Local IP detection:

- In `electron/main.cjs`, use `os.networkInterfaces()`.
- Filter IPv4, non-internal addresses.
- Prefer Wi-Fi/Ethernet-like interfaces only by ordering, not hardcoded names.
- Return all usable URLs, for example `ws://192.168.1.12:12345`, and let the renderer display the primary plus alternates.

## 4. WebRTC P2P Mode

Use `y-webrtc@10.3.0` in the renderer with:

- `new WebrtcProvider(roomName, ydoc, { signaling, password, peerOpts })`.
- `signaling` loaded from one config file: `src/lib/collaboration/collaborationConfig.ts`.
- Default public signaling: `['wss://signaling.yjs.dev']`.
- Future self-hosted signaling becomes a one-line config change in that file.

STUN config:

- Store in `collaborationConfig.ts` as `DEFAULT_RTC_CONFIGURATION`.
- Use public STUN by default, for example Google STUN entries, with a comment that TURN is intentionally omitted for zero-cost v1.
- Pass through `peerOpts: { config: DEFAULT_RTC_CONFIGURATION }`.

Provider choice:

- LAN mode: `WebsocketProvider` from `y-websocket`.
- Internet/P2P mode: `WebrtcProvider` from `y-webrtc`.
- Keep provider construction behind `createCollaborationProvider(...)` so UI code does not branch on provider internals.

## 5. Encryption

Use provider-level encryption, not document-level encryption:

- Do not encrypt values inside `Y.Doc`; the editor, autosave, import/export, and existing helper functions need normal text/project data.
- For WebRTC, pass the session secret as `password` to `y-webrtc`.
- For LAN WebSocket, add a custom encrypted WebSocket provider wrapper or fork/wrap the y-websocket message send/receive path so Yjs binary updates are encrypted before network transmission and decrypted before `Y.applyUpdate`.

AES-256-GCM design:

- Derive a non-extractable `CryptoKey` with Web Crypto using PBKDF2 or HKDF from:
  - a human join key,
  - room id,
  - random host-generated salt.
- Use AES-GCM with a fresh 96-bit IV per outbound Yjs update.
- Transmit `{ version, salt, iv, ciphertext }` frames.
- Keep the key in memory for the session only; do not write it to `.msproj.json`, autosave, recent snapshots, or localStorage.
- Host UI shows room name, LAN/WebRTC address, and join key.
- Guest UI requires address/room and join key before creating the provider.
- For v1, treat a wrong key as “unable to decrypt/collaborate” and keep the local document unchanged.

## 6. Offline Safety

Current disk load/save files:

- Desktop autosave path is `getAutosavePath()` in `electron/main.cjs`, writing `app.getPath('userData')/autosave.msproj.json`.
- Desktop autosave read is IPC `project:read-autosave`.
- Desktop file open is IPC `project:open-file`.
- Direct recent-file open is IPC `project:open-path`.
- Browser project load is `onProjectFilePicked` in `src/App.tsx`.

Attach Yjs after load:

- `hydrateProject(...)` must run before Yjs conversion.
- `scriptProjectToYDoc(hydratedProject)` is called only after `setHistory({ past: [], present: hydratedProject, future: [] })` or inside the same collaboration start action using the hydrated object.

Flush-on-disconnect:

- Put flush logic in `useCollaborationSession.ts`.
- On provider `status: disconnected`, `connection-close`, `beforeunload`, and explicit `stop`, serialize `yDocToScriptProject(ydoc)` and call existing `window.masterscript.autosave(project)` or browser `localStorage.setItem(autosaveKey, ...)`.
- Keep the existing 220 ms autosave effect in `src/App.tsx` as the normal steady-state save path.

Force close behavior:

- Today, any change inside the 220 ms debounce window can be lost on force-close.
- Add `y-indexeddb@9.0.12` for local Yjs update persistence while a collaboration session is active.
- On normal restart, load the JSON autosave first, then merge any room-specific IndexedDB Yjs updates before reconnecting.
- If the OS hard-kills the process during the final milliseconds before IndexedDB/autosave completes, no desktop app can guarantee zero loss; document that the residual risk is the last unflushed event.

## 7. Connection State UI

Existing status UI:

- Header actions live in `src/App.tsx` around the `header-actions` block.
- Footer statusbar lives in `src/App.tsx` at `footer.statusbar`.
- Autosave pill uses `autosaveState` and `statusMessage`.

Add collaboration UI:

- Add a compact “Collaborate” button beside `Share` in the header.
- Add a footer pill next to the autosave pill with states:
  - `Offline`
  - `Hosting`
  - `Connected`
  - `Disconnected`
  - `Reconnecting`
- Use `statusMessage` for detailed transient messages like “Hosting LAN session at ws://...”.

Disconnect behavior:

- Continue editing offline.
- Provider attempts reconnect automatically where supported.
- Show `Reconnecting` while provider is trying.
- Do not block edits or prompt immediately.
- On explicit stop, flush autosave and return to `Offline`.
- On remote peer disappearance, keep local editing active and autosave local state.

## 8. Dependencies

Install exact runtime dependencies:

- `yjs@13.6.30`
- `y-websocket@2.1.0`
- `y-webrtc@10.3.0`
- `ws@8.20.1`
- `y-indexeddb@9.0.12`

Do not install `y-websocket@3.0.0` for this plan because current `3.x` package metadata does not include the server entrypoints needed for Electron LAN hosting. Do not use `@y/websocket-server@0.1.5` because it targets Yjs 14 prerelease packages and conflicts with stable `yjs@13`.

No direct conflict with existing dependencies in `package.json`; the app currently has no Yjs, WebSocket, or WebRTC provider packages. `y-webrtc` also depends on `ws`, but keep `ws@8.20.1` explicit for the Electron main LAN server.

References used for version/API verification: npm metadata for `yjs`, `y-websocket`, `y-webrtc`, `ws`, `y-indexeddb`; Yjs provider docs at https://docs.yjs.dev/ecosystem/connection-provider/y-websocket and https://docs.yjs.dev/ecosystem/connection-provider/y-webrtc.

## 9. Risk & Sequencing

Riskiest part:

- The biggest risk is not Yjs itself; it is `src/App.tsx` having many direct `setHistory(...)` document mutations outside `commit(...)`. If only `commit(...)` is Yjs-aware, collaboration will silently miss edits from revision, production, planning, character, and import workflows.

Recommended implementation order:

1. Add tests for pure project/Yjs conversion:
   - `ScriptProject -> Y.Doc -> ScriptProject` preserves `createEmptyProject()`.
   - Block text, type, revision fields, meta fields, and snapshots round-trip.
2. Add `projectYjs.ts` pure helpers.
3. Refactor document mutation in `src/App.tsx` into a single gateway while keeping collaboration inactive.
4. Add tests that existing editor actions still update `history.present`: title edit, block text edit, add/remove/reorder block, import/open hydration.
5. Add Yjs-backed local session mode with no network provider, proving local Yjs observer updates React without feedback loops.
6. Add LAN IPC in `electron/main.cjs`, `electron/preload.cjs`, and `src/types/electron.d.ts`.
7. Add `WebsocketProvider` LAN host/join renderer wiring.
8. Add WebRTC provider wiring with config in `collaborationConfig.ts`.
9. Add encryption wrapper/key UI after plain sync works.
10. Add disconnect flush and `y-indexeddb` persistence.
11. Add collaboration status UI in header/footer.
12. Run `npm run test`, `npm run lint`, and `npm run build:web`.

Refactors needed before clean Yjs integration:

- Centralize project writes; this is required.
- Split collaboration logic out of `src/App.tsx`; this is strongly recommended because `App.tsx` is already very large.
- Keep import/export adapters unchanged; they should continue consuming/producing plain `ScriptProject`.

Acceptance tests/scenarios:

- Two windows join the same LAN room; typing in one block appears in the other without duplicating local keystrokes.
- Two users edit different blocks concurrently; both edits persist.
- Two users edit the same block concurrently; text converges without whole-block overwrite.
- Add, delete, and reorder blocks while another peer is typing.
- Revision mode marks collaborative text edits with the active revision color.
- Host disconnects; guest remains editable offline and autosaves.
- Guest reconnects; Yjs converges.
- Save Project writes a normal `.msproj.json`.
- Open Project hydrates from disk before collaboration attaches.
- Fountain, FDX, DOCX, PDF, TXT, RTF, HTML, scene CSV, and workbook exports still read from current `project`.
- Wrong room key cannot decrypt/join and does not corrupt local project state.

Assumptions/defaults:

- Collaboration is opt-in per session, not always-on.
- LAN hosting is the primary zero-cost path; WebRTC is secondary for non-LAN sessions using public signaling.
- TURN is omitted in v1 to preserve zero-cost operation, so some restrictive networks may fail WebRTC.
- The `.msproj.json` schema remains unchanged for v1.

---

## Implementation Review Note

Yes, this is an excellent plan. It's thorough, specific, and grounded in the actual codebase rather than generic Yjs advice.

A few things it gets particularly right:

**The biggest risk is correctly identified.** The direct `setHistory(...)` mutations scattered outside `commit()` is exactly the kind of thing that would cause silent collaboration failures. Catching this before writing any network code is the right call.

**The data model decision is sound.** Using `Y.Array<Y.Map>` for blocks with `Y.Text` per block is the correct granularity. A single JSON blob would have been a lazy shortcut that breaks concurrent editing entirely.

**Offline safety is properly sequenced.** Attaching Yjs after hydration, not before, is the one rule that must not be violated. The plan enforces it explicitly.

**The version pinning is important.** The `y-websocket@2.1.0` call-out is not pedantry — `3.x` genuinely broke the server entrypoints and would have wasted hours.

The only things worth watching as implementation proceeds:

- **Step 3 in the sequencing** — centralizing all document mutations into one gateway — is the hardest step and will take longer than it looks. `App.tsx` being large means there are likely mutations the plan hasn't enumerated. Tell the agent to grep for every `setHistory` and `history.present` write before considering that step done.

- **`y-indexeddb` and the force-close risk** is honestly documented. Don't let anyone talk you into overengineering this further — the plan's acknowledgment that the last unflushed event can't be guaranteed is the correct and honest answer.

- **TURN omission** is the right call for v1 but will surface as a real complaint from users on corporate or university networks with strict NAT. Just make sure the error message when WebRTC fails is clear: “could not connect peer-to-peer — your network may block this” rather than a generic failure.

Overall: hand this to the agent and implement it as written.

## Implementation Review Update

Implemented on branch `feat/zero-cost-collaboration`.

What landed:

- Added pinned collaboration dependencies: `yjs@13.6.30`, `y-webrtc@10.3.0`, `ws@8.20.1`, and `y-indexeddb@9.0.12`.
- Added a structured Yjs project mapper in `src/lib/collaboration/projectYjs.ts` with tests covering round-trip serialization, block metadata, revision snapshots, text diffing, and block structural updates.
- Added a collaboration session hook with IndexedDB persistence, WebRTC provider support, autosave flushing, and React feedback-loop protection.
- Added an encrypted LAN provider for Yjs update frames using AES-GCM over a local Electron WebSocket relay.
- Added Electron IPC for LAN host/join/stop/status plus local IP URL discovery.
- Added a collaboration panel and footer status pill in the main app UI.

Implementation note:

- The LAN transport uses a custom encrypted relay instead of the plaintext `y-websocket` server protocol. This preserves the plan's provider-level encryption requirement; a stock `y-websocket` server needs plaintext Yjs protocol frames and is not compatible with end-to-end encrypted update payloads without a deeper protocol fork.
- `y-websocket@2.1.0` was removed during release hardening because it was not used by the encrypted LAN relay and pulled `y-leveldb -> leveldown`, which broke macOS universal packaging when Electron Builder tried to merge identical arm64 native binaries with `lipo`.

Verification:

- Baseline before changes: `npm test` passed with 20 files and 103 tests.
- Added tests: collaboration mapper suite brings totals to 21 files and 108 tests.
- Final checks run: `npm test`, `npm run lint`, `npm run build:web`, `node --check electron/main.cjs`, and `node --check electron/preload.cjs`.
