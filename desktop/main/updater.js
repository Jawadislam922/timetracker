'use strict';

const { app, dialog } = require('electron');

// Auto-update via electron-updater against the generic feed on the web app
// (https://timetracker.sparkingasia.com/desktop-updates — configured in
// package.json build.publish, baked into app-update.yml at package time).
// Windows installs updates in place; unsigned macOS builds cannot auto-update
// (Squirrel.Mac requires code signing), so this no-ops there.

let autoUpdater = null;
let downloadedVersion = null;
let checking = false;

function available() {
  if (!app.isPackaged) return false;
  if (process.platform === 'darwin') return false; // unsigned build — manual updates
  try {
    ({ autoUpdater } = require('electron-updater'));
    return true;
  } catch {
    return false;
  }
}

function init() {
  if (!available()) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info) => {
    downloadedVersion = info?.version || null;
    dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: `Timetracker Desktop ${downloadedVersion || ''} has been downloaded.`,
      detail: 'Restart now to apply it, or it installs automatically next time you quit.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    }).catch(() => {});
  });

  const check = () => {
    if (checking) return;
    checking = true;
    autoUpdater.checkForUpdates().catch(() => {}).finally(() => { checking = false; });
  };

  // First check shortly after launch (don't compete with startup I/O), then
  // every 4 hours while the app stays open.
  setTimeout(check, 15_000);
  setInterval(check, 4 * 3600 * 1000);
}

/**
 * Manual "Check for updates": resolves with a small status object the
 * renderer can show as a toast.
 */
async function checkNow() {
  if (!app.isPackaged) return { status: 'dev', message: 'Updates are disabled in development.' };
  if (process.platform === 'darwin') {
    return { status: 'manual', message: 'Mac updates are manual — download the new build from the website.' };
  }
  if (!available()) return { status: 'unavailable', message: 'Updater not available in this build.' };
  if (downloadedVersion) {
    return { status: 'ready', message: `Version ${downloadedVersion} is downloaded — restart to apply.` };
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    const next = result?.updateInfo?.version;
    if (next && next !== app.getVersion()) {
      return { status: 'downloading', message: `Version ${next} found — downloading in the background.` };
    }
    return { status: 'latest', message: `You are on the latest version (v${app.getVersion()}).` };
  } catch (err) {
    return { status: 'error', message: 'Could not reach the update server.' };
  }
}

module.exports = { init, checkNow };
