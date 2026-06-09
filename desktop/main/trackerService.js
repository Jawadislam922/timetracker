'use strict';

const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const { v4: uuidv4 } = require('uuid');
const os = require('node:os');

const api = require('./api');
const queue = require('./queue');
const screenshotService = require('./screenshotService');
const activityService = require('./activityService');
const { DEFAULTS } = require('./config');

const HEARTBEAT_INTERVAL_MS = 30_000;
const SYNC_INTERVAL_MS = 15_000;

class Tracker extends EventEmitter {
  constructor() {
    super();
    this.session = null; // { id, client_uuid, started_at_ms, total_seconds, ... }
    this.settings = { ...DEFAULTS.defaultSettings };
    this.timers = {
      heartbeat: null,
      activitySample: null,
      screenshot: null,
      sync: null,
    };
    this._activityIntervalSec = this.settings.activity_sample_interval_seconds;
  }

  async refreshSettings() {
    try {
      const remote = await api.getSettings();
      if (remote) this.settings = { ...this.settings, ...remote };
    } catch {
      // keep defaults if offline
    }
    this._activityIntervalSec = this.settings.activity_sample_interval_seconds || 60;
    return this.settings;
  }

  status() {
    return {
      running: !!this.session,
      session: this.session ? {
        id: this.session.id,
        client_uuid: this.session.client_uuid,
        started_at: new Date(this.session.started_at_ms).toISOString(),
        total_seconds: this._currentSeconds(),
        activity_percent: this.session.activity_percent,
        task_note: this.session.task_note,
        client_id: this.session.client_id,
        upwork_profile_id: this.session.upwork_profile_id,
        work_type: this.session.work_type,
      } : null,
      pending: queue.counts(),
      settings: this.settings,
    };
  }

  _currentSeconds() {
    if (!this.session) return 0;
    return Math.max(0, Math.floor((Date.now() - this.session.started_at_ms) / 1000));
  }

  async start(opts) {
    if (this.session) throw new Error('A session is already running');

    await this.refreshSettings();

    const client_uuid = uuidv4();
    const started_at = new Date();

    const payload = {
      client_uuid,
      started_at: started_at.toISOString(),
      client_id: opts.client_id ?? null,
      upwork_profile_id: opts.upwork_profile_id ?? null,
      work_type: opts.work_type ?? null,
      task_note: opts.task_note ?? null,
      device_name: opts.device_name || os.hostname(),
      platform: process.platform,
      app_version: require('../package.json').version,
    };

    let serverSession;
    try {
      serverSession = await api.startSession(payload);
    } catch (err) {
      // If offline at start, we cannot persist a remote session id.
      // The desktop app requires the start handshake to succeed for now;
      // a future enhancement could buffer the start payload locally.
      throw new Error('Could not start session: ' + (err.response?.data?.message || err.message));
    }

    this.session = {
      id: serverSession.id,
      client_uuid,
      started_at_ms: started_at.getTime(),
      total_seconds: 0,
      activity_percent: 0,
      task_note: opts.task_note ?? null,
      client_id: opts.client_id ?? null,
      upwork_profile_id: opts.upwork_profile_id ?? null,
      work_type: opts.work_type ?? null,
    };

    activityService.start();
    this._startTimers();
    this.emit('changed', this.status());
  }

  async stop(opts = {}) {
    if (!this.session) return;
    const taskNote = opts.task_note ?? this.session.task_note;

    this._stopTimers();
    activityService.stop();

    const stopPayload = {
      stopped_at: new Date().toISOString(),
      total_seconds: this._currentSeconds(),
      activity_percent: this.session.activity_percent,
      task_note: taskNote,
    };

    try {
      await api.stopSession(this.session.id, stopPayload);
    } catch (err) {
      // Best effort. Sync loop will retry via the heartbeat path; for now we
      // accept the local state as stopped.
      this.emit('warning', 'Could not notify server of stop: ' + (err.response?.data?.message || err.message));
    }

    const stopped = { ...this.session, stopped_at: stopPayload.stopped_at };
    this.session = null;
    this.emit('stopped', stopped);
    this.emit('changed', this.status());
  }

  _startTimers() {
    this._scheduleNextScreenshot();

    this.timers.activitySample = setInterval(() => this._sampleActivity().catch(() => {}), this._activityIntervalSec * 1000);
    this.timers.heartbeat = setInterval(() => this._sendHeartbeat().catch(() => {}), HEARTBEAT_INTERVAL_MS);
    this.timers.sync = setInterval(() => this._drainQueue().catch(() => {}), SYNC_INTERVAL_MS);
  }

  _stopTimers() {
    for (const key of Object.keys(this.timers)) {
      if (this.timers[key]) {
        clearInterval(this.timers[key]);
        clearTimeout(this.timers[key]);
        this.timers[key] = null;
      }
    }
  }

