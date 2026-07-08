'use strict';

const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const { v4: uuidv4 } = require('uuid');
const os = require('node:os');
let Notification = null;
try { Notification = require('electron').Notification; } catch { /* tests / non-electron contexts */ }

const api = require('./api');
const queue = require('./queue');
const store = require('./store');
const screenshotService = require('./screenshotService');
const activityService = require('./activityService');
const diag = require('./diag');
const report = require('./report');
const { DEFAULTS } = require('./config');

const HEARTBEAT_INTERVAL_MS = 30_000;
const SYNC_INTERVAL_MS = 15_000;
const SETTINGS_REFRESH_MS = 120_000;
// How many oldest screenshots to attempt per drain pass.
const SCREENSHOT_BATCH = 10;
// An item the server permanently refuses (403/404/422) is retried this many
// times, then discarded so it can never jam the queue (owner's call: retry a
// while, then discard). With per-employee queues this should be near-zero.
const MAX_ATTEMPTS = 25;

class Tracker extends EventEmitter {
  constructor() {
    super();
    this.session = null; // { id, client_uuid, started_at_ms, total_seconds, ... }
    this.settings = { ...DEFAULTS.defaultSettings };
    this.timers = {
      heartbeat: null,
      activitySample: null,
      activeTick: null,
      screenshot: null,
      sync: null,
      idleWatch: null,
      settingsRefresh: null,
    };
    this._activityIntervalSec = this.settings.activity_sample_interval_seconds;
    this._idleWarned = false;
    // Re-entrancy guard for start(): set synchronously before its awaits so two
    // near-simultaneous start() calls can't both create a session + timer set.
    this._starting = false;
    // Wall-clock anchor for the active-time accumulator (see _tickActive).
    this._lastTickMs = 0;
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
      paused: !!this.session?.paused_at_ms,
      session: this.session ? {
        id: this.session.id,
        client_uuid: this.session.client_uuid,
        started_at: new Date(this.session.started_at_ms).toISOString(),
        total_seconds: this._currentSeconds(),
        // The renderer uses these to tick smoothly without polling the main
        // process every second.
        frozen_seconds: Math.floor(this.session.frozen_seconds),
        // Why the session is paused: 'idle' (auto, resumes on activity),
        // 'break' or 'manual' (stay paused until the user presses Resume).
        pause_reason: this.session.pause_reason ?? null,
        last_change_at: new Date(this.session.last_change_at_ms).toISOString(),
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
    // frozen_seconds is the accumulated ACTIVE time: _tickActive adds the REAL
    // elapsed since the previous tick (capped per tick) only while the user is
    // active, so idle/sleep is never included and the total can never exceed
    // real wall-clock. The whole truth whether the session is running or paused.
    return Math.max(0, Math.floor(this.session.frozen_seconds));
  }

  /**
   * Freeze the timer and stop screenshots without ending the session.
   *
   * @param {string|null} reason  Human warning shown in the renderer banner.
   * @param {object} opts
   * @param {'idle'|'break'|'manual'} [opts.pauseReason='manual']  Why we paused.
   *   'idle' auto-resumes when activity returns; 'break'/'manual' wait for a
   *   manual Resume.
   * @param {number} [opts.deductIdleSeconds=0]  Idle seconds to clip OFF the
   *   banked time so an idle stretch is never counted as worked time. Used by
   *   idle auto-pause; a break freezes at the moment pressed (no deduction).
   */
  _pauseSession(reason = null, opts = {}) {
    if (!this.session || this.session.paused_at_ms) return;
    // Idle is already excluded continuously by _tickActive, so pausing just
    // freezes the active counter (the tick stops while paused_at_ms is set) and
    // stops screenshots — there is no banked idle time to deduct.
    this.session.paused_at_ms = Date.now();
    this.session.last_change_at_ms = this.session.paused_at_ms;
    this.session.pause_reason = opts.pauseReason || 'manual';
    // Stop screenshots while paused. Heartbeats and the sync drain KEEP running
    // on purpose: continued heartbeats refresh last_heartbeat_at so the server's
    // stale-session sweep (10-min) won't close the session during a long break.
    if (this.timers.screenshot) {
      clearTimeout(this.timers.screenshot);
      this.timers.screenshot = null;
    }
    report.info('pause', 'timer frozen (' + this.session.pause_reason + ')',
      { pause_reason: this.session.pause_reason, total_seconds: this._currentSeconds() });
    if (reason) this.emit('warning', reason);
    this.emit('changed', this.status());
  }

  _resumeSession(reason = null) {
    if (!this.session || !this.session.paused_at_ms) return;
    const wasReason = this.session.pause_reason;
    this.session.paused_at_ms = null;
    this.session.last_change_at_ms = Date.now();
    this._lastTickMs = Date.now();
    this.session.pause_reason = null;
    this._scheduleNextScreenshot();
    report.info('resume', 'timer running again (was ' + wasReason + ')', { was_reason: wasReason });
    if (reason) this.emit('warning', reason);
    this.emit('changed', this.status());
  }

  /**
   * Once a second, count the second as worked while the session is running and
   * not paused. Short idle (reading, calls, reviewing) is NOT trimmed here —
   * the ONLY thing that stops the clock is the auto-pause below, which fires
   * once idle passes the configured threshold. So quiet stretches under that
   * threshold count as worked time and simply show as a lower activity %,
   * instead of silently vanishing from the total. A lightweight 'tick' event
   * keeps the renderer's live clock in step without rebuilding the full status.
   */
  _tickActive() {
    const now = Date.now();
    if (!this.session || this.session.paused_at_ms) {
      // Keep the clock current while paused so the paused gap is never counted
      // as worked time once we resume.
      this._lastTickMs = now;
      return;
    }

    // Accumulate the REAL elapsed since the last tick (normally ~1s) rather than
    // a fixed +1, so a late/hitched tick stays accurate. CAP a single tick so a
    // sleep/hang gap — or a stray duplicate timer sharing this clock — can never
    // inflate the total: a duplicate fire just measures ~0s since the last one.
    const MAX_TICK_SECONDS = 5;
    let delta = (now - (this._lastTickMs || now)) / 1000;
    this._lastTickMs = now;
    if (delta < 0) delta = 0;
    if (delta > MAX_TICK_SECONDS) delta = MAX_TICK_SECONDS;

    this.session.frozen_seconds += delta;
    this.session.total_seconds = Math.floor(this.session.frozen_seconds);
    this.emit('tick', Math.floor(this.session.frozen_seconds));

    // Auto-pause is the sole time-cutter: when the user has been idle past the
    // configured threshold, freeze the timer and stop screenshots until they're
    // back. Checked every second so "3 min" really pauses at ~3 min (the old
    // sample-interval check could lag up to a minute). Auto-resumes on activity
    // via _sampleActivity. autoPauseMin = 0 disables it (clock runs to stop).
    const autoPauseMin = Number(this.settings.auto_pause_minutes || 0);
    if (autoPauseMin > 0 && activityService.getSystemIdleSeconds() >= autoPauseMin * 60) {
      this._pauseSession(
        `Auto-paused after ${autoPauseMin} min of inactivity. Tracking resumes when you're back.`,
        { pauseReason: 'idle' },
      );
    }
  }

  /**
   * Pause for a break (manual or detected from the web dashboard). Idempotent —
   * a no-op if already paused, so racing the heartbeat reconcile is safe.
   */
  pauseForBreak() {
    if (!this.session || this.session.paused_at_ms) return this.status();
    this._pauseSession('On break — tracking paused.', { pauseReason: 'break' });
    return this.status();
  }

  /** Manually resume a paused session (the Resume button / break end). */
  resume() {
    if (!this.session || !this.session.paused_at_ms) return this.status();
    this._resumeSession('Resumed.');
    return this.status();
  }

  async start(opts) {
    // `this.session` isn't set until AFTER the awaits below, so a plain
    // `if (this.session)` check lets two near-simultaneous start() calls both
    // pass and each create a session + timer set (the second orphans the
    // first's timers → doubled time). The synchronous `_starting` flag closes
    // that window until the session exists.
    if (this.session || this._starting) throw new Error('A session is already running');
    this._starting = true;

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
      this._starting = false;
      throw new Error('Could not start session: ' + (err.response?.data?.message || err.message));
    }

    this.session = {
      id: serverSession.id,
      client_uuid,
      started_at_ms: started_at.getTime(),
      // Active time accounting. `frozen_seconds` is the active time captured
      // before the most recent state change (pause/resume). `last_change_at_ms`
      // is the wall-clock moment when the session last started or resumed.
      // While running, current active time = frozen + (now - last_change_at).
      // While paused, current active time = frozen (no delta).
      frozen_seconds: 0,
      last_change_at_ms: started_at.getTime(),
      paused_at_ms: null,
      pause_reason: null,
      activity_percent: 0,
      task_note: opts.task_note ?? null,
      client_id: opts.client_id ?? null,
      upwork_profile_id: opts.upwork_profile_id ?? null,
      work_type: opts.work_type ?? null,
    };

    // Session now exists — the normal `if (this.session)` guard protects from
    // here, so release the start lock. Anchor the active-time clock to now.
    this._starting = false;
    this._lastTickMs = Date.now();

    activityService.start();
    this._startTimers();

    // DIAGNOSTIC (0.3.6): take one capture right away and log the effective
    // settings, so capture.log shows the result within seconds instead of after
    // the 5-10 min interval. Best-effort; never blocks session start.
    diag.log('session started id=' + this.session.id,
      '| settings capture_enabled=' + this.settings.capture_enabled,
      'screenshots_per_hour=' + this.settings.screenshots_per_hour,
      'min/max=' + this.settings.screenshot_interval_min_seconds + '/' + this.settings.screenshot_interval_max_seconds);
    report.info('session_start', 'session ' + this.session.id + ' started',
      { capture_enabled: this.settings.capture_enabled, screenshots_per_hour: this.settings.screenshots_per_hour });
    this._captureScreenshot().catch((err) => {
      const msg = err && err.message ? err.message : String(err);
      diag.log('initial capture: ERROR', msg);
      report.warn('screenshot_capture_failed', msg, { where: 'initial' });
    });

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

    report.info('session_stop', 'session ' + this.session.id + ' stopped',
      { total_seconds: stopPayload.total_seconds });
    report.flush().catch(() => {}); // best-effort: get this session's telemetry up before we lose focus

    const stopped = { ...this.session, stopped_at: stopPayload.stopped_at };
    this.session = null;
    this.emit('stopped', stopped);
    this.emit('changed', this.status());
  }

