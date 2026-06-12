# Open Issues Backlog

Working list of reported issues, one entry each, worked one by one.
Last updated: 2026-06-12 (evening).

## SHIPPED in Desktop v0.2.0 (commit d1d9a5f) — pending team rollout

Issues #1 (Office Work/Test Task), #2 (401 re-login UX), #4 (login screen
revamp) and queue item 7 (auto-update) are all built into **Desktop v0.2.0**,
live on the downloads page. Issue #3 (slow clock in/out) was fixed
server-side (commit 2fb28be: 165 queries → 3) and needs no app update.
Remaining rollout steps: every Windows user installs v0.2.0 once (last
manual install ever — auto-update takes over after); Mac build via
documents/MAC_BUILD_PROMPT_0.2.0.md on the Mac.

## 1. Desktop app cannot track client-less "Office Work" — OPEN (priority)

**Reported 2026-06-12.** Internal/office tasks have no client, but the desktop
tracker requires picking a client to start. The owner's workaround idea
(create an "Office Work" client) cannot work because:

- Client `work_type` is the **Upwork engagement type** (`tracker_manual`,
  `fixed`, `outside_of_upwork`) — `office_work` is a **per-entry** work type
  (work_hours), intentionally not offered on the client form.
- The desktop app derives its work-type choices from the client's engagement
  type (`workTypeOptions()` in `desktop/renderer/src/views/Tracker.jsx`), so
  a fake client would still record Tracker/Manual, not Office Work.

**Agreed fix (updated 2026-06-12):** clientless sessions are already
supported by the API (`StartSessionRequest.client_id` is nullable;
`SessionController::start` stores null). Add TWO pinned no-client options to
the desktop picker: **"Office Work"** (`work_type = 'office_work'`) and
**"Test Task"** (`work_type = 'test_task'`) — both values already pass the
server whitelist and render with chips in Reports/Slack. The work-hour sync
then produces rows identical to manual entries ("No Client" + the work-type
chip). Verify Timeline/Team aggregations render null-client sessions cleanly.

**Touches:** desktop renderer (picker + quick-start chips + workTypeOptions),
light server checks. **Requires a new desktop installer build** (Windows NSIS
+ macOS via the Mac session) and users updating — batch with other pending
desktop changes.

## 2. Desktop tracker 401 — "Could not load tracker data" — OPEN

**Reported 2026-06-12** (screenshot of the desktop app error banner):
`meta:clients` and `meta:todaySessions` both fail with 401. This is the
desktop app (Electron IPC `meta:*` methods): its stored Sanctum API token is
no longer valid. Immediate user workaround: log out and back in inside the
desktop app.

To investigate/fix:
- Why the token became invalid (revoked? deleted? never refreshed after a
  password change/reset? — the new Slack reset flow rotates remember_token
  but does not touch Sanctum tokens, so identify the actual revocation path).
- UX: on any 401 the desktop app should drop to the login screen with a
  "session expired, please sign in again" message instead of a raw Axios
  error banner. (Desktop change → needs installer rebuild; batch with #1.)

## 3. Clock In/Out actions take 5-6 seconds — OPEN (performance)

**Reported 2026-06-12**, channel unknown (web dashboard or desktop).
Likely root cause found on inspection: after each clock action the dashboard
refetches `time-entries/today-summary`, and for users with team visibility
`TimeEntryController::getTodaysSummary()` loads **3 separate entry queries
per employee × ~55 users ≈ 165 queries** per refresh. Same N+1 family as the
old DashboardController (fixed 2026-06-11 by batching into grouped queries).

Fix sketch: batch the per-user today/week/month entry loads into 3 grouped
whereIn queries (or one range query bucketed in PHP), mirroring the
DashboardController::loadSums() approach. Server-side; no desktop rebuild.
Also confirm the desktop clock bar isn't calling the same heavy endpoint.

## 4. Desktop login screen revamp — OPEN

**Reported 2026-06-12.** The login screen exposes Server URL and Device name
fields (`desktop/renderer/src/views/Login.jsx`) — confusing for employees.

- **Server URL**: default to https://timetracker.sparkingasia.com baked in;
  hide the field behind a small "Advanced" toggle (kept for local dev).
- **Device name**: auto-fill from the machine hostname (`os.hostname()` in
  the main process); editable but never required.
- **Remember me**: persist email + password locally so reopening the app
  signs in without retyping. Password encrypted at rest with Electron
  `safeStorage` (OS keychain-backed), never plaintext in the store file.
- **Show/hide password** eye toggle so typos are visible.

Desktop-only → part of the next installer bundle.

## Next in queue (carried from earlier sessions)

2. **Design revamp** — phase 1 welcome+login (approved, awaiting "go"),
   phase 2 app shell, phase 3 data-heavy pages.
3. **Reports page pagination** — slowest page (~2s), loads the whole month
   for all users.
4. **Polish batch** — normalize www./bare domains in Apps & URLs; honor the
   12/24h display setting in monitoring timestamps; branded 404/500 pages.
5. **User-side chores** — DB password rotation (then update .env via SSH —
   printf, never echo), team avatar re-uploads, delete leftover hPanel test
   crons (cron-test, cron-simple), audit night-shift users stored 21:00 vs
   real 22:00.
6. **Saved design:** 8AM→8AM business-day attendance bucketing —
   documents/ATTENDANCE_DAY_BUCKETING.md.
7. **Desktop auto-update (approved 2026-06-12)** — electron-updater with the
   "generic" provider: serve `latest.yml` + installers from the existing
   deploy-proof installers folder via a public route on
   timetracker.sparkingasia.com. Check on launch + periodic + a manual
   "Check for updates" control; background download; install-on-restart (no
   uninstall/reinstall). Windows works unsigned. **Apple Developer ID
   DECLINED (2026-06-12)** — too expensive for now, only 2 Macs in the team:
   Mac users stay on manual updates with the documented Gatekeeper unblock
   steps. Plan: ship the NEXT desktop build as the one-final-manual-install
   bundle = auto-updater + Office Work/Test Task pickers (#1) + 401 re-auth
   UX (#2) + login screen revamp (#4); everything after arrives via
   auto-update on Windows.
