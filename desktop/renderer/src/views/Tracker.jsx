import React, { useEffect, useMemo, useState } from 'react';

function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtShort(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.max(1, Math.floor((s % 3600) / 60));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function sessionTitle(session, clients) {
  if (session?.task_note) return session.task_note;
  if (session?.client_name) return session.client_name;
  const client = clients.find((item) => Number(item.id) === Number(session?.client_id));
  return client?.name || 'Client work';
}

// The per-entry work type (an Upwork billing category reviewed weekly). For a
// "tracker_manual" client the user chooses Tracker or Manual; fixed/outside
// clients have a single fixed category.
function workTypeOptions(client) {
  if (!client) return [];
  switch (client.work_type) {
    case 'tracker_manual':
      return [
        { value: 'tracker', label: 'Tracker' },
        { value: 'manual', label: 'Manual' },
      ];
    case 'fixed':
      return [{ value: 'fixed', label: 'Fixed' }];
    case 'outside_of_upwork':
      return [{ value: 'outside_of_upwork', label: 'Outside Upwork' }];
    default:
      return [
        { value: 'tracker', label: 'Tracker' },
        { value: 'manual', label: 'Manual' },
      ];
  }
}

function defaultWorkType(client) {
  const options = workTypeOptions(client);
  return options[0]?.value || '';
}

export default function Tracker({ user, apiBaseUrl, onLogout }) {
  const [status, setStatus] = useState({ running: false, session: null, pending: { screenshots: 0, activity: 0, heartbeats: 0 } });
  const [clients, setClients] = useState([]);
  const [todaySessions, setTodaySessions] = useState([]);
  const [week, setWeek] = useState([]);
  const [picker, setPicker] = useState({ client_id: '', work_type: '', task_note: '' });
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticker, setTicker] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((client) => String(client.id) === String(picker.client_id)),
    [clients, picker.client_id]
  );

  const workTypeChoices = useMemo(() => workTypeOptions(selectedClient), [selectedClient]);
  const effectiveWorkType = useMemo(() => {
    if (picker.work_type && workTypeChoices.some((option) => option.value === picker.work_type)) {
      return picker.work_type;
    }
    return defaultWorkType(selectedClient);
  }, [picker.work_type, workTypeChoices, selectedClient]);
  const descriptionValid = picker.task_note.trim().length > 0;

  const handleClientChange = (clientId) => {
    const client = clients.find((item) => String(item.id) === String(clientId));
    setPicker((prev) => ({ ...prev, client_id: clientId, work_type: defaultWorkType(client) }));
  };

  // Clicking a Today row when idle pre-fills the picker so the user can
  // continue the same work on the same client with one click.
  const restartFromSession = (session) => {
    if (status.running) return;
    if (!session?.client_id) return;
    const client = clients.find((item) => Number(item.id) === Number(session.client_id));
    if (!client) return;
    const options = workTypeOptions(client);
    const wt = options.find((option) => option.value === session.work_type)?.value || defaultWorkType(client);
    setPicker({
      client_id: String(client.id),
      work_type: wt,
      task_note: session.task_note || '',
    });
    setError('');
  };

  // Format helpers used by the rich Today rows below.
  const WORK_TYPE_LABELS = {
    tracker: 'Tracker',
    manual: 'Manual',
    fixed: 'Fixed',
    outside_of_upwork: 'Outside Upwork',
    office_work: 'Office',
    test_task: 'Test task',
  };
  const workTypeLabel = (value) => WORK_TYPE_LABELS[value] || value || '—';

  const liveSeconds = useMemo(() => {
    if (!status.session) return 0;
    const frozen = Number(status.session.frozen_seconds || 0);
    if (status.paused) return frozen;
    const last = Date.parse(status.session.last_change_at || status.session.started_at);
    if (Number.isNaN(last)) return Number(status.session.total_seconds || 0);
    return frozen + Math.max(0, Math.floor((Date.now() - last) / 1000));
  }, [status.session, status.paused, ticker]);

  const currentTitle = status.running
    ? sessionTitle({ ...status.session, task_note: picker.task_note || status.session?.task_note }, clients)
    : picker.task_note || selectedClient?.name || 'What are you working on?';
  const totalTodaySeconds = useMemo(() => {
    const activeId = status.session?.id;
    const saved = todaySessions.reduce((sum, session) => {
      // Skip the active session's stale saved total — we'll add the live
      // figure once below to avoid double counting.
      if (activeId && Number(session.id) === Number(activeId)) return sum;
      return sum + Number(session.total_seconds || 0);
    }, 0);
    return saved + (status.running ? liveSeconds : 0);
  }, [liveSeconds, status.running, status.session, todaySessions]);
  const activity = status.session?.activity_percent ?? 0;
  const pendingScreenshots = status.pending?.screenshots ?? 0;
  const pendingSamples = status.pending?.activity ?? 0;
  const weekDays = useMemo(() => {
    const days = (week || []).slice(-5).map((day) => ({
      ...day,
      total_seconds: Number(day.total_seconds || 0) + (day.is_today && status.running ? liveSeconds : 0),
    }));
    return days;
  }, [week, status.running, liveSeconds]);
  const weekScaleSeconds = useMemo(
    () => Math.max(9 * 3600, ...weekDays.map((day) => day.total_seconds)),
    [weekDays]
  );
  const todayRows = useMemo(() => {
    const rows = [...todaySessions];

    if (status.running && status.session) {
      const existingIndex = rows.findIndex((session) => Number(session.id) === Number(status.session.id));
      const live = {
        ...status.session,
        total_seconds: liveSeconds,
        status: 'active',
        task_note: picker.task_note || status.session.task_note,
      };

      if (existingIndex >= 0) rows[existingIndex] = { ...rows[existingIndex], ...live };
      else rows.unshift(live);
    }

    return rows.slice(0, 8);
  }, [liveSeconds, picker.task_note, status.running, status.session, todaySessions]);

  const refreshToday = async () => {
    if (typeof window.tt?.meta?.todaySessions !== 'function') return;
    try {
      const sessions = await window.tt.meta.todaySessions();
      setTodaySessions(sessions || []);
    } catch {
      // The live timer is still useful if today history cannot load.
    }
  };

  const refreshWeek = async () => {
    if (typeof window.tt?.meta?.weekSummary !== 'function') return;
    try {
      const days = await window.tt.meta.weekSummary();
      setWeek(days || []);
    } catch {
      // Chart simply stays empty when offline.
    }
  };

  useEffect(() => {
    (async () => {
      const results = await Promise.allSettled([
        window.tt.meta.clients(),
        window.tt.tracker.status(),
        typeof window.tt?.meta?.todaySessions === 'function'
          ? window.tt.meta.todaySessions()
          : Promise.resolve([]),
      ]);

      const [clientsRes, statusRes, todayRes] = results;

      if (clientsRes.status === 'fulfilled') {
        setClients(clientsRes.value || []);
      }
      if (statusRes.status === 'fulfilled') {
        setStatus(statusRes.value);
      }
      if (todayRes.status === 'fulfilled') {
        setTodaySessions(todayRes.value || []);
      }

      const failures = results
        .map((r, i) => (r.status === 'rejected' ? { i, reason: r.reason } : null))
        .filter(Boolean);

      refreshWeek();

      if (failures.length) {
        const labels = ['clients', 'tracker status', "today's sessions"];
        const detail = failures
          .map((f) => `${labels[f.i]}: ${f.reason?.message || f.reason}`)
          .join('; ');
        const staleBridge = failures.some(
          (f) => /is not a function/i.test(String(f.reason?.message || f.reason))
        );
        setError(
          staleBridge
            ? 'Could not load tracker data — the desktop app needs to be restarted to pick up the latest update. ' + detail
            : 'Could not load tracker data: ' + detail
        );
      }
    })();
  }, []);

  useEffect(() => {
    const offChanged = window.tt.tracker.onChanged((s) => setStatus(s));
    const offStopped = window.tt.tracker.onStopped(() => { refreshToday(); refreshWeek(); });
    const offWarning = window.tt.tracker.onWarning((m) => setWarning(m));
    return () => { offChanged?.(); offStopped?.(); offWarning?.(); };
  }, []);

  useEffect(() => {
    if (!status.running || status.paused) return undefined;
    const t = setInterval(() => setTicker((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [status.running, status.paused]);

  const handleStart = async () => {
    setError('');
    setWarning('');
    setBusy(true);

    try {
      if (!selectedClient) {
        throw new Error('Select a client before starting.');
      }

      if (!descriptionValid) {
        throw new Error('Add a description before starting.');
      }

      const next = await window.tt.tracker.start({
        client_id: Number(selectedClient.id),
        upwork_profile_id: selectedClient.upwork_profile_id || null,
        work_type: effectiveWorkType || null,
        task_note: picker.task_note.trim(),
      });
      setStatus(next);
      await refreshToday();
    } catch (err) {
      setError(err?.message || 'Could not start session');
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);

    try {
      const next = await window.tt.tracker.stop({ task_note: picker.task_note || null });
      setStatus(next);
      await refreshToday();
    } catch (err) {
      setError(err?.message || 'Could not stop session');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (status.running) {
      const ok = confirm('A session is running. Stop and log out?');
      if (!ok) return;
      await window.tt.tracker.stop({});
    }
    await window.tt.auth.logout();
    onLogout?.();
  };

  return (
    <div className="scrin-shell">
      <header className="tracker-top">
        <div>
          <div className="tracking-eyebrow">Tracking for myself</div>
          <h1>{user?.name || 'Timetracker'}</h1>
        </div>
        <button className="menu-button" onClick={() => setMenuOpen((open) => !open)} aria-label="Menu">
          <span />
          <span />
          <span />
        </button>
      </header>

      {menuOpen && (
        <aside className="settings-panel">
          <div className="settings-head">
            <strong>Settings</strong>
            <button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Close">x</button>
          </div>
          <p className="settings-note">These are managed by your administrator in the web app.</p>
          <label className="setting-row">
            <input type="checkbox" checked={!!status.settings?.desktop_auto_start} readOnly disabled />
            Launch on system startup
          </label>
          <label className="setting-row">
            <input type="checkbox" checked={!!status.settings?.notify_on_screenshot} readOnly disabled />
            Notify when a screenshot is taken
          </label>
          <label className="setting-row">
            <input type="checkbox" checked={Number(status.settings?.auto_pause_minutes || 0) > 0} readOnly disabled />
            Auto-pause after {status.settings?.auto_pause_minutes || 0} min idle
          </label>
          <div className="settings-grid">
            <div>
              <span>Screenshots</span>
              <strong>
                {status.settings?.capture_enabled === false || status.settings?.screenshots_per_hour === 0
                  ? 'Off'
                  : `${status.settings?.screenshots_per_hour || Math.round(3600 / (status.settings?.screenshot_interval_max_seconds || 600))}/hr`}
              </strong>
            </div>
            <div><span>Offline queue</span><strong>{pendingScreenshots + pendingSamples}</strong></div>
            <div><span>Activity</span><strong>{activity}%</strong></div>
            <div><span>Server</span><strong>{apiBaseUrl || 'Not set'}</strong></div>
          </div>
          <button className="logout-button" onClick={handleLogout}>Log out</button>
        </aside>
      )}

      <main className="tracker-main">
        <section className="hero-panel">
          <div className={['timer-orb', status.paused ? 'paused' : status.running ? 'live' : ''].join(' ').trim()}>
            <div className="clock-icon">○</div>
            <div className="orb-time">{fmtClock(liveSeconds)}</div>
            <div className="orb-label">{status.paused ? 'paused' : status.running ? 'tracking' : 'today'}</div>
            {status.running && (
              <div className={['orb-status', status.paused ? 'paused' : 'live'].join(' ')}>
                <span className="orb-status-dot" />
                {status.paused ? 'Paused — resumes when you return' : 'Live'}
              </div>
            )}
          </div>

          <div className="week-panel">
            <div className="week-labels">
              {weekDays.map((day) => (
                <span key={day.date} className={day.is_today ? 'active-day' : ''}>{day.weekday}</span>
              ))}
            </div>
            <div className="week-chart">
              <span />
              <span />
              <span />
              <div className="week-bars">
                {weekDays.map((day) => (
                  <div
                    key={day.date}
                    className={day.is_today ? 'week-bar today' : 'week-bar'}
                    style={{ height: `${Math.max(day.total_seconds > 0 ? 6 : 2, Math.min(96, (day.total_seconds / weekScaleSeconds) * 100))}%` }}
                    title={`${day.weekday}: ${fmtShort(day.total_seconds)}`}
                  />
                ))}
              </div>
              <div className="axis"><b>9h</b><b>6h</b><b>3h</b><b>0h</b></div>
            </div>
          </div>

          <div className="task-pill">
            {!status.running ? (
              <div className="task-fields">
                <select value={picker.client_id} onChange={(e) => handleClientChange(e.target.value)}>
                  <option value="">Select client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
                {workTypeChoices.length > 1 && (
                  <select
                    value={effectiveWorkType}
                    onChange={(e) => setPicker({ ...picker, work_type: e.target.value })}
                    title="Upwork work type for this entry"
                  >
                    {workTypeChoices.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                )}
                <input
                  value={picker.task_note}
                  onChange={(e) => setPicker({ ...picker, task_note: e.target.value })}
                  placeholder="Description (required)"
                  required
                />
              </div>
            ) : (
              <div className="running-title">{currentTitle}</div>
            )}
            <button
              className={status.running ? 'round-action stop' : 'round-action start'}
              onClick={status.running ? handleStop : handleStart}
              disabled={busy || (!status.running && (!selectedClient || !descriptionValid))}
              aria-label={status.running ? 'Stop tracking' : 'Start tracking'}
            >
              {status.running ? <span className="stop-square" /> : <span className="play-triangle" />}
            </button>
          </div>
        </section>

        {selectedClient && !status.running && (
          <section className="client-strip">
            <div><span>Work type</span><strong>{workTypeChoices.find((o) => o.value === effectiveWorkType)?.label || 'Not set'}</strong></div>
            <div><span>Tracker</span><strong>{selectedClient.upwork_profile_name || 'Not attached'}</strong></div>
          </section>
        )}

        {(error || warning) && (
          <section className="notice-stack">
            {error && <div className="error">{error}</div>}
            {warning && <div className="warning">{warning}</div>}
          </section>
        )}

        <section className="today-panel">
          <div className="section-title">
            <h2>Today</h2>
            <strong>{fmtShort(totalTodaySeconds)}</strong>
          </div>
          {todayRows.length === 0 ? (
            <p className="empty-today">No tracked work yet. Pick a client above and hit start.</p>
          ) : (
            <div className="today-list">
              {todayRows.map((session) => {
                const isActive = session.status === 'active' || (status.running && Number(session.id) === Number(status.session?.id));
                const matchingClient = clients.find((c) => Number(c.id) === Number(session.client_id));
                const clientName = session.client_name || matchingClient?.name;
                const trackerName = session.upwork_profile_name || matchingClient?.upwork_profile_name;
                const canResume = !status.running && !!session.client_id;
                return (
                  <button
                    type="button"
                    key={session.id || session.client_uuid}
                    className={[
                      'today-row',
                      isActive ? 'active' : '',
                      canResume ? 'resumable' : '',
                    ].join(' ').trim()}
                    onClick={() => canResume && restartFromSession(session)}
                    disabled={!canResume}
                    title={canResume ? 'Click to load this work into the start form' : ''}
                  >
                    <div className="today-row-main">
                      <strong className="today-row-title">{session.task_note || sessionTitle(session, clients)}</strong>
                      <div className="today-row-meta">
                        {clientName && <span className="chip chip-client">{clientName}</span>}
                        {session.work_type && <span className="chip chip-worktype">{workTypeLabel(session.work_type)}</span>}
                        {trackerName && <span className="chip chip-tracker">{trackerName}</span>}
                        {isActive && status.paused && <span className="chip chip-paused">Paused</span>}
                        {isActive && !status.paused && <span className="chip chip-live">Live</span>}
                      </div>
                    </div>
                    <strong className="today-row-time">{fmtShort(isActive ? liveSeconds : session.total_seconds || 0)}</strong>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="status-footer">
          <div><span>Activity</span><strong>{activity}%</strong></div>
          <div><span>Pending screenshots</span><strong>{pendingScreenshots}</strong></div>
          <div><span>Pending samples</span><strong>{pendingSamples}</strong></div>
        </section>
      </main>
    </div>
  );
}