  _startTimers() {
    // Idempotent: clear any existing timers first, so a set can never be left
    // running (belt-and-suspenders alongside the start() re-entrancy guard).
    this._stopTimers();
    this._scheduleNextScreenshot();

    this.timers.activitySample = setInterval(() => this._sampleActivity().catch(() => {}), this._activityIntervalSec * 1000);
    // Active-time accounting runs every second so idle never sneaks into the
    // total (it counts only when the user is active — see _tickActive).
    this.timers.activeTick = setInterval(() => this._tickActive(), 1000);
    this.timers.heartbeat = setInterval(() => this._sendHeartbeat().catch(() => {}), HEARTBEAT_INTERVAL_MS);
    this.timers.sync = setInterval(() => this._drainQueue().catch(() => {}), SYNC_INTERVAL_MS);
    this.timers.idleWatch = setInterval(() => this._checkIdleWarning(), 15_000);
    this.timers.settingsRefresh = setInterval(() => this._refreshAndApplySettings().catch(() => {}), SETTINGS_REFRESH_MS);
    this._idleWarned = false;
  }

  /**
   * Re-fetch the per-user effective settings while a session is running and
   * apply any changes live, so an admin editing the web Settings page takes
   * effect without the employee restarting the tracker.
   */
  async _refreshAndApplySettings() {
    if (!this.session) return;

    const prev = this.settings;
    await this.refreshSettings();
    const next = this.settings;

    // Restart activity sampling if the cadence changed.
    const prevInterval = prev.activity_sample_interval_seconds || 60;
    const nextInterval = next.activity_sample_interval_seconds || 60;
    if (nextInterval !== prevInterval && this.timers.activitySample) {
      clearInterval(this.timers.activitySample);
      this.timers.activitySample = setInterval(() => this._sampleActivity().catch(() => {}), nextInterval * 1000);
    }

    // Reschedule the screenshot loop if cadence or the capture toggle changed.
    const screenshotChanged =
      prev.capture_enabled !== next.capture_enabled ||
      prev.screenshots_per_hour !== next.screenshots_per_hour ||
      prev.screenshot_interval_min_seconds !== next.screenshot_interval_min_seconds ||
      prev.screenshot_interval_max_seconds !== next.screenshot_interval_max_seconds;
    if (screenshotChanged) {
      if (this.timers.screenshot) {
        clearTimeout(this.timers.screenshot);
        this.timers.screenshot = null;
      }
      this._scheduleNextScreenshot();
    }

    // Surface the new settings to the renderer settings panel.
    this.emit('changed', this.status());
  }

