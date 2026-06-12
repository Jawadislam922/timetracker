# Open Issues Backlog

Working list of reported issues, one entry each, worked one by one.
Last updated: 2026-06-12.

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

**Agreed fix:** clientless sessions are already supported by the API
(`StartSessionRequest.client_id` is nullable; `SessionController::start`
stores null). Add a pinned **"Office Work (no client)"** option to the
desktop client picker that starts a session with `client_id = null`,
`work_type = 'office_work'`. The work-hour sync then produces rows identical
to manual Office Work entries (Reports already render "No Client" +
Office Work chip). Verify Timeline/Team aggregations render null-client
sessions cleanly.

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
7. **Desktop (from earlier):** macOS app is unsigned (Gatekeeper friction) —
   needs Apple Developer ID; auto-update flow for the desktop app.
