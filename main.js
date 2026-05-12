const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');

let mainWindow;
let tray;
let pythonProcess;
const SERVER_PORT = 7842;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const STATE_FILE = path.join(os.homedir(), '.discogs-cleaner', 'desktop-state.json');

// ─── State (last seen version for changelog) ──────────────────────────────────

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch { return {}; }
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

// ─── Python server ────────────────────────────────────────────────────────────

function getPythonAndScript() {
  if (app.isPackaged) {
    const serverExe = path.join(process.resourcesPath, 'python', 'server.exe');
    const indexHtml = path.join(process.resourcesPath, 'app', 'index.html');
    return { cmd: serverExe, args: ['--index', indexHtml] };
  } else {
    const serverScript = path.join(__dirname, 'discogs-cleaner', 'server.py');
    const indexHtml = path.join(__dirname, 'discogs-cleaner', 'index.html');
    const python = process.platform === 'win32' ? 'python' : 'python3';
    return { cmd: python, args: [serverScript, '--index', indexHtml] };
  }
}

function startPythonServer() {
  const { cmd, args } = getPythonAndScript();
  pythonProcess = spawn(cmd, [...args, '--no-browser'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  pythonProcess.stdout.on('data', d => console.log('[server]', d.toString().trim()));
  pythonProcess.stderr.on('data', d => console.error('[server]', d.toString().trim()));
  pythonProcess.on('exit', code => console.log(`[server] exited ${code}`));
}

function stopPythonServer() {
  if (pythonProcess) { pythonProcess.kill(); pythonProcess = null; }
}

function waitForServer(retries = 20, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http.get(SERVER_URL, () => resolve()).on('error', () => {
        if (++attempts >= retries) reject(new Error('Server did not start in time'));
        else setTimeout(check, delay);
      });
    };
    check();
  });
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'discogs-cleaner',
    backgroundColor: '#0e0e0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    showChangelogIfUpdated();
  });
  mainWindow.on('close', e => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.loadURL(SERVER_URL);
}

// ─── Changelog on update ──────────────────────────────────────────────────────

function showChangelogIfUpdated() {
  const state = loadState();
  const current = app.getVersion();
  if (state.lastSeenVersion && state.lastSeenVersion !== current) {
    const changelog = getChangelogForVersion(current);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: `Updated to v${current}`,
      message: `discogs-cleaner updated to v${current}`,
      detail: changelog,
      buttons: ['OK', 'View full changelog'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 1) {
        shell.openExternal('https://github.com/nmyriad/discogs-cleaner-desktop/blob/main/CHANGELOG.md');
      }
    });
  }
  saveState({ ...state, lastSeenVersion: current });
}

function getChangelogForVersion(version) {
  const changelogs = {
    '1.4.0': 'First fully working native build.\n• App launches from system tray\n• Server starts automatically\n• Rowroad artwork icon',
    '1.5.0': 'Major update:\n• Lifetime & session stats tracker\n• Cached API keys (auto-filled on launch)\n• Undo last rename batch\n• Title case capitalization\n• Auto-backoff on rate limiting\n• Stamp file written to renamed folders\n• Parser fixes for bracket-dash formats',
  };
  return changelogs[version] || `See CHANGELOG.md for what\'s new in v${version}.`;
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip(`discogs-cleaner v${app.getVersion()}`);

  const buildMenu = () => Menu.buildFromTemplate([
    { label: `discogs-cleaner v${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: 'Open', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: 'Check for updates', click: () => checkForUpdates(true) },
    { label: 'View changelog', click: () => shell.openExternal('https://github.com/nmyriad/discogs-cleaner-desktop/blob/main/CHANGELOG.md') },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(buildMenu());
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ─── Auto updater ─────────────────────────────────────────────────────────────

function setupUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for updates...');
  });

  autoUpdater.on('update-available', info => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update available',
      message: `v${info.version} is available`,
      detail: `You're on v${app.getVersion()}.\n\n${getChangelogForVersion(info.version)}\n\nDownload and install now?`,
      buttons: ['Download', 'Later'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
        showToast('Downloading update in the background...');
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] Up to date.');
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update ready',
      message: 'Update downloaded',
      detail: 'Restart discogs-cleaner to apply the update.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) { app.isQuitting = true; autoUpdater.quitAndInstall(); }
    });
  });

  autoUpdater.on('error', err => {
    console.error('[updater] Error:', err.message);
  });
}

function showToast(msg) {
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(
      `showToast(${JSON.stringify(msg)})`
    ).catch(() => {});
  }
}

function checkForUpdates(manual = false) {
  autoUpdater.checkForUpdates().catch(err => {
    console.error('[updater] Check failed:', err.message);
    if (manual) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Up to date',
        message: `You're on the latest version (v${app.getVersion()}).`,
        buttons: ['OK']
      });
    }
  });
}

// ─── IPC ──────────────────────────────────────────────────────────────────────

ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  startPythonServer();
  try {
    await waitForServer();
  } catch (e) {
    dialog.showErrorBox('Server failed to start', 'Could not start the discogs-cleaner server.\n\n' + e.message);
    app.quit();
    return;
  }

  createWindow();
  createTray();
  setupUpdater();

  // Check for updates 8 seconds after launch
  setTimeout(() => checkForUpdates(false), 8000);
});

app.on('window-all-closed', e => e.preventDefault());
app.on('before-quit', () => { app.isQuitting = true; stopPythonServer(); });
app.on('activate', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