  _checkIdleWarning() {
    if (!this.session) return;
    // Already paused (break/idle/manual) — no point warning about an upcoming
    // auto-pause.
    if (this.session.paused_at_ms) return;
    const autoPauseSec = Number(this.settings.auto_pause_minutes || 0) * 60;
    if (autoPauseSec <= 0) return;

    const idle = activityService.getSystemIdleSeconds();

    // User is active again: reset, and clear the on-screen warning if we
    // showed one (empty string tells the renderer to hide the banner).
    if (idle < 30) {
      if (this._idleWarned) {
        this._idleWarned = false;
        this.emit('warning', '');
      }
      return;
    }

    // Warn one minute before auto-pause (but never sooner than 30s of idle).
    const warnAt = Math.max(30, autoPauseSec - 60);
    if (idle >= warnAt && !this._idleWarned) {
      this._idleWarned = true;
      const remaining = Math.max(1, Math.round((autoPauseSec - idle) / 60));
      const message = `You have been idle. Tracking will pause in about ${remaining} min unless you resume working.`;
      this.emit('warning', message);
      const idlePref = (store.get('prefs') || {}).idleNotifications;
      if (Notification && idlePref !== false) {
        try {
          new Notification({ title: 'Timetracker', body: message }).show();
        } catch { /* best effort */ }
      }
    }
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

    // capture_enabled=false or screenshots_per_hour=0 disables screenshots entirely.
    if (this.settings.capture_enabled === false || this.settings.screenshots_per_hour === 0) {
      this.timers.screenshot = null;
      diag.log('schedule: SKIPPED by settings — capture_enabled=' + this.settings.capture_enabled,
        'screenshots_per_hour=' + this.settings.screenshots_per_hour);
      return;
    }

    const minS = this.settings.screenshot_interval_min_seconds || 300;
    const maxS = Math.max(minS, this.settings.screenshot_interval_max_seconds || minS);
    const jitter = Math.floor(Math.random() * (maxS - minS + 1));
    const delayMs = (minS + jitter) * 1000;
    diag.log('schedule: next screenshot in ' + Math.round(delayMs / 1000) + 's');

    this.timers.screenshot = setTimeout(async () => {
      try {
        await this._captureScreenshot();
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        diag.log('capture timer: ERROR', msg);
        report.warn('screenshot_capture_failed', msg, { where: 'scheduled' });
      }
      this._scheduleNextScreenshot();
    }, delayMs);
  }

