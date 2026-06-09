import React, { useEffect, useState } from 'react';

export default function Login({ initial, onLoggedIn }) {
  const [apiBaseUrl, setApiBaseUrl] = useState(initial?.apiBaseUrl || 'http://timetracker.test');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState(initial?.deviceName || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!deviceName) {
      // Suggest a reasonable default like "Windows · Spark"
      setDeviceName(`${navigator.platform || 'Desktop'}`);
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await window.tt.auth.login({ email, password, deviceName, apiBaseUrl });
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

        <div className="field">
          <label>Server URL</label>
          <input
            type="url"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://timetracker.example.com"
            required
          />
        </div>

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
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        {error && <div className="error">{error}</div>}

        <button type="submit" className="primary" disabled={busy} style={{ width: '100%', marginTop: 8 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
