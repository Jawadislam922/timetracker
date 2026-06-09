'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { paths } = require('./config');

let screenshot = null;
try {
  screenshot = require('screenshot-desktop');
} catch (err) {
  console.warn('screenshot-desktop not loaded:', err.message);
}

/**
 * Capture the primary display and write it to a temp file on disk.
 * Returns { localPath, size } on success.
 */
async function capturePrimary({ sessionId }) {
  if (!screenshot) {
    throw new Error('screenshot-desktop not available');
  }

  fs.mkdirSync(paths.screenshotsDir, { recursive: true });

  // screenshot-desktop returns a Buffer (jpg) by default.
  const buffer = await screenshot({ format: 'jpg' });
  const filename = `${sessionId}-${Date.now()}.jpg`;
  const filePath = path.join(paths.screenshotsDir, filename);
  await fs.promises.writeFile(filePath, buffer);

  return {
    localPath: filePath,
    size: buffer.length,
  };
}

module.exports = { capturePrimary };