  _maybeNotifyScreenshot() {
    // Local preference wins when set; otherwise follow the admin setting.
    const localPref = (store.get('prefs') || {}).notifyScreenshot;
    const shouldNotify = localPref === null || localPref === undefined
      ? this.settings.notify_on_screenshot
      : localPref;
    if (!shouldNotify || !Notification) return;
    try {
      new Notification({
        title: 'Timetracker',
        body: 'Screenshot taken',
        silent: true,
      }).show();
    } catch {
      // notifications are best-effort
    }
  }

  async _sampleActivity() {
    if (!this.session) return;
    if (this.settings.activity_tracking_enabled === false) return;

    const snap = activityService.snapshotAndReset();
    const hasInput = (snap.keyboard_count + snap.mouse_count) > 0;
    const looksActiveNow = hasInput || activityService.getSystemIdleSeconds() < 5;

    // Auto-resume ONLY idle-pauses when the user comes back. A break or manual
    // pause must wait for an explicit Resume (owner decision), so it survives
    // activity. Either way, while paused we record nothing further this tick —
    // this also prevents an idle auto-pause from re-firing on top of a break.
    if (this.session.paused_at_ms) {
      if (this.session.pause_reason === 'idle' && looksActiveNow) {
        this._resumeSession('Resumed — activity detected.');
      } else {
        // Stay paused; no point recording an empty sample for an empty room.
        return;
      }
    }

    const appUrlOn = this.settings.app_url_tracking_enabled !== false;
    const winInfo = appUrlOn
      ? await activityService.activeWindowInfo()
      : { active_app: null, active_window_title: null, url_domain: null };
    const capturedAt = new Date().toISOString();

    queue.enqueueActivitySample({
      tracking_session_id: this.session.id,
      captured_at: capturedAt,
      keyboard_count: snap.keyboard_count,
      mouse_count: snap.mouse_count,
      mouse_clicks: snap.mouse_clicks,
      idle_seconds: snap.idle_seconds,
      active_app: winInfo.active_app,
      active_window_title: winInfo.active_window_title,
      url_domain: winInfo.url_domain,
    });

    // Roll activity percent (simple running indicator).
    const pct = activityService.computeActivityPercent(snap);
    this.session.activity_percent = Math.round((this.session.activity_percent * 0.7) + (pct * 0.3));

    // Auto-pause now lives in _tickActive (checked every second). The sampler
    // only records activity and auto-resumes an idle-pause on input (above).

    this.emit('changed', this.status());
  }

