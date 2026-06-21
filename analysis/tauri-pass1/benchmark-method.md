# Electron baseline method

The repeatable baseline uses generated projects with exactly 5, 50, and 200 printable script pages. Fixtures are generated from the production screenplay schema and pagination code.

`npm run benchmark:electron`:

- starts Electron 41 with the unchanged Vite renderer in headless mode;
- uses a disposable Chromium profile;
- seeds each fixture through the same recent-project snapshot storage used by the UI;
- opens the fixture through the visible Recent Activity workflow;
- captures 1600×980 PNG screenshots;
- records total Electron working set/private bytes and renderer heap/DOM metrics.

`electron-runtime-baseline.json` is the comparison source for the final RAM thresholds. `electron-install-baseline.json` records the installed footprint and a normal visible-window sample. `electron-web-bundle-baseline.json` records every built frontend asset.

The final performance gate must use the same host class, fixture files, viewport, idle delay, and measurement scripts for Electron and Tauri. Headless startup time is diagnostic; normal-window startup time is the release metric.
