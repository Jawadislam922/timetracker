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
   (anthropic-ai/sdk). The Developer page "AI" group + ANTHROPIC_API_KEY
   slot + services.anthropic config SHIPPED (d173be6).
   **Blocked on:** user creating an Anthropic API key (console.anthropic.com).
2. ~~Navigation reorganization + clickable rows~~ **SHIPPED d173be6**,
   QA'd in browser 2026-06-13: Performance ▾ / Management ▾ / System ▾
   groups, Attendance top-level, Desktop App in avatar menu, Team renamed
   Team Performance with member click→filtered report, client click→report.
3. **Design revamp (Ember cinematic — picked 2026-06-13)** — phase 2 shell
   SHIPPED e912318; phase 3 part 1 SHIPPED ae083c6 (Dashboard, Team
   Performance, Timeline fully dark); part 2 SHIPPED 59c399d: dark canvas
   + ember headers on every remaining page (Reports, Work Diary,
   Attendance, Clients, Users, Settings, Developer, Desktop App, forms via
   PageShell/PageHeader + layout root). Content cards inside those pages
   stay light ("cards on dark") — optional final polish: convert each
   page's tables/cards to full dark. All verified live in browser.
   Note: color-scheme "only light" meta (d38e813) — flip to "dark" when
   the card interiors go dark too.

3b. **Timeline overnight split — SHIPPED 2d80aa7, verified on real night
   shift data**: sessions show on every day they overlap, screenshots/
   activity under the correct calendar date, totals split at midnight
   (Fri 3h24m + Sat 1h55m = 5h19m week ✓). Early clock-in grace now 4h.
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

## NEXT SESSION QUEUE (noted 2026-06-13 morning, before Jawad logged off)

1. **Screenshot lightbox (first thing)** — clicking a screenshot must open
   an in-page popup, NOT a new tab. Next/Prev arrows (+ arrow keys) to
   flip through a session's screenshots fast; show time/app/activity; put
   Flag and Delete inside the lightbox. Applies to Timeline and the
   monitoring SessionDetail page.
2. **Inertia v1 -> v2 upgrade** — hover prefetch + deferred props for
   instant-feeling nav (measured floor ~0.7s, first visits ~2s).
3. **Full-system page audit WITH Jawad** — walk every page together and
   write documents/PAGE_AUDIT.md: per page (a) what it is for, (b) what
   can be improved, (c) what looks bad, (d) performance notes. This is
   the agreed page-per-page optimization plan.
4. AI phase 2: act-through-chat (permissions/shifts/attendance changes
   with confirmation cards) — awaiting explicit go.
5. Dark interiors final polish (Clients/Users/Settings/Attendance/forms
   card interiors) + flip the color-scheme meta to dark when complete.
6. Coverage chip in Attendance Summary tab + teach the AI assistant
   coverage questions.

USER-SIDE (Jawad): bulk-set night team shifts (Users -> sort by Shift ->
bulk edit); grant "Use the AI Assistant" to managers; verify Haris
Junaid's 41h manual entry on 06-07; security batch (DB password, old AWS
key, test crons); Mac build via the Mac prompt doc (builds v0.3.0).

## DELETION CLEANUP GAPS (Jawad, 2026-06-13, screenshot of Jawad Islam Fri 12)

A. Leftover residue after deleting sessions/screenshots: month-strip still
   shows green day dots, Week/Month totals show 1m, and the Tasks box lists
   clients at 0m. Cause: sessions reduced to <60s still exist (dot renders
   for any total_seconds > 0; client breakdown lists every session). Fix:
   treat <60s sessions as nothing everywhere (strip dots, totals, client
   breakdown, Team Performance) — or auto-delete sessions that hit 0.
B. Work Diary -> full cascade: deleting a work-hour entry must also remove
   its linked tracking session, screenshots, activity samples, and any
   Timeline/Team Performance traces (reverse of the session->workhour sync).
   Same audit trail as session deletion.
C. INDUSTRY-LEVEL FULL INSPECTION (CEO-ready): thorough joint pass over
   every page and every flow — correctness of all numbers across pages
   (Timeline = Reports = Team = Dashboard = Attendance), deletion cascades
   verified end to end, visual polish, empty states, error states, perf.
   Output: documents/PAGE_AUDIT.md with per-page findings + fix list.

## SHIPPED 2026-06-13 (continued session, opus fast)
- Deletion residue (gap A) FIXED e49f6c2: screenshot deletion that guts a
  session <60s with no shots purges the whole session; Timeline totals/
  Tasks/month-dots, week/month totals, and Team Performance ignore
  sub-minute sessions. One-time prod cleanup removed 52 existing ghost
  sessions (438s) + 33 orphan samples. Verified user 2 Fri Jun12 = 0m.
- Work Diary reverse cascade (gap B) FIXED e49f6c2: deleting a tracker
  entry (single+bulk) tears down its session, screenshots, samples;
  manual entries unaffected; audit logged. Shared
  TrackingSessionService::purge(). Tests: DeletionCascadeTest (3).
- Screenshot lightbox (queue #1) SHIPPED 83ae935: in-page viewer, Prev/
  Next + arrow keys across the day's shots, Esc close, header shows
  time/app/activity/flag/position, Flag + Delete inside. NOT YET applied
  to monitoring SessionDetail page — do in the joint audit.
- 116 tests green.

STILL NEXT: Inertia v2 speed upgrade (queue #2); full CEO-ready page
audit WITH Jawad -> documents/PAGE_AUDIT.md (queue #3, gap C); apply
lightbox to SessionDetail; dark card interiors; AI phase 2.

## SHIPPED 2026-06-13 (avatars/logo/filters, opus fast)
- Avatars (ab8f83b + 0c905c1): root cause was avatar_url minting a fresh
  presigned S3 URL every render -> no browser cache -> ~50 signed GETs to
  Stockholm at once -> 503 throttling + slow. Now a stable cached
  /avatar/{user} proxy (week browser cache + ETag/304 + server byte
  cache) AND on-serve resize to 160px. Live photos were 1.7-1.8MB ->
  ~30KB (60x). Also: 25 of 28 avatar refs were DEAD pointers (files
  wiped by pre-S3 deploys) -> nulled them so they show initials with no
  failed request (images already gone; only broken pointers removed). 3
  live avatars remain (ids 2,3,41).
- Logo: byte-cached + resized 1024px/1MB -> 320px/102KB (10x). Both
  verified live.
- Users filters lost on edit return FIXED: UserEdit never read the
  return_to prop, so save redirected to a filterless /users. Wired
  return_to -> UserForm. Verified: edit+save returns to
  /users?dir=desc&search=claude&sort=shift intact.
- New: AvatarController, app/Support/ImageResizer (GD, graceful
  fallback). 116 tests green.
- CHORE still open: 25 users need avatar re-uploads (originals long gone).
