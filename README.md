# discogs-cleaner-desktop

Native desktop app wrapper for [discogs-cleaner](https://github.com/nmyriad/discogs-cleaner).

Packages the web UI and Python server into a single Windows installer — no browser, no terminal, no setup required. Runs in your system tray and notifies you when updates are available.

> **Looking for the web UI?** → [nmyriad/discogs-cleaner](https://github.com/nmyriad/discogs-cleaner)

---

## What's included

- **Electron shell** — native window, system tray, update notifications
- **Bundled Python server** — `server.py` compiled to `server.exe` via PyInstaller, no Python install needed
- **discogs-cleaner** — included as a git submodule, always pointing to a tagged release

---

## Install

Download the latest installer from [Releases](https://github.com/nmyriad/discogs-cleaner-desktop/releases).

Run `discogs-cleaner Setup x.x.x.exe` — that's it. The app appears in your system tray.

---

## Building from source

### Requirements

- Python 3.x
- Node.js + npm

### Steps

```powershell
# Clone with submodule
git clone --recurse-submodules https://github.com/nmyriad/discogs-cleaner-desktop
cd discogs-cleaner-desktop

# Build installer
python build.py
```

The installer will be at `dist/discogs-cleaner Setup x.x.x.exe`.

---

## Updating the web UI core

The web UI (`discogs-cleaner`) is a git submodule. When a new version ships:

```powershell
cd discogs-cleaner
git pull origin main
cd ..
git add discogs-cleaner
git commit -m "chore: bump discogs-cleaner to vX.X"
git tag vX.X.X
git push origin main --tags
```

GitHub Actions will build and publish the new installer automatically.

---

## Auto-updates

The app checks GitHub Releases on launch. When an update is available a dialog appears — click **Download** then **Restart** to apply. No manual steps needed.

---

## Release process

```powershell
git tag v1.1.0
git push origin main --tags
```

GitHub Actions handles the rest — builds the installer and publishes the release.

---

## License

MIT

---

- nmyriad
