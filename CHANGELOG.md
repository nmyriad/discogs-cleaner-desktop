# Changelog — discogs-cleaner-desktop

---

## v1.3.0

### Fixed
- **Server failed to start** — `server.exe` was not being correctly located inside the packaged app. Updated `extraResources` in `package.json` to explicitly bundle `server.exe` and `index.html` at known paths, and updated `main.js` to resolve them correctly at runtime.
- **Unicode crash on launch** — `server.py` used a `→` arrow character that Windows cp1252 encoding could not handle, causing an unhandled exception on startup. Replaced with ASCII `->` and added a UTF-8 stdout wrapper for Windows compatibility.
- **`npm` not found during build** — Python subprocess on Windows requires `npm.cmd` rather than `npm`. Fixed in `build.py`.
- **dist/ and build artifacts tracked by git** — `dist/`, `node_modules/`, `python/`, and `build_tmp/` are now properly excluded via `.gitignore`.

### Improved
- **Rowroad artwork as app icon** — installer, window, and tray now use the Rowroad wave artwork as the icon across all sizes (16, 32, 48, 256px).
- **index.html served from bundled path** — `server.py` now accepts a `--index` argument so Electron can pass the correct path to `index.html` whether running in dev or packaged mode.
- **publish config corrected** — `package.json` now points to `nmyriad/discogs-cleaner-desktop` for auto-updates, not the web UI repo.

---

## v1.0.0 — initial release

- Electron wrapper around discogs-cleaner web UI
- Bundles Python server via PyInstaller — no terminal needed
- Native Windows installer (NSIS)
- System tray icon — runs quietly in background
- Click-to-update notifications via GitHub Releases
- Auto-checks for updates 5 seconds after launch
- Single `python build.py` command to produce installer
- Uses discogs-cleaner as a git submodule — always in sync with web UI releases

---

- nmyriad
