'use strict';

const path = require('node:path');
const { app } = require('electron');

const isDev = !app.isPackaged;

const DEFAULTS = {
  // Where the Laravel app lives. Override via Settings UI (stored in electron-store).
  apiBaseUrl: 'http://timetracker.test',
  // Fallback monitoring config until the server responds with /api/desktop/settings.
  defaultSettings: {
    screenshot_interval_min_seconds: 300,
    screenshot_interval_max_seconds: 600,
    idle_threshold_seconds: 300,
    activity_sample_interval_seconds: 60,
    capture_enabled: true,
    blur_screenshots: false,
  },
};

const paths = {
  userData: app.getPath('userData'),
  queueDb: path.join(app.getPath('userData'), 'queue.sqlite'),
  screenshotsDir: path.join(app.getPath('userData'), 'pending-screenshots'),
};

module.exports = {
  isDev,
  DEFAULTS,
  paths,
};
