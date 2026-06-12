import React, { useEffect, useState } from 'react';
import Login from './views/Login.jsx';
import Tracker from './views/Tracker.jsx';

export default function App() {
  const [authState, setAuthState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const state = await window.tt.auth.state();
        setAuthState(state);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Server rejected our token (e.g. it was revoked): drop to the login
  // screen with a clear message instead of surfacing raw 401 errors.
  useEffect(() => {
    if (typeof window.tt?.auth?.onExpired !== 'function') return undefined;
    const off = window.tt.auth.onExpired(() => {
      setNotice('Your session expired — please sign in again.');
      setAuthState((prev) => ({ ...(prev || {}), hasToken: false, user: null }));
    });
    return () => off?.();
  }, []);

  if (loading) {
    return (
      <div className="app">
        <main className="app-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="subtle">Loading...</div>
        </main>
      </div>
    );
  }

  if (!authState?.hasToken) {
    return (
      <Login
        initial={authState}
        notice={notice}
        onLoggedIn={(s) => {
          setNotice('');
          setAuthState({ ...authState, ...s, hasToken: true });
        }}
      />
    );
  }

  return (
    <Tracker
      user={authState.user}
      apiBaseUrl={authState.apiBaseUrl}
      onLogout={() => setAuthState({ ...authState, hasToken: false, user: null })}
    />
  );
}
