'use strict';

const fs = require('node:fs');
const path = require('node:path');
const queue = require('./queue');
const diag = require('./diag');

// PRIMARY capture path (v0.3.5+): Electron's built-in desktopCapturer. It reads
// the screen IN-PROCESS via Chromium — no batch file, no PowerShell, no temp
// helper exe — so antivirus (Defender/Bitdefender behavioural blocking, ASR,
// Controlled Folder Access) has nothing to block. This is what makes capture
// work on locked-down PCs without per-machine exclusions. Lazy-required so the
// module still loads in non-electron/test contexts.
let desktopCapturer = null;
let screen = null;
try {
  const electron = require('electron');
  desktopCapturer = electron.desktopCapturer;
  screen = electron.screen;
} catch (err) {
  console.warn('electron desktopCapturer not available:', err.message);
}

// LEGACY FALLBACK ONLY: screenshot-desktop shells out to a PowerShell/C# helper
// that some antivirus blocks. Kept solely as a last resort if desktopCapturer
// ever fails on a machine, so a capture is never silently lost.
let screenshot = null;
try {
  screenshot = require('screenshot-desktop');
} catch (err) {
  console.warn('screenshot-desktop not loaded:', err.message);
}

let Jimp = null;
try {
  Jimp = require('jimp');
} catch (err) {
  console.warn('jimp not loaded (multi-monitor stitch disabled):', err.message);
}

async function writeOut(buffer, sessionId) {
  // Write into the CURRENT employee's own pending-screenshots folder.
  const dir = queue.currentScreenshotsDir();
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${sessionId}-${Date.now()}.jpg`;
  const filePath = path.join(dir, filename);
  await fs.promises.writeFile(filePath, buffer);
  return { localPath: filePath, size: buffer.length };
}

/**
 * Capture the work screen(s) to a single jpg on disk.
 *
 * Order of attempts:
 *   1. desktopCapturer (in-process, AV-safe) — single screen or stitched multi.
 *   2. screenshot-desktop (legacy; may be blocked by AV) — only if (1) fails.
 *
 * Returns { localPath, size }. Single-monitor machines behave as before; an
 * extended/dual setup is stitched side-by-side so the second screen isn't lost.
 */
async function capture({ sessionId }) {
  diag.log('capture(): start session=' + sessionId,
    'desktopCapturer=' + !!desktopCapturer, 'screen=' + !!screen,
    'screenshot-desktop=' + !!screenshot, 'jimp=' + !!Jimp);

  // 1) Preferred: in-process desktopCapturer.
  if (desktopCapturer && screen) {
    try {
      const buffer = await captureViaDesktopCapturer();
      if (buffer && buffer.length) {
        const out = await writeOut(buffer, sessionId);
        diag.log('capture(): OK via desktopCapturer bytes=' + out.size);
        return out;
      }
      diag.log('capture(): desktopCapturer produced an empty buffer, falling back');
    } catch (err) {
      diag.log('capture(): desktopCapturer FAILED:', err && err.message ? err.message : String(err));
    }
  } else {
    diag.log('capture(): desktopCapturer unavailable (not electron main?)');
  }

  // 2) Legacy fallback (the path some antivirus blocks).
  if (screenshot) {
    try {
      const displays = Jimp ? await safeListDisplays() : [];
      if (Jimp && displays.length > 1) {
        const buffers = await screenshot.all({ format: 'png' });
        if (buffers && buffers.length > 1) {
          try {
            const out = await writeOut(await stitch(buffers), sessionId);
            diag.log('capture(): OK via screenshot-desktop (multi) bytes=' + out.size);
            return out;
          } catch (e) {
            diag.log('capture(): multi-monitor stitch failed, using primary:', e.message);
          }
        }
      }
      const out = await writeOut(await screenshot({ format: 'jpg' }), sessionId);
      diag.log('capture(): OK via screenshot-desktop (single) bytes=' + out.size);
      return out;
    } catch (err) {
      diag.log('capture(): screenshot-desktop FAILED:', err && err.message ? err.message : String(err));
      throw new Error('All capture methods failed: ' + err.message);
    }
  }

  diag.log('capture(): NO capture method available');
  throw new Error('No screenshot capture method available');
}

async function safeListDisplays() {
  try {
    return await screenshot.listDisplays();
  } catch {
    return [];
  }
}

/**
 * Capture every screen with desktopCapturer at full resolution. A single screen
 * is returned as JPEG directly; multiple screens are stitched (when Jimp is
 * available) so the whole workspace is one wide image.
 */
async function captureViaDesktopCapturer() {
  const displays = screen.getAllDisplays();
  // Request thumbnails at real pixel size (logical size × DPI scale) so the
  // capture is full-resolution, not a small preview.
  const px = (d) => ({
    w: Math.max(1, Math.round((d.size?.width || 1280) * (d.scaleFactor || 1))),
    h: Math.max(1, Math.round((d.size?.height || 720) * (d.scaleFactor || 1))),
  });
  const maxW = Math.max(1, ...displays.map((d) => px(d).w));
  const maxH = Math.max(1, ...displays.map((d) => px(d).h));

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: maxW, height: maxH },
  });

  const total = (sources || []).length;
  const screens = (sources || []).filter((s) => s.thumbnail && !s.thumbnail.isEmpty());
  diag.log('desktopCapturer: displays=' + displays.length, 'size=' + maxW + 'x' + maxH,
    'sources=' + total, 'nonEmpty=' + screens.length);
  if (!screens.length) {
    // Sources came back but every thumbnail is empty/black — classic sign of a
    // disabled GPU/hardware acceleration or a security tool blocking screen reads.
    throw new Error('desktopCapturer returned ' + total + ' source(s) but all thumbnails were empty (GPU disabled or screen-capture blocked?)');
  }

  if (screens.length === 1 || !Jimp) {
    return screens[0].thumbnail.toJPEG(70);
  }

  // Multi-monitor: stitch the PNG buffers of each screen side-by-side.
  const buffers = screens.map((s) => s.thumbnail.toPNG());
  return stitch(buffers);
}

/** Compose display buffers left-to-right, vertically centred, thin gap between. */
async function stitch(buffers) {
  const images = await Promise.all(buffers.map((b) => Jimp.read(b)));
  const gap = 8;
  const maxHeight = Math.max(...images.map((i) => i.bitmap.height));
  const totalWidth =
    images.reduce((sum, i) => sum + i.bitmap.width, 0) + gap * (images.length - 1);

  // 0x0b1220ff = slate-950, matches the app's dark monitoring UI.
  const canvas = new Jimp(totalWidth, maxHeight, 0x0b1220ff);
  let x = 0;
  for (const img of images) {
    const y = Math.floor((maxHeight - img.bitmap.height) / 2);
    canvas.composite(img, x, y);
    x += img.bitmap.width + gap;
  }

  return canvas.quality(70).getBufferAsync(Jimp.MIME_JPEG);
}

module.exports = {
  capture,
  // Backwards-compatible alias; older callers used capturePrimary.
  capturePrimary: capture,
};
