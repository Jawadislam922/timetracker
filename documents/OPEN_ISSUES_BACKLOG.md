# Open Issues Backlog

Working list, worked one by one. Last updated: 2026-06-12 (late evening).

## SHIPPED — for reference

- Desktop v0.2.0–v0.2.4: auto-update pipeline (electron-updater, generic feed
  at /desktop-updates), in-app download-progress banner with Restart now/Later,
  Office Work / Test Task / Upwork Bidding no-client tracking (pseudo-client
  IDs -1/-2/-3), 401 → "session expired" re-login UX, login revamp (baked URL,
  hostname device name, remember-me via safeStorage, show/hide password),
  branded app icon, one-click installer. Current: **v0.2.4**.
- Server: clock actions 165 queries → 3; Dashboard ~400 queries → 6; Desktop
  App page 3.6s → 10ms (cached installer hashes); Reports dropdown hydration
  fix; www/bare domain normalization (rollups + ingestion + backfill).
- Dashboard ↔ desktop two-way clock sync (45s + focus polling web, 60s +
  focus desktop); no clock-state flash on navigation.
- Avatars + self-service logo upload on S3 (Developer → Branding); survive
  deploys.
- Scheduler alive on hPanel cron (plain full-path command, no metacharacters)
  + HTTP fallback /cron/run/{token}; schedule-heartbeat liveness file.
- Slack: daily/weekly digests at 11:00; bot token saved; password-reset codes
  via Slack DM (6-digit, 10-min TTL, rate-limited).
- Stale-session sweep (close-stale-sessions every 10 min, stops at last
  heartbeat).
- Midnight-shift clock-in bucketing fix (attendanceDateFor + 180-min early
  grace).
- Welcome + Login redesign (phase 1); instant Settings toggles (JSON ack).

## BUILD QUEUE (Claude work, in recommended order)

1. **AI integration phase 1** — AI-written daily Slack digest narrative +
   "Summarize this day" button on Timeline. Laravel + official PHP SDK
   (anthropic-ai/sdk), key managed on the Developer page (new "AI" group).
   **Blocked on:** user creating an Anthropic API key (console.anthropic.com).
2. **Navigation reorganization + clickable rows** (proposed & endorsed):
   Dashboard / Timeline / Work Diary top-level; Performance ▾ = Reports +
   Team Performance (renamed from Team, rows clickable → member report);
   Attendance top-level; Management ▾ = Users / Clients / Profiles (clients
   clickable → client report); System ▾ = Settings / Developer (super-admin);
   Desktop App moves to the avatar menu.
3. **Design revamp** — direction pick pending (Ember dark recommended /
   Polar light / Dusk hybrid), then phase 2 app shell, phase 3 data-heavy
   pages. No performance regressions allowed.
4. **Reports deeper lightening** — server-side pagination/filtering so the
   month view stops shipping every row to the browser (page already
   paginates client-side; heavy dropdown hydration already fixed).
5. **Polish batch** — honor the 12/24h display setting in monitoring
   timestamps; branded 404/500 pages.
6. **Saved design (decision needed):** 8AM→8AM business-day attendance
   bucketing — documents/ATTENDANCE_DAY_BUCKETING.md (3 required pieces).

## USER-SIDE CHORES (only Jawad can do)

- Create Anthropic API key → unblocks build item 1.
- Delete the old AWS key (AKIA…7B6P) in IAM (new …B2PO key already live).
- Rotate the prod DB password (was pasted in chat) → then Claude updates
  .env over SSH (printf, never echo — no trailing newline in prod .env).
- Rotate SCHEDULER_HTTP_TOKEN (also pasted in chat) — rotate-later list.
- Delete leftover hPanel test crons (cron-test, cron-simple).
- Windows team: install v0.2.4 once (last manual install — auto-update
  takes over after).
- Mac build: run documents/MAC_BUILD_PROMPT_0.2.0.md on a Mac (pulls latest
  code so it builds the current version).
- Team avatar re-uploads (originals were wiped by deploys pre-S3).
- Audit night-shift users stored 21:00 vs real 22:00 shift start.
