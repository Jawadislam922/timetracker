'use strict';

// Diagnostic log for the screenshot pipeline (0.3.6). Writes plain, timestamped
// lines to %AppData%/Roaming/SA Track/capture.log so we can see *why* capture
// isn't happening on a given PC, instead of the error being swallowed. Capped at
// ~1 MB (rotates to .old) and wrapped so logging can never break tracking.

const fs = require('node:fs');
const path = require('node:path');
const { paths } = require('./config');

const LOG_PATH = path.join(paths.userData, 'capture.log');
const MAX_BYTES = 1_000_000;

function log(...parts) {
  try {
    try {
      const st = fs.statSync(LOG_PATH);
      if (st.size > MAX_BYTES) {
        try { fs.renameSync(LOG_PATH, LOG_PATH + '.old'); } catch { fs.truncateSync(LOG_PATH, 0); }
      }
    } catch { /* no file yet */ }
    const msg = parts
      .map((p) => (typeof p === 'string' ? p : JSON.stringify(p)))
      .join(' ');
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    /* never let logging break the tracker */
  }
}

module.exports = { log, LOG_PATH };
