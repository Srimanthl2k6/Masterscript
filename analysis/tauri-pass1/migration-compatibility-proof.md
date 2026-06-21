# Migration and installer compatibility proof

## Classification

The installation classifier uses this order:

1. A valid Tauri `install-state-v1.json` means `existing-tauri`; its stored tutorial choice wins.
2. Otherwise, any Electron application-data evidence means `legacy-migrated`, `tutorialCompleted: true`, migration version 1.
3. With neither source, the installation is `fresh`, with automatic onboarding pending.

This order prevents a migrated installation from re-importing legacy data on every launch while ensuring that an uninstalled/reinstalled Electron user is never treated as new if their application data remains.

## Legacy locations

| Platform | Locations searched |
| --- | --- |
| Windows | `%APPDATA%\MasterScript`, `%APPDATA%\masterscript`, `%LOCALAPPDATA%\MasterScript`, `%LOCALAPPDATA%\masterscript` |
| macOS | `~/Library/Application Support/MasterScript`, lowercase variant |
| Linux | `$XDG_CONFIG_HOME/MasterScript` or `~/.config/MasterScript`, lowercase variant |

Both JavaScript and Rust tests cover these paths. Case variants are intentional because historical Electron naming and filesystem case sensitivity differ by platform.

## Manifest safety

Electron writes `migration-manifest-v1.json` inside its user-data directory. The main process overrides renderer input with:

- `schemaVersion: 1`
- `legacyInstall: true`
- `tutorialCompleted: true`
- the actual Electron autosave path

Malformed local-storage values are dropped independently. A malformed recent list cannot prevent theme, hosted-room, autosave-path, or valid snapshot export. Snapshot entries must have the minimum `ScriptProject` shape before export.

Pass 3 will add atomic/idempotent writes and corrupt-manifest recovery. Pass 4 will perform the one-time Rust import. Pass 1 deliberately does not import or delete user data.

## Installer replacement proof

The non-release CI workflow builds an internal Tauri installer on all target operating systems:

| Platform | Electron 0.1.13 artifact | Internal Tauri artifact | Replacement smoke test |
| --- | --- | --- | --- |
| Windows | NSIS EXE | NSIS EXE | Silently install Electron, seed roaming legacy data, install Tauri, verify sentinel survives |
| macOS | Universal DMG | Native-runner DMG | Copy Electron app, seed Application Support, replace app bundle from Tauri DMG, verify sentinel survives |
| Linux | AMD64 DEB | AMD64 DEB | Install Electron package, seed XDG config, install Tauri package, verify package and sentinel survive |

Artifacts are uploaded only to the workflow run. There is no release or updater publication path in this workflow.

The public Electron updater remains unchanged. Public cutover is prohibited until Pass 8 because signing, universal macOS output, complete Rust feature parity, and updater metadata are not part of the Pass 1 shell.

## Local prerequisite result

Rust 1.96.0 and Cargo 1.96.0 are installed. Local Windows Rust linking is blocked because the Microsoft C++ Build Tools/Windows SDK linker (`link.exe`) is absent. TypeScript tests, frontend builds, and configuration tests run locally; authoritative Rust builds and installer tests run on GitHub-hosted Windows, macOS, and Linux workers with the required toolchains.

This is an environment prerequisite, not a source-code bypass. A failed platform CI job blocks Pass 1 completion and therefore blocks permission to begin Pass 2.
