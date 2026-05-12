const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let tray;
let pythonProcess;
const SERVER_PORT = 7842;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

// ─── Python server ────────────────────────────────────────────────────────────

function getPythonAndScript() {
  if (app.isPackaged) {
    // In production: use bundled server.exe from extraResources
    const serverExe = path.join(process.resourcesPath, 'python', 'server.exe');
    return { cmd: serverExe, args: [], useExe: true };
  } else {
    // In dev: use system Python + server.py from repo root
    const serverScript = path.join(__dirname, '..', 'server.py');
    const python = process.platform === 'win32' ? 'python' : 'python3';
    return { cmd: python, args: [serverScript], useExe: false };
  }
}

function startPythonServer() {
  const { cmd, args } = getPythonAndScript();
  console.log(`Starting server: ${cmd} ${args.join(' ')}`);

  pythonProcess = spawn(cmd, [...args, '--no-browser'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  pythonProcess.stdout.on('data', d => console.log('[server]', d.toString().trim()));
  pythonProcess.stderr.on('data', d => console.error('[server]', d.toString().trim()));
  pythonProcess.on('exit', code => console.log(`[server] exited with code ${code}`));
}

function stopPythonServer() {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}

function waitForServer(retries = 20, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http.get(SERVER_URL, res => {
        resolve();
      }).on('error', () => {
        attempts++;
        if (attempts >= retries) {
          reject(new Error('Server did not start in time'));
        } else {
          setTimeout(check, delay);
        }
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

  // Remove default menu bar
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', e => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.loadURL(SERVER_URL);
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('discogs-cleaner');

  const menu = Menu.buildFromTemplate([
    { label: 'Open discogs-cleaner', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Check for updates', click: () => checkForUpdates(true) },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ─── Auto updater ─────────────────────────────────────────────────────────────

function setupUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', info => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update available',
      message: `discogs-cleaner ${info.version} is available`,
      detail: `You're on ${app.getVersion()}. Download and install now?`,
      buttons: ['Download', 'Later'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Downloading update',
          message: 'Downloading in the background...',
          detail: 'The app will prompt you to restart when ready.',
          buttons: ['OK']
        });
      }
    });
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
      if (response === 0) {
        app.isQuitting = true;
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', err => {
    console.error('Updater error:', err.message);
  });
}

function checkForUpdates(manual = false) {
  autoUpdater.checkForUpdates().catch(err => {
    if (manual) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'No updates found',
        message: `You're on the latest version (${app.getVersion()}).`,
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

  // Check for updates 5 seconds after launch
  setTimeout(() => checkForUpdates(false), 5000);
});

app.on('window-all-closed', e => e.preventDefault()); // keep alive in tray

app.on('before-quit', () => {
  app.isQuitting = true;
  stopPythonServer();
});

app.on('activate', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});
