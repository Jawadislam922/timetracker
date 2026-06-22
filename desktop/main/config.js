'use strict';

const path = require('node:path');
const { app } = require('electron');

const isDev = !app.isPackaged;

const DEFAULTS = {
  // Where the Laravel app lives. Packaged builds default to production so
  // employees never have to type a server URL; dev keeps the local site.
  // Still overridable from the login screen's Advanced section.
  apiBaseUrl: isDev ? 'http://timetracker.test' : 'https://timetracker.sparkingasia.com',
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
  // Legacy shared locations (pre-0.3.7). Kept only so old data can be cleaned up;
  // the live queue is now per-employee (see userPaths below).
  queueDb: path.join(app.getPath('userData'), 'queue.sqlite'),
  screenshotsDir: path.join(app.getPath('userData'), 'pending-screenshots'),
};

// Per-employee storage (0.3.7+): each signed-in user gets their OWN queue +
// screenshot folder under users/<id>/, so on a shared PC one employee's pending
// items can never be touched (or jammed) by the next employee who logs in.
function userPaths(userId) {
  const safe = String(userId || 'anonymous').replace(/[^A-Za-z0-9_-]/g, '_');
  const base = path.join(app.getPath('userData'), 'users', safe);
  return {
    base,
    queueDb: path.join(base, 'queue.sqlite'),
    screenshotsDir: path.join(base, 'pending-screenshots'),
  };
}

module.exports = {
  isDev,
  DEFAULTS,
  paths,
  userPaths,
};
