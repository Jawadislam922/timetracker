import React, { useEffect, useMemo, useState } from 'react';

function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function Tracker({ user, apiBaseUrl, onLogout }) {
  const [status, setStatus] = useState({ running: false, session: null, pending: { screenshots: 0, activity: 0, heartbeats: 0 } });
  const [clients, setClients] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [upworkProfiles, setUpworkProfiles] = useState([]);
  const [picker, setPicker] = useState({ client_id: '', work_type: '', upwork_profile_id: '', task_note: '' });
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticker, setTicker] = useState(0);

  // Load meta on mount
  useEffect(() => {
    (async () => {
      try {
        const [c, w, u, s] = await Promise.all([
          window.tt.meta.clients(),
          window.tt.meta.workTypes(),
          window.tt.meta.upworkProfiles(),
          window.tt.tracker.status(),
        ]);
        setClients(c || []);
        setWorkTypes(w || []);
        setUpworkProfiles(u || []);
        setStatus(s);
      } catch (err) {
        setError('Could not load tracker data: ' + (err?.message || err));
      }
    })();
  }, []);

  // Subscribe to tracker events
  useEffect(() => {
    const off1 = window.tt.tracker.onChanged((s) => setStatus(s));
    const off2 = window.tt.tracker.onWarning((m) => setWarning(m));
    return () => { off1?.(); off2?.(); };
  }, []);

  // Local 1s tick to advance the clock between heartbeats
  useEffect(() => {
    if (!status.running) return;
    const t = setInterval(() => setTicker((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [status.running]);

  const liveSeconds = useMemo(() => {
    if (!status.session) return 0;
    const startedAtMs = Date.parse(status.session.started_at);
    return Math.floor((Date.now() - startedAtMs) / 1000);
  }, [status.session, ticker]);

  const handleStart = async () => {
    setError(''); setWarning(''); setBusy(true);
    try {
      const next = await window.tt.tracker.start({
        client_id: picker.client_id ? Number(picker.client_id) : null,
        upwork_profile_id: picker.upwork_profile_id ? Number(picker.upwork_profile_id) : null,
        work_type: picker.work_type || null,
        task_note: picker.task_note || null,
      });
      setStatus(next);
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
    <div className="app">
      <header className="app-header">
        <div className="app-title">Timetracker Desktop</div>
        <div className="app-user">
          {user?.name} ({user?.email})
          <button className="ghost" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="app-main">
        {!status.running && (
          <div className="card">
            <h2>New tracking session</h2>
            <div className="row">
              <div className="field">
                <label>Client</label>
                <select value={picker.client_id} onChange={(e) => setPicker({ ...picker, client_id: e.target.value })}>
                  <option value="">— Select —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Work type</label>
                <select value={picker.work_type} onChange={(e) => setPicker({ ...picker, work_type: e.target.value })}>
                  <option value="">— Select —</option>
                  {workTypes.map((w) => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>Upwork profile (optional)</label>
              <select value={picker.upwork_profile_id} onChange={(e) => setPicker({ ...picker, upwork_profile_id: e.target.value })}>
                <option value="">— None —</option>
                {upworkProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Task note (optional)</label>
              <textarea
                rows={2}
                placeholder="What are you working on?"
                value={picker.task_note}
                onChange={(e) => setPicker({ ...picker, task_note: e.target.value })}
              />
            </div>

            {error && <div className="error">{error}</div>}

            <button className="primary" onClick={handleStart} disabled={busy} style={{ marginTop: 6 }}>
              {busy ? 'Starting…' : 'Start tracking'}
            </button>
          </div>
        )}

        {status.running && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Tracking</h2>
              <span className="pill active"><span className="dot"></span> RECORDING</span>
            </div>

            <div className="timer-label">elapsed</div>
            <div className="timer">{fmtClock(liveSeconds)}</div>

            <div className="status-grid">
              <div className="stat">
                <div className="value">{status.session?.activity_percent ?? 0}%</div>
                <div className="label">Activity</div>
              </div>
              <div className="stat">
                <div className="value">{status.pending?.screenshots ?? 0}</div>
                <div className="label">Pending screenshots</div>
              </div>
              <div className="stat">
                <div className="value">{status.pending?.activity ?? 0}</div>
                <div className="label">Pending samples</div>
              </div>
            </div>

            <div className="divider"></div>

            <div className="field">
              <label>Task note</label>
              <textarea
                rows={2}
                placeholder="What are you working on?"
                value={picker.task_note}
                onChange={(e) => setPicker({ ...picker, task_note: e.target.value })}
              />
            </div>

            {warning && <div className="warning">{warning}</div>}
            {error && <div className="error">{error}</div>}

            <button className="danger" onClick={handleStop} disabled={busy}>
              {busy ? 'Stopping…' : 'Stop tracking'}
            </button>
          </div>
        )}

        <div className="card">
          <div className="subtle">
            Server: {apiBaseUrl || '(not configured)'}
            <br />
            Screenshots are captured at random intervals (per server settings) once you click <b>Start tracking</b>. Capture stops the moment you click <b>Stop</b>. You can review uploads in the web dashboard under Monitoring &rarr; Sessions.
          </div>
        </div>
      </main>
    </div>
  );
}
