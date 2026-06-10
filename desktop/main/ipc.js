'use strict';

const { ipcMain, BrowserWindow } = require('electron');
const api = require('./api');
const store = require('./store');
const tracker = require('./trackerService');

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

function register() {
  // ---- Auth ----
  ipcMain.handle('auth:login', async (_evt, payload) => {
    return api.login(payload);
  });
  ipcMain.handle('auth:logout', async () => {
    await api.logout();
    return { ok: true };
  });
  ipcMain.handle('auth:me', async () => {
    const user = store.get('user');
    if (!user) return null;
    try {
      return await api.me();
    } catch {
      return user; // fall back to cached if offline
    }
  });
  ipcMain.handle('auth:state', () => ({
    user: store.get('user'),
    apiBaseUrl: store.get('apiBaseUrl'),
    deviceName: store.get('deviceName'),
    hasToken: !!store.get('token'),
  }));

  // ---- Settings (server-driven + local override) ----
  ipcMain.handle('settings:apiBaseUrl:set', (_evt, url) => {
    store.set('apiBaseUrl', String(url || '').replace(/\/+$/, ''));
    return { ok: true };
  });

  // ---- Meta ----
  ipcMain.handle('meta:clients', async () => api.getClients());
  ipcMain.handle('meta:workTypes', async () => api.getWorkTypes());
  ipcMain.handle('meta:upworkProfiles', async () => api.getUpworkProfiles());
  ipcMain.handle('meta:settings', async () => api.getSettings());
  ipcMain.handle('meta:todaySessions', async () => api.todaySessions());
  ipcMain.handle('meta:weekSummary', async () => api.weekSummary());

  // ---- Tracker ----
  ipcMain.handle('tracker:start', async (_evt, opts) => {
    await tracker.start(opts || {});
    return tracker.status();
  });
  ipcMain.handle('tracker:stop', async (_evt, opts) => {
    await tracker.stop(opts || {});
    return tracker.status();
  });
  ipcMain.handle('tracker:status', () => tracker.status());

  tracker.on('changed', (status) => broadcast('tracker:changed', status));
  tracker.on('stopped', (session) => broadcast('tracker:stopped', session));
  tracker.on('warning', (msg) => broadcast('tracker:warning', msg));

  // Pull the latest server-driven settings at boot, then keep the settings
  // panel in sync while the app is idle (the tracker refreshes on its own
  // cadence while a session is running). This makes admin Settings changes
  // visible without restarting the desktop app.
  const syncSettings = () => {
    if (!store.get('token')) return;
    tracker.refreshSettings()
      .then(() => broadcast('tracker:changed', tracker.status()))
      .catch(() => {});
  };

  syncSettings();
  setInterval(() => {
    if (!tracker.status().running) syncSettings();
  }, 120_000);
}

module.exports = { register };