  async _captureScreenshot() {
    if (!this.session) { diag.log('capture: skip — no session'); return; }
    if (this.session.paused_at_ms) { diag.log('capture: skip — session paused'); return; }
    if (this.settings.capture_enabled === false || this.settings.screenshots_per_hour === 0) {
      diag.log('capture: skip — settings capture_enabled=' + this.settings.capture_enabled,
        'screenshots_per_hour=' + this.settings.screenshots_per_hour);
      return;
    }

    const capturedAt = new Date().toISOString();
    const { localPath } = await screenshotService.capture({ sessionId: this.session.id });
    diag.log('capture: enqueued screenshot ->', localPath);
    const appUrlOn = this.settings.app_url_tracking_enabled !== false;
    const winInfo = appUrlOn
      ? await activityService.activeWindowInfo()
      : { active_app: null, active_window_title: null, url_domain: null };
    const snap = activityService.snapshotAndReset();

    queue.enqueueScreenshot({
      tracking_session_id: this.session.id,
      captured_at: capturedAt,
      image_path: localPath,
      activity_percent: this.session.activity_percent,
      keyboard_count: snap.keyboard_count,
      mouse_count: snap.mouse_count,
      mouse_clicks: snap.mouse_clicks,
      active_app: winInfo.active_app,
      active_window_title: winInfo.active_window_title,
      url_domain: winInfo.url_domain,
    });
    this._maybeNotifyScreenshot();
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

    // Weekly time limit: server is authoritative, but stop locally if the
    // current session would obviously cross the configured weekly cap so the
    // user gets immediate feedback instead of an offline-queue overshoot.
    const weeklyHours = Number(this.settings.weekly_time_limit_hours || 0);
    if (weeklyHours > 0 && totalSeconds >= weeklyHours * 3600) {
      this.emit('warning', `Weekly time limit reached (${weeklyHours}h). Tracking stopped.`);
      await this.stop({ task_note: this.session?.task_note }).catch(() => {});
      return;
    }

    this.emit('changed', this.status());
  }

  /** Public, concurrency-guarded entry point used by the background drainer. */
  async drainOnce() {
    return this._drainQueue();
  }

