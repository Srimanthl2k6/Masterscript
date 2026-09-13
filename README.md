# MasterScript

MasterScript 0.7.0 is a local-first screenplay application for web, desktop and terminal. Projects use the same portable `.msproj.json` format across all three.

## Start writing

On the hosted website, choose **Use Web** (`#/app`) to open the workspace, or **Download** (`#/download`) for installers. The desktop app opens its workspace directly. Web editing uses browser storage and downloadable project files; keep a saved file as your portable copy. Desktop and terminal work offline. The hosted web app needs its assets to load; it does not install an offline service worker.

`Enter` splits the block at the caret, replacing selected text and moving the right-hand text into the inferred next element. `Shift+Enter` inserts a newline, `Tab` cycles element types, and Ctrl/Cmd+Z and redo use project history. Splitting preserves formatting, revision and collaboration data; locked and omitted scenes remain protected.

## Automatic breakdown and reports

The shared local Scene Analysis engine reads headings, dialogue cues, action, character profiles and aliases. It detects speaking and silent cast, extras, props, wardrobe, makeup, animals, vehicles, effects, stunts, music, locations and set dressing from explicit evidence. It uses conservative English screenplay rules, not a cloud service or language model. Review its first pass, particularly for ambiguous language, unusual names and multilingual scripts.

Open **Breakdown** to see items grouped by department for the selected scene. Add, rename, recategorize, confirm or reject items; edit notes/cost; and add/remove scene occurrences. Reanalyse preserves corrections and rejections. **Restore rejected items** clears suppression records without discarding edits. Existing tags remain manual data; older schema-1 files hydrate without a format conversion.

Scene, Character, Location and Department reports share analysis and corrections. Silent appearances count toward presence; Dialogue Report counts actual speech separately. Sub-locations remain distinct. Scene cards show production requirements without a wide table. Reports support CSV/PDF exports. Page counts and screen-time shares are estimates.

Analysis caches individual scenes and debounces report updates. Known-character changes can invalidate multiple scenes. Semantic extraction stays off the drafting keystroke path.

## Downloads and platforms

Get the [latest release](https://github.com/Srimanthl2k6/Masterscript/releases/latest). The download page recommends the detected desktop platform and keeps every format visible.

| Platform | Desktop | Standalone terminal |
| --- | --- | --- |
| Windows x64 | `MasterScript.Setup.exe` | `masterscript-tui.windows.x86_64.exe` |
| macOS Intel / Apple Silicon | `MasterScript.mac.universal.dmg` | `masterscript-tui.macos.universal` |
| Linux x64 | AppImage, deb, rpm, pkg.tar.zst | `masterscript-tui.linux.x86_64` |

Assets have versioned filenames and stable aliases under `releases/latest/download/`. `release-assets.json` is the website/release contract. Releases include SHA-256 checksums and signed Tauri updater metadata. macOS binaries are universal; platform security policies may require approval for an app without Apple notarization.

Make the Linux AppImage executable before launching, or install the native package with your distribution's package manager. Native deb/rpm/Arch packages install `masterscript-tui` in `/usr/bin`; desktop bundles also include it as a resource. Standalone terminal downloads need no Node.js. On Unix, use `chmod +x` and optionally rename the executable to `masterscript-tui` on your PATH.

### Arch Linux

```sh
sudo pacman -U MasterScript.linux.x86_64.pkg.tar.zst
```

Every release includes a `masterscript-bin` PKGBUILD and .SRCINFO generated from the actual versioned archive and SHA-256 checksum. Download the recipe into an empty directory, inspect it, then run `makepkg -si`. CI compares generated .SRCINFO and installs both the recipe-built and direct packages with pacman.

**AUR publication is not yet configured.** Do not assume `yay -S masterscript-bin` exists. Configure repository environment `aur-publishing` secrets `AUR_SSH_PRIVATE_KEY` (an authorized AUR maintainer key) and `AUR_KNOWN_HOSTS` (the verified pinned SSH host entry). The [AUR workflow](.github/workflows/aur.yml) then publishes after verified releases. See [packaging/aur](packaging/aur/README.md).

## Terminal editor

```sh
masterscript-tui
masterscript-tui screenplay.msproj.json
masterscript-tui --help
```

| Keys | Action |
| --- | --- |
| Type, Enter, Tab | Edit, split at caret, cycle block type |
| Left/Right, Home/End | Move caret |
| Up/Down, Alt+Up/Down | Change block / scene |
| Ctrl+Enter, Ctrl+Delete | Insert / delete block |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+F | Search |
| Ctrl+N / Ctrl+O | New / open |
| Ctrl+S / Ctrl+Shift+S | Save / save as |
| F1 / F2 / F3 | Help / title / author |
| F4 / F5 | Reports / breakdown |
| F6 / F7 / F8 | Add / edit / reject or delete item |
| F9 / F10 | Add / remove occurrence |
| PgUp/PgDn, Esc | Scroll report, return to editor |
| Ctrl+Q | Quit |

Report names: `scene`, `character`, `location`, `department`, `dialogue`, `summary`; use `department|Props` for a department. Add items as `Props|backpack`. Breakdown displays IDs for edits such as `item-ID|{"notes":"Hero prop","cost":25}` and occurrence management. F1 documents all prompt formats. The graphical workspace remains the fuller interface for planning, boards, collaboration controls and rich formatting. Use it for PDF/CSV exports; terminal provides report views and saved projects.

Save replaces the project atomically. A separate recovery copy is written every 30 seconds while dirty; its path is displayed. Quit, Open and New require typing `DISCARD` when work is unsaved. Save As asks before replacing another file. Resizing preserves editing state.

## Desktop updates

Desktop checks about five seconds after startup, every six hours, and after connectivity returns. Standalone installs download signed updates in the background. Installation waits until the workspace is hidden or at Home, collaboration is offline, and input has been idle for two minutes. Input is then frozen and autosave, the opened file and recovery snapshot must save successfully. Failures defer installation and retry with backoff.

Linux AppImages use this updater after verifying the executable is inside the AppImage runtime directory. Other Linux installs receive package-manager guidance. Windows/macOS standalone installs use Tauri's signed installer flow. Common Scoop, Chocolatey, WinGet portable, WindowsApps, Homebrew, MacPorts and Nix installation paths defer to their package manager; symlinks are resolved before detection. Custom manager layouts that install into ordinary standalone paths may not be identifiable.

## Development and release

Install Node.js 22, current Rust stable and your OS's Tauri prerequisites.

```sh
npm ci
npm run dev:web
npm run dev
npm test
npm run lint
npm run build:web
npx playwright install chromium
npm run test:e2e
npm run test:tui
npm run build:tui
npm run tauri:build -- --config src-tauri/tauri.release.conf.json
```

The terminal uses Rust/Ratatui and embeds a build of the shared TypeScript project/history/split/report/breakdown modules in QuickJS. It does not execute screenplay contents or require a separate runtime. `tui/generated`, `tui/target`, `tui/dist` and the generated Tauri release config are build outputs.

Tagging synchronized versions as `vX.Y.Z` triggers cross-platform tests/builds, Windows performance gates, browser tests, Arch installation checks, isolated updater signing, checksums and a draft-release download verification before publication. Signing secrets remain confined to `release-signing`. See [0.7.0 release notes](docs/releases/0.7.0.md).
