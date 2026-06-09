# Timetracker Desktop

Lightweight Electron tracker that uploads screenshots, activity samples,
and time totals to the Timetracker Laravel app (the parent folder,
`C:\laragon\www\timetracker`). This module lives at
`C:\laragon\www\timetracker\desktop` so the whole project ships from a
single git repository.

This is the Phase 2 prototype for the screenshot-monitoring feature
described in `FEATURE_ROADMAP_ATTENDANCE_REPORTS_MONITORING.md`.

## Features

- Sign in with your Timetracker email & password (token stored via
  electron-store).
- Pick a client, work type, optional Upwork profile, task note.
- Start / Stop tracker.
- Captures the primary screen at random intervals (range comes from
  `/api/desktop/settings`; defaults 5–10 min).
- Tracks keyboard & mouse counts (no key content) via `uiohook-napi`,
  idle time via Electron's `powerMonitor`.
- Captures active app name + window title (and URL domain on supported
  browsers) via `active-win`.
- Offline-safe: all uploads go through a SQLite queue
  (`better-sqlite3`). When the network is down the local queue keeps
  filling; uploads drain automatically when connectivity returns.

## Project layout

```
timetracker-desktop/
├── main/               # Electron main-process modules
│   ├── main.js         # entry; creates the BrowserWindow
│   ├── config.js       # paths + defaults
│   ├── store.js        # electron-store wrapper (token, settings)
│   ├── api.js          # axios client for /api/desktop/*
│   ├── queue.js        # SQLite offline queue (better-sqlite3)
│   ├── screenshotService.js
│   ├── activityService.js
│   ├── trackerService.js  # orchestrates start/stop/heartbeat/sync
│   └── ipc.js          # ipcMain handlers exposed to the renderer
├── preload/
│   └── preload.js      # contextBridge -> window.tt
├── renderer/           # Vite + React UI
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── styles.css
│       └── views/
│           ├── Login.jsx
│           └── Tracker.jsx
├── package.json
├── vite.config.js
└── README.md
```

## Prerequisites

- Node.js 18+
- npm 9+
- Visual Studio Build Tools (Windows) — required to compile native
  modules (`better-sqlite3`, `uiohook-napi`)
- The Timetracker Laravel app reachable on your network. Default during
  local dev: `http://timetracker.test`.

## Install

```powershell
cd C:\laragon\www\timetracker\desktop
npm install
# Native modules must be built against Electron, not against system Node:
npm run rebuild
```

If `npm run rebuild` fails on Windows, install build tooling once:

```powershell
npm install --global windows-build-tools
```

## Development

Run the Vite dev server and Electron together:

```powershell
npm run dev
```

The renderer hot-reloads at `http://localhost:5173`; Electron picks
that up automatically. DevTools open in a detached window.

## Production build

```powershell
npm run start    # builds renderer then launches Electron from packaged assets
npm run dist     # produces an NSIS installer in dist-app/  (Windows)
```

## How it talks to the server

The desktop app expects the Laravel Phase 1 endpoints under
`/api/desktop/*` to exist. The full list:

| Method | Path                              | Purpose                                |
|--------|-----------------------------------|----------------------------------------|
| POST   | `/api/desktop/login`              | Exchange email+password for a token    |
| GET    | `/api/desktop/me`                 | Get the current user                   |
| POST   | `/api/desktop/logout`             | Revoke the current token               |
| GET    | `/api/desktop/clients`            | List clients                           |
| GET    | `/api/desktop/work-types`         | List work types                        |
| GET    | `/api/desktop/upwork-profiles`    | List Upwork profiles                   |
| GET    | `/api/desktop/settings`           | Capture interval, idle threshold, etc. |
| POST   | `/api/desktop/sessions/start`     | Idempotent (per `client_uuid`)         |
| PATCH  | `/api/desktop/sessions/{id}/heartbeat` | Periodic update of elapsed time   |
| POST   | `/api/desktop/sessions/{id}/stop` | Mark a session stopped                 |
| POST   | `/api/desktop/screenshots`        | Multipart upload                       |
| POST   | `/api/desktop/activity/batch`     | Array of activity samples              |

## Privacy posture

This app follows the privacy guardrails from the project roadmap:

- Tracking only happens between Start and Stop. There is no background
  capture.
- We never record actual keystroke content — only counts.
- We never access the webcam, microphone, or files outside the
  screenshot directory the app owns.
- All local artifacts live in your OS user-data directory (e.g.
  `%APPDATA%\timetracker-desktop\` on Windows).

## Roadmap (next iterations)

- Auto-pause when idle exceeds the configured threshold; auto-resume on
  activity.
- System tray icon with quick Start / Stop and current status.
- Multi-monitor capture toggle (currently primary monitor only).
- "Offline time" entries when working without a computer.
- Auto-update via electron-updater.
- Encrypted local queue using a OS-keychain-backed key.