  /**
   * Push queued heartbeats, activity samples and screenshots to the server.
   *
   * Resilient by design (0.3.7): a single un-uploadable item NEVER blocks the
   * rest. Errors are classified — offline / auth / server problems stop the
   * pass (retry later); an item-specific 4xx (403 not-yours, 404 gone, 422
   * invalid) is retried a while then discarded so it can't jam the queue.
   * Runs against the CURRENT employee's own queue only.
   */
  async _drainQueue() {
    if (this._draining) return;
    this._draining = true;
    try {
      // Heartbeats first (cheap & most useful).
      for (const h of queue.nextHeartbeats()) {
        try {
          const resp = await api.heartbeat(h.tracking_session_id, {
            total_seconds: h.total_seconds,
            activity_percent: h.activity_percent,
            heartbeat_at: h.heartbeat_at,
          });
          queue.deleteHeartbeat(h.id);
          // A break started on the web dashboard pauses the tracker too. We
          // only act on the pause edge; break end is a MANUAL resume, so an
          // on_break=false response never auto-resumes.
          if (resp && resp.on_break && this.session
            && this.session.id === h.tracking_session_id
            && this.session.pause_reason !== 'break') {
            report.info('break_detected', 'server reported on_break — pausing tracker',
              { was_paused: !!this.session.paused_at_ms, prev_reason: this.session.pause_reason });
            this.pauseForBreak();
          }
        } catch (err) {
          // The server closed this session (auto clock-out at shift end, clocked
          // out on the web, or single-device takeover): stop the local tracker
          // so it can't keep capturing time the server now rejects.
          if (err.response?.status === 409 && this.session && this.session.id === h.tracking_session_id) {
            queue.deleteHeartbeat(h.id);
            this.emit('warning', err.response?.data?.message || 'Tracking stopped: your session was closed.');
            await this.stop({ task_note: this.session?.task_note }).catch(() => {});
            return;
          }
          if (!this._handleDrainError('heartbeat', err, h,
            () => queue.markHeartbeatError(h.id, err.message),
            () => queue.deleteHeartbeat(h.id))) {
            return; // global error — stop this pass
          }
        }
      }

      // Activity samples in batches, grouped by session for the batch endpoint.
      const samples = queue.nextActivityBatch(100);
      if (samples.length) {
        const bySession = new Map();
        for (const s of samples) {
          if (!bySession.has(s.tracking_session_id)) bySession.set(s.tracking_session_id, []);
          bySession.get(s.tracking_session_id).push(s);
        }
        for (const [sessionId, rows] of bySession.entries()) {
          const ids = rows.map((r) => r.id);
          try {
            await api.sendActivityBatch({
              tracking_session_id: sessionId,
              samples: rows.map((r) => ({
                captured_at: r.captured_at,
                keyboard_count: r.keyboard_count,
                mouse_count: r.mouse_count,
                mouse_clicks: r.mouse_clicks,
                idle_seconds: r.idle_seconds,
                active_app: r.active_app,
                active_window_title: r.active_window_title,
                url_domain: r.url_domain,
              })),
            });
            queue.deleteActivitySamples(ids);
          } catch (err) {
            const maxAttempts = Math.max(...rows.map((r) => r.attempts || 0));
            if (!this._handleDrainError('activity', err, { attempts: maxAttempts },
              () => queue.markActivityError(ids, err.message),
              () => queue.deleteActivitySamples(ids))) {
              return;
            }
          }
        }
      }

      // Screenshots — attempt the oldest batch, skipping/continuing on failure.
      for (const s of queue.nextScreenshots(SCREENSHOT_BATCH)) {
        try {
          await api.uploadScreenshot(s.image_path, {
            tracking_session_id: s.tracking_session_id,
            captured_at: s.captured_at,
            activity_percent: s.activity_percent,
            keyboard_count: s.keyboard_count,
            mouse_count: s.mouse_count,
            mouse_clicks: s.mouse_clicks,
            active_app: s.active_app,
            active_window_title: s.active_window_title,
            url_domain: s.url_domain,
          });
          queue.deleteScreenshot(s.id);
          try { fs.unlinkSync(s.image_path); } catch { /* ignore */ }
        } catch (err) {
          if (!this._handleDrainError('screenshot', err, s,
            () => queue.markScreenshotError(s.id, err.message),
            () => { queue.deleteScreenshot(s.id); try { fs.unlinkSync(s.image_path); } catch { /* ignore */ } })) {
            return; // global error — stop this pass
          }
        }
      }
    } finally {
      this._draining = false;
      report.flush().catch(() => {}); // piggy-back telemetry upload on the sync loop
      this.emit('changed', this.status());
    }
  }

  /**
   * Decide what an upload error means.
   * @returns {boolean} true → CONTINUE to the next item (item-specific 4xx,
   *   retried-or-discarded); false → STOP the whole pass (offline/auth/server).
   */
  _handleDrainError(kind, err, row, onRetry, onDiscard) {
    const status = err && err.response ? err.response.status : null;

    // No HTTP response = offline/network → stop and retry later; don't blame the item.
    if (!status) { diag.log('drain: ' + kind + ' offline, will retry'); return false; }
    // Auth expired, rate-limited, or server error = global → stop the pass.
    if (status === 401 || status === 429 || status >= 500) {
      diag.log('drain: ' + kind + ' stop status=' + status);
      return false;
    }

    // Item-specific 4xx (403/404/422): this row can never upload. Retry a while,
    // then discard it so it cannot jam everything behind it.
    const attempts = (row && row.attempts) || 0;
    if (attempts + 1 >= MAX_ATTEMPTS) {
      diag.log('drain: DISCARD ' + kind + ' after ' + (attempts + 1) + ' tries status=' + status);
      try { onDiscard(); } catch { /* ignore */ }
    } else {
      diag.log('drain: ' + kind + ' retry status=' + status + ' attempts=' + (attempts + 1));
      try { onRetry(); } catch { /* ignore */ }
    }
    return true; // keep going
  }
}

module.exports = new Tracker();