  _scheduleNextScreenshot() {
    if (!this.session) return;
    const minS = this.settings.screenshot_interval_min_seconds || 300;
    const maxS = Math.max(minS, this.settings.screenshot_interval_max_seconds || minS);
    const jitter = Math.floor(Math.random() * (maxS - minS + 1));
    const delayMs = (minS + jitter) * 1000;

    this.timers.screenshot = setTimeout(async () => {
      try { await this._captureScreenshot(); } catch (err) { console.warn('screenshot failed:', err.message); }
      this._scheduleNextScreenshot();
    }, delayMs);
  }

  async _sampleActivity() {
    if (!this.session) return;
    const snap = activityService.snapshotAndReset();
    const winInfo = await activityService.activeWindowInfo();
    const capturedAt = new Date().toISOString();

    queue.enqueueActivitySample({
      tracking_session_id: this.session.id,
      captured_at: capturedAt,
      keyboard_count: snap.keyboard_count,
      mouse_count: snap.mouse_count,
      idle_seconds: snap.idle_seconds,
      active_app: winInfo.active_app,
      active_window_title: winInfo.active_window_title,
      url_domain: winInfo.url_domain,
    });

    // Roll activity percent (simple running indicator).
    const pct = activityService.computeActivityPercent(snap);
    this.session.activity_percent = Math.round((this.session.activity_percent * 0.7) + (pct * 0.3));
    this.emit('changed', this.status());
  }

  async _captureScreenshot() {
    if (!this.session) return;
    const capturedAt = new Date().toISOString();
    const { localPath } = await screenshotService.capturePrimary({ sessionId: this.session.id });
    const winInfo = await activityService.activeWindowInfo();
    const snap = activityService.snapshotAndReset();

    queue.enqueueScreenshot({
      tracking_session_id: this.session.id,
      captured_at: capturedAt,
      image_path: localPath,
      activity_percent: this.session.activity_percent,
      keyboard_count: snap.keyboard_count,
      mouse_count: snap.mouse_count,
      active_app: winInfo.active_app,
      active_window_title: winInfo.active_window_title,
      url_domain: winInfo.url_domain,
    });
    this.emit('changed', this.status());
  }

  async _sendHeartbeat() {
    if (!this.session) return;
    const totalSeconds = this._currentSeconds();
    this.session.total_seconds = totalSeconds;

    queue.enqueueHeartbeat({
      tracking_session_id: this.session.id,
      total_seconds: totalSeconds,
      activity_percent: this.session.activity_percent,
      heartbeat_at: new Date().toISOString(),
    });

    this.emit('changed', this.status());
  }

  async _drainQueue() {
    // Heartbeats first (cheap & most useful).
    for (const h of queue.nextHeartbeats()) {
      try {
        await api.heartbeat(h.tracking_session_id, {
          total_seconds: h.total_seconds,
          activity_percent: h.activity_percent,
          heartbeat_at: h.heartbeat_at,
        });
        queue.deleteHeartbeat(h.id);
      } catch (err) {
        queue.markHeartbeatError(h.id, err.message);
        return; // bail until next tick
      }
    }

    // Activity samples in batches.
    const samples = queue.nextActivityBatch(100);
    if (samples.length) {
      // All samples must belong to the same session for the batch endpoint.
      const bySession = new Map();
      for (const s of samples) {
        if (!bySession.has(s.tracking_session_id)) bySession.set(s.tracking_session_id, []);
        bySession.get(s.tracking_session_id).push(s);
      }
      for (const [sessionId, rows] of bySession.entries()) {
        try {
          await api.sendActivityBatch({
            tracking_session_id: sessionId,
            samples: rows.map((r) => ({
              captured_at: r.captured_at,
              keyboard_count: r.keyboard_count,
              mouse_count: r.mouse_count,
              idle_seconds: r.idle_seconds,
              active_app: r.active_app,
              active_window_title: r.active_window_title,
              url_domain: r.url_domain,
            })),
          });
          queue.deleteActivitySamples(rows.map((r) => r.id));
        } catch (err) {
          queue.markActivityError(rows.map((r) => r.id), err.message);
          return;
        }
      }
    }

    // Screenshots (one at a time, with file cleanup on success).
    for (const s of queue.nextScreenshots(3)) {
      try {
        await api.uploadScreenshot(s.image_path, {
          tracking_session_id: s.tracking_session_id,
          captured_at: s.captured_at,
          activity_percent: s.activity_percent,
          keyboard_count: s.keyboard_count,
          mouse_count: s.mouse_count,
          active_app: s.active_app,
          active_window_title: s.active_window_title,
          url_domain: s.url_domain,
        });
        queue.deleteScreenshot(s.id);
        try { fs.unlinkSync(s.image_path); } catch { /* ignore */ }
      } catch (err) {
        queue.markScreenshotError(s.id, err.message);
        return;
      }
    }

    this.emit('changed', this.status());
  }
}

module.exports = new Tracker();
