'use strict';

const path = require('node:path');
const { app, BrowserWindow, shell, powerMonitor } = require('electron');
const { isDev } = require('./config');
const queue = require('./queue');
const diag = require('./diag');
const ipc = require('./ipc');
const store = require('./store');
const tray = require('./tray');
const updater = require('./updater');
const report = require('./report');
const collector = require('./collector');

const PROTOCOL = 'timetracker';

// Capture crashes so they reach the server diagnostics (viewable on the Developer
// page) instead of vanishing on the employee's PC. We log + report and keep
// running — a stray error must not take down a background tracker.
process.on('uncaughtException', (err) => {
  try { report.error('uncaughtException', err && err.message, { stack: err && err.stack ? String(err.stack).split('\n').slice(0, 8).join('\n') : null }); } catch { /* best-effort */ }
});
process.on('unhandledRejection', (reason) => {
  try { report.error('unhandledRejection', reason && reason.message ? reason.message : String(reason)); } catch { /* best-effort */ }
});

let mainWindow = null;
let pendingDeepLink = null;

// ---- Single instance + protocol registration -------------------------------
// A second launch (including the browser invoking timetracker://...) focuses
// the existing window and forwards the URL instead of opening a duplicate.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  registerProtocol();

  app.on('second-instance', (_event, argv) => {
    const url = extractDeepLink(argv);
    if (url) handleDeepLink(url);
    focusWindow();
  });

  // macOS delivers protocol URLs via open-url instead of argv.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
    focusWindow();
  });

  app.whenReady().then(() => {
    // If a previous sign-in is remembered, open THAT employee's own queue lane
    // right away so their backlog can drain on launch.
    const remembered = store.get('user');
    if (remembered && remembered.id) {
      queue.setUser(remembered.id);
      diag.setUser(remembered.id);
    } else {
      queue.init();
    }
    ipc.register();
    createWindow();
    updater.init();
    report.info('app_ready', 'desktop app started');
    // Push buffered telemetry to the server periodically (best-effort).
    setInterval(() => report.flush().catch(() => {}), 60_000);
    // Endpoint-compliance inventory: once shortly after launch, then hourly.
    setTimeout(() => collector.run().catch(() => {}), 45_000);
    setInterval(() => collector.run().catch(() => {}), 60 * 60_000);

    tray.init(() => mainWindow, !!(store.get('prefs') || {}).minimizeToTray);

    // First launch may itself carry a protocol URL (cold start from browser).
    const url = extractDeepLink(process.argv);
    if (url) handleDeepLink(url);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // Stop tracking cleanly when the app is closed or the PC is shut down while a
  // session is still running, so the server session is finalized (a real stop
  // with the correct total) instead of left dangling until auto-close. We hold
  // the quit just long enough to send the final stop; it's best-effort, so a
  // slow/offline network can never wedge the shutdown.
  let stoppingForQuit = false;
  const stopThenQuit = (event) => {
    const tracker = require('./trackerService');
    if (stoppingForQuit || !tracker.status().running) return;
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    stoppingForQuit = true;
    // Hard 4s guard: if the final stop stalls (slow/blocked network), quit anyway.
    // Without this a hung stop never reaches app.quit(), so the app never exits —
    // which made "Restart now" silently do nothing and leave the update pending.
    const guard = new Promise((resolve) => setTimeout(resolve, 4000));
    Promise.race([Promise.resolve(tracker.stop({}).catch(() => {})), guard]).finally(() => app.quit());
  };
  app.on('before-quit', stopThenQuit);
  try {
    // Delivered on macOS/Linux system shutdown; on Windows a shutdown closes the
    // window, which routes through window-all-closed → quit → before-quit above.
    powerMonitor.on('shutdown', stopThenQuit);
  } catch { /* powerMonitor unavailable in some environments */ }
}

function registerProtocol() {
  try {
    if (isDev && process.platform === 'win32') {
      // In dev the executable is electron.exe, so the protocol must point at
      // it with our app path as argument. Packaged builds register cleanly
      // via the installer; this is best-effort for local testing.
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1] || '.')]);
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
  } catch {
    // Non-fatal: launching from web simply won't work until installed.
  }
}

function extractDeepLink(argv) {
  return (argv || []).find((arg) => typeof arg === 'string' && arg.startsWith(`${PROTOCOL}://`)) || null;
}

function handleDeepLink(url) {
  let payload = { action: 'open' };
  try {
    const parsed = new URL(url);
    payload = {
      action: parsed.hostname || 'open', // timetracker://start -> "start"
      client_id: parsed.searchParams.get('client_id'),
      task_note: parsed.searchParams.get('note'),
    };
  } catch {
    // Malformed URL: still just focus the app.
  }

  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('deeplink', payload);
  } else {
    pendingDeepLink = payload;
  }
}

function focusWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 400,
    minHeight: 560,
    title: 'Timetracker Desktop',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Open external links in the system browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
  }

  // Deliver a deep link that arrived before the renderer was ready.
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingDeepLink) {
      mainWindow.webContents.send('deeplink', pendingDeepLink);
      pendingDeepLink = null;
    }
  });

  // When the user enabled minimize-to-tray, minimizing hides the window;
  // the tray icon brings it back.
  mainWindow.on('minimize', () => {
    const prefs = store.get('prefs') || {};
    if (prefs.minimizeToTray) {
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
