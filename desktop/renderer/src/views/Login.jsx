import React, { useEffect, useState } from 'react';

export default function Login({ initial, notice, onLoggedIn }) {
  const [apiBaseUrl, setApiBaseUrl] = useState(initial?.apiBaseUrl || 'https://timetracker.sparkingasia.com');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [deviceName, setDeviceName] = useState(initial?.deviceName || initial?.hostname || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!deviceName) {
      setDeviceName(initial?.hostname || navigator.platform || 'Desktop');
    }
    // Prefill remembered credentials so returning users just hit Sign in.
    if (typeof window.tt?.auth?.saved === 'function') {
      window.tt.auth.saved().then((saved) => {
        if (saved?.email) {
          setEmail(saved.email);
          setPassword(saved.password || '');
          setRemember(true);
        }
      }).catch(() => {});
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const user = await window.tt.auth.login({ email, password, deviceName, apiBaseUrl, remember });
      onLoggedIn({ user, apiBaseUrl });
    } catch (err) {
      const msg = err?.message || 'Login failed.';
      setError(msg.includes('credentials') ? 'Invalid email or password.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrapper">
      <form className="login-card" onSubmit={submit}>
        <h1>Timetracker Desktop</h1>
        <p className="subtitle">Sign in with your Timetracker account.</p>

        {notice && <div className="warning" style={{ marginBottom: 12 }}>{notice}</div>}

        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="field">
          <label>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', paddingRight: 44, boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                padding: 6,
                opacity: 0.75,
              }}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{ width: 'auto', margin: 0 }}
          />
          <span>Remember me on this device</span>
        </label>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            marginBottom: showAdvanced ? 8 : 0,
            fontSize: 12,
            opacity: 0.7,
            textAlign: 'left',
          }}
        >
          {showAdvanced ? '▾ Advanced' : '▸ Advanced'}
        </button>

        {showAdvanced && (
          <>
            <div className="field">
              <label>Server URL</label>
              <input
                type="url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="https://timetracker.sparkingasia.com"
                required
              />
            </div>

            <div className="field">
              <label>Device name</label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Spark Laptop"
                required
              />
            </div>
          </>
        )}

        {error && <div className="error">{error}</div>}

        <button type="submit" className="primary" disabled={busy} style={{ width: '100%', marginTop: 8 }}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
