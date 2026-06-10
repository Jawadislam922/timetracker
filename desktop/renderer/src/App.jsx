import React, { useEffect, useState } from 'react';
import Login from './views/Login.jsx';
import Tracker from './views/Tracker.jsx';

export default function App() {
  const [authState, setAuthState] = useState(null);
  const [loading, setLoading] = useState(true);

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
    return <Login initial={authState} onLoggedIn={(s) => setAuthState({ ...authState, ...s, hasToken: true })} />;
  }

  return (
    <Tracker
      user={authState.user}
      apiBaseUrl={authState.apiBaseUrl}
      onLogout={() => setAuthState({ ...authState, hasToken: false, user: null })}
    />
  );
}
