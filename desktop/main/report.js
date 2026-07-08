'use strict';

// Client-side telemetry reporter. Buffers important events (errors, screenshot
// capture failures / antivirus blocks, pause & break transitions, crashes) and
// uploads them to the server so a broken machine is diagnosable remotely instead
// of only in the local capture.log. Everything is best-effort and wrapped —
// reporting can never break tracking.

const os = require('node:os');
const diag = require('./diag');
const api = require('./api');
const store = require('./store');

const MAX_BUFFER = 300;   // hard cap so an offline stretch can't grow unbounded
const FLUSH_BATCH = 50;

let buffer = [];
let appVersion = '?';
try { appVersion = require('../package.json').version; } catch { /* non-electron */ }

function report(level, event, message, context) {
  try {
    diag.log(`[${level}] ${event}` + (message ? ' — ' + message : ''), context ? JSON.stringify(context) : '');
  } catch { /* logging is best-effort */ }

  try {
    buffer.push({
      level,
      event: String(event).slice(0, 80),
      message: message == null ? null : String(message).slice(0, 2000),
      context: context || null,
      at: new Date().toISOString(),
      app_version: appVersion,
      platform: process.platform,
    });
    if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
  } catch { /* never throw into the caller */ }
}

const info = (event, message, context) => report('info', event, message, context);
const warn = (event, message, context) => report('warn', event, message, context);
const error = (event, message, context) => report('error', event, message, context);

async function flush() {
  if (!buffer.length) return;
  if (!store.get('token')) return; // not signed in yet — hold the buffer

  const batch = buffer.slice(0, FLUSH_BATCH);
  try {
    await api.sendDiagnostics(batch, store.get('deviceName') || os.hostname());
    buffer.splice(0, batch.length); // only drop what we successfully sent
  } catch {
    // offline / server busy — keep the buffer (capped) and retry next flush
  }
}

module.exports = { report, info, warn, error, flush };
