# Complete Codex Chat And Project Handoff

Last updated: 2026-06-10 after local desktop installer build

This is the canonical starting document for any new Codex session or account
working on the Sparking Asia Time Tracker. It is the consolidated record of
the important requirements, decisions, implementation work, deployment
history, cautions, and future ideas discussed throughout the Codex
conversation. It is not a verbatim chat transcript; it is the durable,
actionable version of that discussion.

## Instructions For A New Codex Session

Use this prompt:

> Read `documents/CODEX_COMPLETE_CHAT_AND_PROJECT_HANDOFF.md` completely before making
> changes. Then inspect the current Git status and the files named in the
> relevant section. Preserve all existing work. Do not commit, push, deploy,
> or change production data unless I explicitly ask. Continue with the first
> incomplete item under "Next Steps", but ask before implementing any product
> decision marked "Decision Needed".

## Non-Negotiable Working Rules

- Keep new work local until Jawad has tested and approved it.
- Do not commit, push to GitHub, or deploy automatically.
- Do not discard, reset, or overwrite uncommitted changes.
- Do not expose or commit `.env`, Slack webhooks, passwords, database
  credentials, API keys, or production user data.
- Do not run demo seeders against production.
- Inspect the current implementation before assuming an older plan is still
  accurate.
- Implement and test one feature area at a time.
- After frontend work, visually inspect the relevant pages at desktop and
  smaller widths.
- Before a requested push, run the full verification checklist in this file.

## Project Snapshot

- Application: Sparking Asia Time Tracker
- Stack: Laravel, Inertia, React, Tailwind CSS, MySQL
- Workspace: `C:\laragon\www\timetracker`
- Current branch at last update: `jawad`
- Last committed revision at last update:
  `349e67e Add attendance calendar and shift rules`
- GitHub repository: `https://github.com/jawadislam92/timetracker`
- Commit `349e67e` was pushed to `origin/jawad` on 2026-06-09.
- Local URL: `http://127.0.0.1:8000`
- Production URL: `https://timetracker.sparkingasia.com`
- Production host: Hostinger shared hosting
- Portfolio functionality is intentionally removed and should not be restored.
- HR is not a role at present. Access should use Super Admin plus granular
  permissions assigned to Admin or Member accounts.

## Current Git And Local Work State

The approved attendance release was committed and pushed. The unfinished
screenshot-monitoring implementation was deliberately excluded because it is
not ready for production.

This `documents/` reorganization, the latest master handoff update, and the
manual attendance audit-history implementation were created after commit
`349e67e` and are currently local changes. Do not assume they are on GitHub
until Git status and remote history confirm that separately.

The local working tree still contains monitoring experiments, including
desktop API controllers, tracking models and migrations, monitoring pages,
permissions, routes, storage configuration, seeders, and tests. These files
must not be accidentally staged, committed, deployed, deleted, or reset.

A new session must run:

```powershell
git status --short
git diff --check
```

Released in commit `349e67e`:

- Monthly spreadsheet-style attendance grid.
- Manual attendance statuses stored separately from time entries.
- Permission-controlled manual attendance marking.
- Attendance Slack report with configurable columns and selected users.
- User-level shift start time and grace period.
- Automatic `LI` late status based on first clock-in after
  `shift start + grace` in released commit `349e67e`; this was split locally
  on 2026-06-10 into `LC` Late coming and `LI` Late joining.
- Matching late calculations in the web attendance grid and Slack report.
- Removal of the temporary HR role.
- Updated React production build assets.
- Attendance and Slack feature tests.
- Attendance cell popup positioning and responsive fixes.
- Bulk attendance calendar.
- Overnight-shift date attribution.
- Documentation and future roadmap.

Important local-only monitoring paths include:

- `app/Http/Controllers/Api/Desktop/`
- `app/Http/Controllers/MonitoringController.php`
- `app/Http/Requests/Desktop/`
- `app/Jobs/GenerateScreenshotThumbnail.php`
- `app/Models/MonitoringSetting.php`
- `app/Models/TrackingActivitySample.php`
- `app/Models/TrackingScreenshot.php`
- `app/Models/TrackingSession.php`
- `database/migrations/2026_06_09_000001_create_tracking_sessions_table.php`
- `database/migrations/2026_06_09_000002_create_tracking_screenshots_table.php`
- `database/migrations/2026_06_09_000003_create_tracking_activity_samples_table.php`
- `database/migrations/2026_06_09_000004_create_monitoring_settings_table.php`
- `database/seeders/MonitoringSeeder.php`
- `resources/js/Pages/Monitoring/`
- `tests/Feature/DesktopApiTest.php`

Some tracked files have additional local monitoring hunks layered on top of
the released attendance commit, including `app/Models/User.php`,
`config/access.php`, `config/filesystems.php`, `database/seeders/DatabaseSeeder.php`,
`routes/api.php`, and `routes/web.php`. Preserve those hunks unless Jawad
explicitly decides to discard or redesign the monitoring experiment.

## Production Deployment 2026-06-10/11 (Claude Session)

Commit `0ffdab0` (desktop shift clock, drawer, client switching, developer
panel — full suite) was pushed to `origin/jawad` with Jawad's explicit
approval and deployed:

- Hostinger auto-deploy pulled `0ffdab0` into BOTH site folders.
- Discovery: there are TWO deployment folders. The REAL production (working
  DB, 54 users) is `~/domains/lightseagreen-scorpion-756540.hostingersite.com/
  public_html`. `~/domains/timetracker.sparkingasia.com/public_html` is the
  custom-domain folder and had a broken `.env` (wrong DB credentials) — its
  DB-backed pages were failing while /login still rendered 200.
- Deployed on lightseagreen: DB backup (`~/db-backup-2026-06-10-1845.sql`,
  4.2MB) + uploads tar, `composer install --no-dev`, `php artisan migrate
  --force` (only `2026_06_11_000002_relax_auto_pause_default` was pending —
  everything else was already applied), `optimize`. Verified users=54,
  auto-pause=5.
- Repaired sparkingasia folder: backed up its `.env`, synced `APP_KEY` +
  `DB_*` from the working env server-side (secrets never displayed),
  composer install, optimize. Verified DB-OK users=54. Both domains now
  serve the same app + database.
- Installer `Timetracker Desktop Setup 0.1.0.exe` (80MB) built locally
  (Windows Developer Mode enabled fixed the NSIS symlink failure) and
  uploaded to `storage/app/desktop-installers/` in BOTH folders; the
  authenticated download page at `/desktop-downloads` serves it.
- SSH key auth for deploys was set up from Jawad's PC
  (`~/.ssh/id_ed25519`, key comment `claude-deploy@jawad-pc`, port 65002,
  host 31.170.164.232).
- Post-deploy checks: /login 200 on both domains; desktop API routes
  redirect unauthenticated as expected. Jawad still to do a browser pass
  (login, Settings, Timeline, Team, Developer, download button) on
  production.

## Production Incident + Recovery (2026-06-10, same evening)

Shortly after the deployment above, the lightseagreen temporary-domain
website was deleted in hPanel. Hostinger dropped its MySQL database/user
(`u406855808_timetracker`) with it — which BOTH folders used — taking the
whole app down (500 after login, web and CLI).

Recovery (completed the same evening):

- The pre-deploy backup `~/db-backup-2026-06-10-1845.sql` (4.2MB, taken ~20
  minutes before the deletion) contained everything. No data lost.
- Jawad created a fresh DB in hPanel: database `u406855808_timetracker`,
  user `u406855808_trackerspark` (password set 2026-06-10, lives only in the
  server `.env`; it was pasted in chat during recovery, so treat it as
  exposed and rotate when convenient).
- `.env` updated server-side, dump imported, caches rebuilt, lsphp workers
  killed. Verified: users=54, web login probe returns proper 422 for wrong
  credentials, /login 200.
- `timetracker.sparkingasia.com` is now the ONLY deployment (the dual-folder
  setup is gone — accidental but welcome consolidation).
- FOLLOW-UP for all desktop users: the app's server URL must be changed from
  the dead `lightseagreen-scorpion-756540.hostingersite.com` to
  `https://timetracker.sparkingasia.com` on the desktop login screen.
- Backups parked in `~` on the server: db-backup-2026-06-10-1845.sql,
  uploads-backup-2026-06-10-1845.tar.gz, plus two .env backups in the
  public_html folder.

## macOS Desktop Build (prepared 2026-06-11; to be run on Jawad's spare Mac)

Everything is pre-wired from the Windows side. A Claude Code session running
ON THE MAC should follow these steps exactly.

Prompt for that session:

> Read documents/CODEX_COMPLETE_CHAT_AND_PROJECT_HANDOFF.md section "macOS
> Desktop Build". Build, test, and upload the macOS desktop app per those
> steps. Do not change product code unless a build error requires it.

Steps:

1. Prerequisites on the Mac: Xcode Command Line Tools (`xcode-select
   --install`), Node 20+, git.
2. `git clone https://github.com/jawadislam92/timetracker.git && cd
   timetracker && git checkout jawad` (or pull if already cloned).
3. `cd desktop && npm ci`
4. `npm run rebuild` (compiles better-sqlite3 + uiohook-napi for mac).
5. `npm run dev` first — log in against
   `https://timetracker.sparkingasia.com`, start a session, and approve the
   two macOS permission prompts (System Settings -> Privacy & Security):
   - Screen Recording (screenshots + window titles)
   - Accessibility (keyboard/mouse activity counts)
   Verify: timer runs, screenshot appears in web Timeline, activity % > 0,
   pause-on-idle works, tray + drawer render. On macOS `active-win` returns
   browser URLs natively, so url_domain SHOULD populate — verify in the
   Timeline Apps & URLs tab and note the result in this doc.
6. `npm run dist:mac` — produces `desktop/dist-app/Timetracker
   Desktop-0.1.0-arm64.dmg` (unsigned: `mac.identity` is null on purpose).
7. Install from the DMG; first launch needs right-click -> Open (unsigned
   Gatekeeper flow). Re-verify tracking works from the installed app.
8. Upload to the server (port 65002):
   `scp -P 65002 "dist-app/Timetracker Desktop-0.1.0-arm64.dmg" \
   u406855808@31.170.164.232:domains/timetracker.sparkingasia.com/public_html/storage/app/desktop-installers/`
   (password auth; Jawad has it. Or use hPanel File Manager.)
   The web /desktop-downloads page detects the file automatically — the
   accepted filenames are listed in DesktopDownloadController::MAC_INSTALLERS.
9. Verify the macOS card on https://timetracker.sparkingasia.com/desktop-downloads
   shows the download and the sha256.

### macOS build run results (2026-06-11, Jawad's spare Mac, arm64)

Dev-run verification passed: timer runs, screenshots reach the web
Timeline, activity % > 0, apps captured, pause-on-idle works (after the
fix below), auto-resume works, stopping a session creates the Work Diary
row.

- **URL capture: WORKS on macOS, but needs a third permission.** active-win
  fetches the browser URL via an Apple Event to Chrome/Safari, which
  requires the per-browser **Automation** permission (System Settings ->
  Privacy & Security -> Automation -> [app] -> Google Chrome). Until it is
  granted the request is silently denied and `url_domain` stays null even
  though `active_app` populates. Once granted, `url_domain` populated
  immediately (verified end to end in the web Timeline). So macOS needs
  THREE permissions: Screen Recording, Accessibility, Automation.
- **Bug found and fixed (commit f675efa, NOT pushed yet): auto-pause never
  triggered.** The pause check compared `snap.idle_seconds`, which is
  clamped to the ~10s sample interval, against the multi-minute
  `auto_pause_minutes` threshold, so it could never fire. Fixed to use the
  raw system idle clock (same source the idle warning already uses).
  Verified: pause at 5 min idle, auto-resume on activity.
- Electron's postinstall did not extract the mac binary correctly under
  `npm ci` here (missing `path.txt` / incomplete dist). Fix: delete
  `node_modules/electron/dist`, re-run `node node_modules/electron/install.js`;
  if extraction is still incomplete, unzip the cached
  `~/Library/Caches/electron/...zip` with `ditto` and write
  `path.txt` containing `Electron.app/Contents/MacOS/Electron`.
- **macOS permission prompts repeat forever unless the app is properly
  ad-hoc signed.** With `mac.identity: null`, electron-builder leaves only
  a raw linker signature (`Info.plist=not bound`, no sealed resources), so
  TCC cannot pin a stable identity and Accessibility/Screen Recording
  grants do not stick. Fix after every `npm run dist:mac`, before
  packaging/uploading:
  `codesign --force --deep --sign - "dist-app/mac-arm64/Timetracker Desktop.app"`
  then rebuild the DMG from the signed app (hdiutil with an /Applications
  symlink works). If a broken copy was already granted permissions, clear
  them with `tccutil reset Accessibility|ScreenCapture|AppleEvents
  com.spark.timetracker.desktop` and re-grant after relaunch. (Proper
  Developer ID signing makes this moot — see below.)
- UX notes from Jawad: the idle warning toast auto-dismisses after 10s
  (renderer behavior, by design); the big timer resets when switching
  clients because each client gets its own session (by design — "Today"
  total accumulates).

Signing/notarization (later, when product-ready): enroll in the Apple
Developer Program ($99/yr), set `mac.identity` to the Developer ID cert name,
`hardenedRuntime: true` plus an entitlements plist (allow-jit,
allow-unsigned-executable-memory, disable-library-validation for the native
modules), and add notarize credentials. Until then the right-click->Open
flow is the documented install path for the team.

## Scrin.io Monitoring Suite (Claude Session, 2026-06-10, Local Only)

A separate Claude Code session built a large scrin.io-parity monitoring suite
on 2026-06-10. All of it is local and uncommitted, layered on top of the
monitoring experiment above. It is verified locally (75 tests passing,
`npm run build` green, `npm run build:renderer` green, pint passing) but has
not been visually reviewed by Jawad at all widths. Preserve all of it.

Features and their primary files:

1. Settings page (scrin.io-style, Super Admin via `monitoring.settings`):
   - `app/Http/Controllers/SettingsController.php`
   - `resources/js/Pages/Settings/Index.jsx`
   - `database/migrations/2026_06_09_000006_extend_monitoring_settings_with_scrinio_fields.php`
   - `database/migrations/2026_06_09_000007_create_user_monitoring_settings_table.php`
   - `app/Models/UserMonitoringSetting.php` plus
     `MonitoringSetting::effectiveForUser()` per-user override resolution.
   - Team categories: screenshots/hr + blur, activity tracking, app/URL
     tracking, weekly time limit, auto-pause minutes, allow offline time,
     notify on screenshot, week starts on, currency symbol, desktop app
     settings. Per-user copy-then-edit overrides for most categories.
2. Desktop tracker honors effective settings (`/api/desktop/settings` returns
   the merged per-user payload; `desktop/main/trackerService.js` implements
   capture toggle, activity toggle, app/URL suppression, auto-pause on idle,
   weekly limit stop, screenshot notification, and an idle pre-pause warning).
3. Reports auto-population: stopping a desktop session upserts a `work_hours`
   row (`source` = `tracker`, linked by `tracking_session_id`,
   migration `2026_06_09_000008_add_tracking_session_link_to_work_hours.php`).
   Manual `work-hours/create` is blocked for Members unless the team
   `allow_offline_time` setting is on; Admin/Super Admin always allowed.
   Report rows show Auto/Manual badges.
4. Timeline page (`/timeline`, `resources/js/Pages/Timeline/Index.jsx`,
   `app/Http/Controllers/TimelineController.php`): month strip, day totals,
   24h ruler with active/idle bands, session cards with screenshot grid,
   Tasks vs Apps & URLs tabs, flag/delete screenshot actions, and a History
   of changes modal. New permission `timeline.view_others` gates other users.
5. Team pages (`/team`, `/team/apps`, `app/Http/Controllers/TeamController.php`,
   `resources/js/Pages/Team/Index.jsx`, `resources/js/Pages/Team/Apps.jsx`):
   live-now leaderboard and team-wide app/site usage with range filters.
6. Audit log (`tracking_audit_logs` table,
   `database/migrations/2026_06_10_000001_create_tracking_audit_logs_table.php`,
   `app/Models/TrackingAuditLog.php`) recording screenshot flag/unflag/delete
   with actor, reason, and old/new values.
7. Slack daily activity digest (`app/Services/ActivityDigestService.php`,
   `app/Console/Commands/SendDailyActivityDigest.php`, scheduled in
   `app/Console/Kernel.php` behind `SLACK_DAILY_DIGEST_ENABLED`, manual send
   button on the Team page). The locally configured webhook returned 404 on
   2026-06-10 and must be rotated before digests will deliver.
8. Desktop UI truth-fixes: real trailing-7-day week chart fed by
   `GET /api/desktop/sessions/week`, settings panel mirrors server-driven
   values, week bars update live during tracking.
9. Shared Inertia props: `flash.success`/`flash.error` and `teamSettings`
   (`allow_offline_time`, `currency_symbol`, `week_starts_on`) plus
   `auth.user.can_create_manual_work_hour` in
   `app/Http/Middleware/HandleInertiaRequests.php`.

New tests: `tests/Feature/TeamPageTest.php`, a week-summary test in
`tests/Feature/DesktopApiTest.php`. All migrations above were applied to the
local database only.

Also implemented on 2026-06-10 (same Claude session, local only):

- Screenshot retention enforcement: `monitoring:prune-screenshots` command
  (`app/Console/Commands/PruneTrackingScreenshots.php`) hard-deletes
  screenshot files and rows (including soft-deleted) older than
  `retention_days`, scheduled daily at 02:30 in `app/Console/Kernel.php`;
  supports `--days` and `--dry-run`. Tests in
  `tests/Feature/ScreenshotRetentionTest.php`.
- `week_starts_on` wired into week-boundary computations via
  `MonitoringSetting::weekStartDay()/weekEndDay()` in DashboardController,
  ClientController, UserController, TimeEntryController (TimelineController
  already honored it).

## Next Actions For 2026-06-11 (Jawad's Testing Feedback, 2026-06-10)

Work these in order before any new features. Items 1 and 2 are bugs Jawad
found while testing the monitoring suite.

1. URLs are not recorded in Apps & URLs views. Two suspected causes to
   investigate and fix together:
   - The team default for `app_url_tracking_enabled` is `false`, and the
     desktop tracker suppresses `active_app`/`url_domain` entirely when it is
     off. Turning it on in Settings is required, but the recording must also
     be verified end to end after enabling.
   - `active-win`'s `url` property is only populated on macOS. On Windows it
     never returns a URL, so `url_domain` will always be null even with the
     setting on. A Windows-compatible approach is needed: parse the browser
     window title, use Windows UI Automation to read the address bar, or a
     companion browser extension. Decide the approach with Jawad, then
     implement. `active_app` (the application name) should already work on
     Windows once the setting is on; verify that first.
2. Settings changes do not apply live to the running desktop app for each
   user. The tracker only refreshes settings at app boot and at session
   start. Fix: refresh effective settings periodically while running (for
   example with each heartbeat or every few minutes), apply changes to the
   live timers (screenshot cadence, activity sampling, auto-pause), and
   verify per-user overrides flow through `/api/desktop/settings` to the
   right user.
3. Jawad found other minor issues while testing and will report them one at
   a time in the next session. Start the session by asking him for the next
   issue on his list, fix it, verify, and repeat. Keep a running
   issue/resolution log in this section as they are resolved.
4. Then continue with the planned web-to-desktop protocol launch below.

### Resolution log

- 2026-06-11 — Item 2 (settings not applying live): FIXED locally.
  `desktop/main/trackerService.js` now re-fetches per-user effective settings
  every 120s while a session runs (`_refreshAndApplySettings`) and restarts
  the activity-sample and screenshot timers when their cadence/toggle changes;
  live-read settings (auto-pause, app/URL toggle, weekly limit, notify) apply
  on the next sample/heartbeat automatically. `desktop/main/ipc.js` also
  re-syncs settings every 120s while idle so the settings panel reflects admin
  changes without an app restart. Per-user overrides flow through
  `/api/desktop/settings` (`effectiveForUser`). Needs Jawad to verify by
  changing a setting on the web while a tracker runs.
- 2026-06-11 — Item 1 (URLs not recorded): PARTIALLY FIXED + DECISION NEEDED.
  - App-name capture now works on Windows once "App & URL tracking" is enabled
    in Settings: `desktop/main/activityService.js` `normaliseApp()` cleans the
    process name (e.g. chrome.exe -> Google Chrome). With the live-settings fix
    above, enabling the toggle takes effect within ~2 minutes, no restart.
  - URL capture: added a Windows-safe `domainFromTitle()` fallback that parses
    an explicit http(s):// URL out of the window title (correct when present,
    no guessing from bare domains/emails). This rarely fires on Windows because
    `active-win` only fills `url` on macOS and Chrome/Edge titles do not contain
    the URL by default.
  - DECISION (2026-06-11): Jawad chose (C) app-only on Windows for now;
    revisit URLs later. Options A/B retained below for when it returns.
    (A) Browser extension that posts the active tab URL to a local endpoint —
        most reliable, cross-browser, but needs install per machine.
    (B) Native Windows UI Automation to read the address bar — no extension,
        but a heavy native dependency and fragile across browser updates.
    (C) Accept app-only tracking on Windows for now; revisit URLs later.

### Parked desktop UX improvements (suggested 2026-06-11, do later)

Picked up after the testing pass returns. None are bugs; all are polish/UX
that will make the tracker feel like a finished product.

1. Default `auto_pause_minutes` is currently 1 (aggressive). Change the team
   default to 5 minutes to match Scrin's behaviour; users can still override.
2. Idle-time recovery prompt on resume: "You were idle X minutes. Keep that
   time, or discard?" Mirrors Scrin and improves accuracy.
3. "Start similar to" shortcut: keep the user's last 3 client+task combos as
   one-click chips above the desktop start form.
4. Tray icon menu (Start/Stop/Open) so the user does not need to focus the
   window to switch state.
5. Login screen polish — current screen is very plain.
6. Per-client weekly target hours with a visual bar on the desktop Today
   panel so each user sees if they are on pace.
7. Smooth out the active/idle bands on the Timeline hour ruler (currently
   6-minute slots; consider hover tooltip with timestamps).
8. Currency symbol from Settings should render in the Report's cost column
   once hourly rates exist.
9. Weekly heatmap view on Timeline (7 days at a glance).
10. Mobile visual audit of all new pages — never done at <768px.

- 2026-06-11 — Local environment seeded for browser testing. The local
  `time_tracker` database had zero users/clients (all real data lives on the
  Hostinger staging the desktop app points at). Created a local Super Admin
  (`jawad@timetracker.test`; password given to Jawad in chat, never stored
  here) and ran `DemoDataSeeder` (3 demo members, 6 clients, 4 profiles,
  36 work entries, attendance history; demo password printed by the seeder).
- 2026-06-11 — Team default `auto_pause_minutes` bumped 1 -> 5 via migration
  `2026_06_11_000002_relax_auto_pause_default.php` (only when still at the old
  default) and the model default updated. Parked item #1 done.
- 2026-06-11 — Web-to-desktop launch (`timetracker://`) IMPLEMENTED locally
  (code complete; end-to-end verification requires the packaged installer,
  which is blocked on Windows Developer Mode):
  - `desktop/main/main.js`: single-instance lock, protocol registration
    (dev-mode best effort on Windows; clean via installer), `second-instance`/
    `open-url` handling, deep-link parsing (`timetracker://start?client_id=X`
    -> renderer `deeplink` event; queued until renderer ready).
  - `desktop/package.json`: electron-builder `build.protocols` entry so NSIS
    registers the scheme permanently.
  - Preload exposes `tt.deeplink.onOpen`; `Tracker.jsx` pre-fills client /
    work type / note from the link. Never auto-starts tracking.
  - Web: "Open desktop tracker" button on the Timeline footer navigates to
    `timetracker://open` with a blur-detection fallback that offers the
    existing `/desktop-downloads` page when the app is not installed.

- 2026-06-11 — Desktop round 4: day-total orb, clock icon, switch-while-
  running, and Clock In/Out + Breaks integration: IMPLEMENTED locally.
  - Orb now always shows TODAY'S TOTAL tracked time (saved sessions + live),
    so stopping a session no longer "resets" the big number; label switches
    today/tracking/paused. Proper clock SVG replaces the old "○" glyph.
  - Client switching works while tracking: Quick-start chips stay visible
    during a session (label changes to "Switch to"; current client disabled)
    and Today rows stay clickable — clicking stops the running session
    (saved) and immediately starts the clicked client with its last work
    type/description. Idle clicks now also start immediately instead of just
    pre-filling.
  - Attendance clock integrated into the desktop app: new Shift bar under
    the hero with Clock In / Clock Out / Start Break / End Break and a
    Working / On break / Clocked out status. Backend:
    `app/Support/TimeClockRules.php` (single source of the transition rules,
    now also used by the web TimeEntryController),
    `app/Http/Controllers/Api/Desktop/TimeClockController.php`,
    routes GET/POST `/api/desktop/time-clock`. Buttons enable/disable from
    the server's `available` list; 422 messages surface in the app.
  - Latent bug found and fixed in BOTH web and desktop time clock:
    "last action" lookups ordered by `action_timestamp` only, which is
    ambiguous for same-second actions; added `id` desc tiebreaker.
  - Sequence feature test added (clock-in -> break -> blocked clock-out ->
    break-end -> clock-out). 91/91 tests, renderer build clean, pint clean.

- 2026-06-11 — Desktop drawer redesign + local preferences + tray (Jawad
  feedback round 3, comparing side-by-side with scrin.io): IMPLEMENTED locally.
  - Settings is now a full-height right-side drawer with slide-in animation
    and dimmed overlay (matches scrin's interaction feel): brand header,
    "Visit Website" link (opens system browser), tracking-for-myself row,
    Preferences, read-only Team settings summary, Log out + version footer.
  - Working local preferences (per machine, electron-store `prefs`):
    - Launch on system startup — real `app.setLoginItemSettings` integration.
    - Auto-start tracking on launch — restores the last client/work type/note
      (persisted to localStorage on every start) and starts automatically.
    - Show screenshot notifications — local override; falls back to the
      admin's `notify_on_screenshot` when unset.
    - Show idle time notifications — gates the pre-pause warning toast.
    - Minimize to tray — new `desktop/main/tray.js` (runtime-drawn purple-dot
      icon, no asset needed; Open/Quit menu; click restores). Minimizing
      hides the window when enabled.
  - Team settings summary mirrors scrin: screenshots/hr, auto-pause, weekly
    limit, offline time, activity tracking, app tracking.
  - Window minimums lowered to 400x560 and the 760px breakpoint already
    stacks the layout, so the app now works at narrow widths.
  - NOTE for Jawad's screenshot: the old checkbox panel he compared was the
    pre-redesign build — the app must be restarted to load these changes.
  - Parked: custom keyboard shortcuts (Start/Stop, Show/Hide) and
    "screenshot primary monitor only" toggle (capture is already
    primary-only). 90/90 tests, renderer build clean.

- 2026-06-11 — Desktop start-form UX overhaul (Jawad feedback round 2):
  IMPLEMENTED locally.
  - Searchable dark client picker (`ClientPicker` in
    `desktop/renderer/src/views/Tracker.jsx`): type-ahead filter, keyboard
    navigation (arrows/enter/escape), shows the attached profile per row.
    Replaces the native white `<select>` that was unusable with 1500+ clients.
  - Work-type `<select>` replaced with segmented Tracker/Manual pills.
  - Quick-start chips: new `GET /api/desktop/sessions/recent-clients`
    endpoint (unique clients from the user's last 14 days, newest first,
    max 6, with last work type + last note). Chips render above the start
    form when idle; one click pre-fills client + work type + last
    description. Parked item #3 ("start similar to") satisfied by this.
  - Today rows now lead with the client name; description moved into the
    chip row (italic note chip). Running pill shows "Client — note".
  - Test added: recent-clients uniqueness/order/no-leak. 90/90 passing,
    renderer build clean, pint clean.

- 2026-06-11 — Developer page added (Jawad request: "a developer page where I
  can change things easily"): IMPLEMENTED locally.
  - `app/Http/Controllers/DeveloperController.php` +
    `resources/js/Pages/Developer/Index.jsx`, routes `/developer`,
    `/developer/run`, `/developer/logs`. Super Admin only — authorisation is
    enforced inside the controller (no grantable permission, intentionally).
  - Sections: System info (env, debug, URLs, PHP/Laravel versions, DB,
    cache/session/queue drivers, config/routes cached flags, web + desktop
    build timestamps, git branch/commit/dirty count), Health checks (DB ping,
    cache round-trip, public + screenshots disks writable, Slack webhook
    configured, pending migrations), Scheduled jobs status, and a Logs tail
    (last 300 lines of the newest laravel log).
  - Actions are a fixed whitelist (never arbitrary input): optimize,
    optimize:clear (with the "breaks tests until cleared" warning), migrate
    (local env only), Slack webhook test message, activity digest preview
    (builds the text, sends nothing), screenshot retention dry-run. Output is
    shown in a terminal-style panel on the page.
  - Nav: "Developer" appears in the avatar dropdown (desktop) and the mobile
    menu, only for Super Admins.
  - 6 feature tests in `tests/Feature/DeveloperPageTest.php` (403 for member
    and admin, page loads for super admin, unknown action rejected, digest
    preview produces output, prune dry-run safe, logs endpoint shape).
    89/89 tests passing; npm run build clean; pint clean.

- 2026-06-11 — Upwork profile not picked up by desktop + Individual settings
  editors missing (Jawad testing): FIXED locally.
  - Upwork profile root cause: clients link their profile via the newer
    `client_upwork_profile` many-to-many pivot. `clients.upwork_profile_id`
    is NULL on production rows. The desktop `MetaController::clients` and
    `SessionController::start` only read the legacy `belongsTo` column, so
    the desktop's Tracker chip showed "Not attached" and auto-created
    work_hours had no tracker name. Both endpoints now load `upworkProfiles`
    (pivot) and fall back to its first entry when the legacy column is null.
    Verified by 2 new tests in `tests/Feature/DesktopApiTest.php`.
  - Settings page Individual settings: the toggles only enabled/disabled
    inheritance — there was no per-user editor, so admins could not actually
    change a user's value. `IndividualSettings` rewritten in
    `resources/js/Pages/Settings/Index.jsx` to expand an editor row below
    each user when their override is on. Screenshots, Activity Level,
    App & URL, Weekly limit, Auto-pause, Offline time, Notify, and Desktop
    app sections now expose per-user value controls.
  - Verified: 83/83 tests pass (was 81), npm run build clean, pint clean.

- 2026-06-11 — Pause-on-idle + rich Today rows + click-to-resume + polish
  (Jawad testing): FIXED locally.
  - `desktop/main/trackerService.js` now implements real pause/resume instead
    of stop-on-idle. Active time is tracked via `frozen_seconds` and
    `last_change_at_ms`; `_pauseSession` freezes the timer and stops
    screenshots, `_resumeSession` unfreezes and reschedules captures.
    `_sampleActivity` auto-resumes when keyboard/mouse input returns or system
    idle drops under 5s. `status()` now reports `paused`, `frozen_seconds`,
    and `last_change_at` so the renderer ticks smoothly without polling.
  - `_currentSeconds()` excludes pause periods, so heartbeats, weekly-limit
    checks, and the work_hour sync all report active-only time.
  - Bug found while editing: `totalTodaySeconds` double-counted the active
    session (sum of saved totals + liveSeconds). Fixed.
  - Today rows now show description, client chip, work-type chip, tracker
    chip, and a Live/Paused chip on the active row. Clicking a row when idle
    pre-fills the picker (client + work_type + description) so switching
    between clients is one click.
  - `/api/desktop/sessions/today` now returns `upwork_profile_name` for the
    tracker chip.
  - Polish: orb shows "Live" / "Paused — resumes when you return" status pill
    with a pulsing dot when live; paused state uses muted purple; today rows
    are larger, have hover affordance when resumable, and use coloured chips.
  - Verified: 80/80 PHP tests pass, desktop renderer build clean, pint clean.

- 2026-06-11 — Work type & description fixes (Jawad testing): FIXED locally.
  - Desktop start form now lets the user choose the per-entry Upwork work type
    (Tracker/Manual for a tracker_manual client; Fixed / Outside Upwork for
    those client types) via a selector in `desktop/renderer/src/views/Tracker.jsx`.
    The choice is sent to `/api/desktop/sessions/start` and stored on the
    session, then carried onto the auto-created work_hour.
  - Description is now required in the desktop start form (start button
    disabled until non-empty; web Work Diary already required it).
  - `tracker_manual` is never stored as a per-entry work type:
    `SessionController::normaliseWorkType()` maps it to `tracker` on both
    session start and work_hour sync. The user's explicit choice now takes
    priority over the client's engagement type (this reversed the old
    "derive from client" behaviour; the corresponding test was updated).
  - Migration `2026_06_11_000001_normalise_tracker_manual_work_type.php`
    rewrites existing `work_hours.work_type` and `tracking_sessions.work_type`
    of `tracker_manual` to `tracker` so older rows edit cleanly in Work Diary
    and Report. Applied to the local DB only.
  - Tests added in `tests/Feature/DesktopApiTest.php` (user choice wins,
    tracker_manual normalisation on start and on work_hour sync). 80 passing.

- 2026-06-10 - Desktop installer build: DONE locally after Claude handoff.
  - `npm.cmd run rebuild` succeeded after Electron processes were closed.
  - First `npm.cmd run dist` attempt failed while extracting `winCodeSign`
    because Windows could not create symlinks in
    `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign`.
  - `desktop/package.json` now sets `build.win.signAndEditExecutable` to
    `false` for this local handoff build. This avoids the broken signing-tool
    extraction path. The generated installer is unsigned and uses the default
    Electron icon because no app icon is configured yet.
  - Successful artifact:
    `C:\laragon\www\timetracker\desktop\dist-app\Timetracker Desktop Setup 0.1.0.exe`
    (83,730,286 bytes, SHA256
    `B3662C9C0D137211E561711CB1C6F6AB7B41151BD98F583B25A944B312D3CBE7`).
  - Unpacked app also exists at
    `C:\laragon\www\timetracker\desktop\dist-app\win-unpacked\Timetracker Desktop.exe`.
  - Nothing was committed, pushed, or deployed.

- 2026-06-10 - Desktop app download section: ADDED locally.
  - Authenticated users can open `/desktop-downloads` from the main nav
    (`Desktop App`) and download the Windows installer if present.
  - Download route:
    `GET /desktop-downloads/windows` (`desktop-downloads.windows`).
  - `DesktopDownloadController` looks first in
    `storage/app/desktop-installers/Timetracker Desktop Setup 0.1.0.exe`,
    then falls back to
    `desktop/dist-app/Timetracker Desktop Setup 0.1.0.exe` for local builds.
  - macOS appears on the page as pending. A real Mac `.dmg`/`.pkg` must be
    built on macOS, signed/notarized, then wired into the controller before
    company Mac rollout.
  - Do not commit large installer binaries accidentally; upload them to the
    server storage path or attach them to a release artifact intentionally.

Next planned item (agreed with Jawad on 2026-06-10, scheduled for 2026-06-11):

- Launch the desktop tracker from the web interface via a custom
  `timetracker://` URL protocol. Scope:
  1. Electron main process: `app.setAsDefaultProtocolClient('timetracker')`,
     single-instance lock (`requestSingleInstanceLock`), handle
     `second-instance` argv to focus the window and parse the URL.
  2. `desktop/package.json` electron-builder `build.protocols` entry so the
     NSIS installer registers the protocol permanently.
  3. Web: "Open desktop tracker" button on Timeline and Dashboard that
     navigates to `timetracker://open`, with a timeout fallback offering a
     download link when the protocol is not handled.
  4. Optional: `timetracker://start?client_id=X` pre-selects the client in
     the desktop start form (never auto-starts tracking).
  5. DONE LOCALLY on 2026-06-10: produced the first packaged installer with
     `npm.cmd run dist` in `desktop/`. Use it to test the protocol flow end to
     end after the protocol handlers/buttons are implemented; dev-mode
     protocol registration on Windows is unreliable.
  6. No web-to-desktop credential handoff in v1; the desktop app keeps its
     own Sanctum login.

Known follow-ups for this suite: weekly heatmap view, currency symbol
rendering, mobile visual audit of the new pages, and the production release
decision (nothing committed or pushed).

Paused/resume point on 2026-06-09:

- Jawad reported that production verification for attendance release `349e67e`
  is done.
- Manual attendance audit history is implemented locally, verified locally,
  and not committed or pushed.
- `npm.cmd run build` regenerated `public/build` assets. Because the local
  monitoring experiment exists in the workspace, generated build chunks may
  include monitoring pages. Do not stage build assets blindly.
- `php artisan migrate` was run locally for browser verification. It applied
  the local monitoring migrations and the new audit-history migration to the
  local database only.
- The desktop monitoring run flow was improved locally after the original
  two-window instructions. The active desktop app path is
  `C:\laragon\www\timetracker\desktop`. It now has
  `desktop\scripts\start-dev.ps1`, `npm run dev:setup`, `npm run dev:fast`,
  a cleaned `desktop\README.md`, fixed desktop UI encoding artifacts, and a
  desktop-local `postcss.config.cjs` so renderer builds do not inherit the
  Laravel Tailwind pipeline.
- The desktop tracker start form was simplified locally to only ask for Client
  and Description. Work type and tracker/profile are attached to each client
  in the web app and are now derived from the selected client by the desktop
  UI and by the backend `/api/desktop/sessions/start` endpoint.
- The desktop tracker UI was redesigned locally in a scrin.io-inspired style:
  compact top header, circular timer, week chart, large start/stop pill,
  Today list, status footer, and slide-out settings panel. The app now loads
  `/api/desktop/sessions/today` through Electron IPC for the Today list.
  `php artisan test tests\Feature\DesktopApiTest.php` passed after this
  change. The final `npm.cmd run build:renderer` verification was not rerun
  after the redesign because the escalation/usage system rejected the build
  command; run it before approval or push.
- Resume later today with "Improve Attendance Slack Controls" unless Jawad
  changes priority.

## Conversation-Wide Requirements And Decisions

This section records the durable product decisions made across the full
conversation.

### Product And Design

- This is an internal, industry-style time-tracking and operations application,
  not a marketing site.
- Page layouts, typography, filters, buttons, spacing, tables, and empty states
  should be visually consistent across Dashboard, Users, Clients, Profiles,
  Attendance, Report, and Work Diary.
- Dense operational layouts are preferred over oversized cards and decorative
  landing-page patterns.
- Searchable multi-select filters should allow individual selections to be
  removed without clearing all filters.
- Tables and menus must not be clipped by scroll containers or overflow the
  viewport.
- Mobile and tablet behavior must be checked after meaningful frontend changes.
- Broken avatars must fall back to initials, and production avatar delivery
  must work without exposing private application files.
- Portfolio functionality is unnecessary and must remain removed.

### Roles And Permissions

- Supported roles are Super Admin, Admin, and Member.
- HR is not a dedicated role for now.
- Super Admin has full access.
- Admin and Member accounts can receive granular permissions.
- Manual attendance marking requires Super Admin or
  `attendance.manual_mark`.
- Members should not receive team-management access unless explicitly granted.
- A Super Admin must not accidentally demote their own account.

### Work Diary And Reports

- Work Diary remains the personal employee-entry area.
- Report is the management/team reporting area.
- Report filters should support users, clients, work types, trackers/profiles,
  shifts, and selected date ranges.
- Planned report summaries include by user, client, work type, tracker/profile,
  user by client, and user by work type.
- User total hours should appear once per person, not repeat on every detail
  row.
- CSV export remains available according to permission.

### Slack

- Slack uses an incoming webhook stored only in `.env`.
- Manual work-hour reports use a selected date range, selected users, and
  configurable columns.
- Work-hour Slack output uses a readable table-style format.
- Per-user total hours should be shown once.
- Users such as executives or managers who do not track time can be excluded
  by default using `include_in_slack_reports`.
- Automatic weekly work-hour reports run Sunday at 10:00 AM in
  `Asia/Karachi`.
- Attendance can also be sent to Slack with configurable attendance columns.
- Any webhook pasted into chat is considered exposed and must be rotated.

### Attendance

- Attendance uses a monthly spreadsheet-style employee-by-day grid.
- Statuses are Present, Absent, Holiday, Leave, Half day, Work from home, Late
  coming, Late joining, and Public holiday.
- Planned individual absence is Leave.
- Absent remains the automatic status when there is no clock-in and no approved
  manual status.
- Late coming (`LC`) is based on first clock-in after shift start plus grace,
  and counts in both Present and Late coming totals.
- Late joining (`LI`) is based on dates before the employee joining date and
  does not count as Present or Absent.
- Half day remains manual until expected working hours are configured.
- Each user can have a different shift start and grace period.
- Each user can have an optional joining date. If joining date is 2026-06-06,
  then 2026-06-01 through 2026-06-05 are `LI`; 2026-06-06 onward follows the
  normal Present, Absent, Holiday, Late coming, and manual rules.
- Clock-in at the grace boundary is Present; one minute later is Late coming.
- On the current day, an employee is not marked Absent until their configured
  shift start plus grace period has passed.
- A current-day employee without a configured shift remains pending because
  the system cannot fairly determine an absence deadline.
- Overnight activity belongs to the date the shift started.
- Bulk attendance calendar changes can target the company or selected users
  across a date range.
- Manual attendance needs a future audit history showing old value, new value,
  actor, timestamp, and reason.

### Screenshot Monitoring

- Screenshot monitoring is a future project and is not part of the released
  attendance feature.
- Browser-only screenshot monitoring is not sufficient; a transparent desktop
  application will eventually be required.
- Tauri or Electron are possible implementation choices.
- Tracking should happen only after the employee starts a session and must be
  visibly active.
- Do not record keystroke contents, webcam, microphone, or personal files.
- Capture intervals, retention, storage cost, permissions, privacy policy, and
  deletion/flagging workflow must be decided before implementation.
- The current local monitoring experiment was intentionally excluded from
  commit `349e67e`.

### Deployment And Workflow

- New feature work stays local until Jawad reviews it.
- Do not commit, push, deploy, or alter production unless explicitly requested.
- Never discard unrelated local changes.
- GitHub branch `jawad` is used by Hostinger and may trigger deployment.
- Production `.env` remains server-only.
- Back up the database and uploaded files before migrations or deployment.
- Production migration history may not perfectly match the schema; inspect
  before repairing it.

## Recently Implemented Attendance Behavior

### Monthly Grid

- One employee per row and one day per column.
- Status codes:
  - `P`: Present
  - `A`: Absent
  - `H`: Holiday
  - `L`: Leave
  - `HD`: Half day
  - `WFH`: Work from home
  - `LI`: Late joining
  - `PH`: Public holiday
- Summary totals are displayed per employee.
- Manual status editing uses a popover rather than a native table select.
- Future dates are not marked absent.

### Manual Attendance Permission

Manual attendance marking is allowed when:

- The user is `super_admin`, or
- The user has `attendance.manual_mark`.

Relevant files:

- `config/access.php`
- `app/Models/User.php`
- `app/Http/Controllers/EmployeeAttendanceController.php`
- `resources/js/Pages/EmployeeAttendance.jsx`

### Shift Start And Grace Period

Each user can have:

- `shift_start_time`
- `shift_grace_minutes`

The first clock-in is:

- Present when it is at or before `shift start + grace`.
- Late (`LI`) when it is after `shift start + grace`.
- Present, without automatic late evaluation, when no shift start is set.

Relevant files:

- `database/migrations/2026_06_08_000005_add_shift_timing_to_users_table.php`
- `app/Models/User.php`
- `app/Http/Controllers/UserController.php`
- `resources/js/Components/Users/UserForm.jsx`
- `resources/js/Pages/UsersList.jsx`
- `app/Http/Controllers/EmployeeAttendanceController.php`
- `app/Services/AttendanceSlackReportService.php`

## Last Verification Result

Completed successfully on 2026-06-09:

```text
php artisan test
66 tests passed, 202 assertions

npm.cmd run build
Build passed

Scoped vendor\bin\pint --test
Passed for all attendance-release PHP files

git diff --check
Passed

Staged secret scan
Passed
```

Browser checks also confirmed:

- Attendance page loads without console errors.
- Monthly attendance grid renders.
- The old native select visual problem is removed from grid cells.
- User edit page shows Shift start time and Grace period.
- User edit page does not produce a 500 error.
- Shift start and grace values persist through the user update endpoint.
- Automatic `P` and `LI` values display correctly against dummy clock-ins.
- Manual status overrides replace calculated values and update summary totals.
- Clearing a manual override restores the automatic value.
- Desktop and tablet attendance layouts remain within the viewport.
- Mobile attendance tabs use a two-by-two grid and no longer widen the page
  beyond the viewport.
- Attendance cell menus render above the table scroll container, flip upward
  near the bottom edge, remain inside mobile viewports, and close on outside
  click, scrolling, resizing, or Escape.
- Attendance Calendar popup supports company or selected-user date ranges,
  affected person-day preview, replacement, and removal.
- Overnight shifts keep post-midnight actions with the date the shift started.
- Active overnight sessions remain visible in today's entries and summary.
- Current-day employees remain pending until their shift start plus grace has
  passed; the grid and Slack do not count them absent early.

Because later sessions may change files, these results are historical and must
be rerun before approval or deployment.

## Next Steps

Work through these in order unless Jawad changes the priority.

### Current Release And Production Plan

Attendance release status:

1. Attendance release testing completed.
2. Monitoring implementation excluded from the release.
3. Attendance release committed as `349e67e`.
4. Branch `jawad` pushed to GitHub.
5. Production deployment and database migration were reported completed by
   Jawad in chat on 2026-06-09. A new Codex session should still confirm
   production state before making deployment assumptions.

Before treating the release as live:

1. Confirm Hostinger deployed commit `349e67e`.
2. Back up the production database and `storage/app/public`.
3. SSH to `~/domains/timetracker.sparkingasia.com/public_html`.
4. Run `php artisan migrate --force`.
5. Run `php artisan optimize:clear` and `php artisan optimize`.
6. Check login, Attendance, Users, Report, Work Diary, Slack configuration,
   avatars, permissions, and mobile layout on production.
7. If migration fails, stop and inspect the production `migrations` table and
   actual schema before changing anything.

Do not automatically commit, push, or deploy future work. The GitHub `jawad`
branch may be connected to Hostinger auto-deployment.

Recommended starting point for the next Codex chat:

> Read `documents/CODEX_COMPLETE_CHAT_AND_PROJECT_HANDOFF.md` first. Inspect Git status
> and preserve the local monitoring experiment. First verify whether attendance
> release `349e67e` is deployed and migrated in production. For new development,
> start with manual attendance audit history, keep changes local, and verify
> each feature before any later push.

### 1. User Acceptance Test The Current Attendance Work

Status: Completed technically on 2026-06-09. Ready for Jawad's visual review.

Test these scenarios in the browser:

1. Set different shift starts such as 08:00, 12:00, 16:00, and 00:00.
2. Set grace periods of 0, 5, 10, and 15 minutes.
3. Confirm clock-in exactly at the grace limit remains `P`.
4. Confirm clock-in one minute after the grace limit becomes `LC`.
5. Confirm a user without a shift start is not automatically marked late.
6. Confirm a user with joining date 2026-06-06 shows `LI` for 2026-06-01
   through 2026-06-05 and normal statuses from 2026-06-06 onward.
7. Confirm a previous attendance cell can still be manually edited.
8. Confirm a manual status overrides the calculated status.
9. Confirm an unauthorized Member cannot manually edit attendance.
10. Confirm the Slack attendance summary matches the grid.
11. Check the grid at desktop and smaller browser widths.

Do not push after testing. Record defects here or fix them locally.

Test result:

- Backend persistence for shift time and grace is covered by an automated test.
- Grace-boundary calculations are covered by automated tests.
- Manual override and automatic restore were verified in the browser.
- Unauthorized manual marking and Slack/grid late-count consistency are
  covered by feature tests.
- Responsive checks were completed at 1280px, 768px, and 390px widths.
- A mobile overflow caused by the four attendance tabs was found and fixed.
- Local dummy user Ayesha Khan is set to a 09:00 shift with a 10-minute grace
  period so `P` and `LI` examples remain visible for review.

### 2. Complete Attendance Rules

Status: Core rules implemented.

Confirmed on 2026-06-09:

- A time-based late arrival is now `LC`, and contributes to both Present and
  Late coming totals.
- `LI` is reserved for dates before `users.joining_date`; it does not count as
  Present or Absent.
- Half day remains manual until expected daily hours or shift duration is
  configured.
- Planned individual absence is stored as Leave.
- Overnight activity belongs to the date the shift started.

Local update on 2026-06-10:

- User create/edit now has a Joining date field, and the Users list displays
  it when present.
- Previous attendance cells remain editable through the manual status popup;
  manual marks still override automatic `LC`, `LI`, `P`, `A`, `H`, and other
  calculated statuses.
- Attendance Slack columns now separate Late coming and Late joining.

Current overnight rule:

- A post-midnight action belongs to the previous shift date when it occurs
  within 12 hours of that shift's configured start time.
- Ongoing sessions can span midnight for up to 18 hours, preventing stale
  forgotten clock-ins from accumulating indefinitely.

Still to decide later:

- Whether expected daily hours should be configurable so Half day can become
  automatic.
- Whether recurring weekly off-days should be configured per user/team rather
  than scheduled as calendar ranges.

Recommended implementation after decisions:

- Add configurable expected shift duration.
- Add overnight shift handling.
- Add company/team holiday settings.
- Keep manual override available for exceptional cases.

### Bulk Attendance Calendar

Status: Implemented and included in GitHub commit `349e67e`.

Add an Attendance Calendar popup for authorized users with:

- Start date and end date.
- Scope: whole company or selected users.
- Status: Holiday, Public holiday, Leave, Work from home, and other approved
  statuses.
- Optional note/reason.
- Preview showing affected people and dates before applying.
- Bulk creation of manual attendance marks.
- Ability to remove or replace a previously scheduled range.
- Affected person-day preview before applying.
- Maximum range of 366 days.

This should use the existing `attendance.manual_mark` permission rather than
reintroducing an HR role. A future HR account can be an Admin or Member with
that permission.

Implemented status choices:

- Leave
- Holiday
- Public holiday
- Work from home
- Half day

`Absent` remains the automatic result when a person has no clock-in and no
approved status.

Important removal behavior:

- Removing a range deletes all manual attendance marks for the selected people
  and dates, including individual corrections in that range.
- The popup warns the user before this action.
- A future audit-history feature should provide more granular event-level
  removal if needed.

### 3. Add Manual Attendance Audit History

Status: Implemented locally on 2026-06-09. Not committed or pushed.

Manual marks identify who set the current value, and a complete change history
is now recorded locally.

The audit table contains:

- employee
- attendance date
- old status
- new status
- changed by
- changed at
- optional reason

Added a small history view accessible only to Super Admin or users with
`attendance.manual_mark`.

Implemented files:

- `app/Models/ManualAttendanceAudit.php`
- `database/migrations/2026_06_09_000005_create_manual_attendance_audits_table.php`
- `app/Http/Controllers/EmployeeAttendanceController.php`
- `routes/web.php`
- `resources/js/Pages/EmployeeAttendance.jsx`
- `tests/Feature/EmployeeAttendanceTest.php`

Local verification completed:

- `php artisan test tests\Feature\EmployeeAttendanceTest.php`
- `php artisan test`
- `npm.cmd run build`
- `vendor\bin\pint --test app\Http\Controllers\EmployeeAttendanceController.php app\Models\ManualAttendanceAudit.php database\migrations\2026_06_09_000005_create_manual_attendance_audits_table.php tests\Feature\EmployeeAttendanceTest.php routes\web.php`
- `git diff --check`
- Browser check of the Attendance audit dialog at desktop width and 390px
  mobile width.

Local database note:

- `php artisan migrate` was run locally to verify the browser UI. Because the
  local monitoring migration files were already present, Laravel also applied
  the local-only monitoring tables before applying the audit table.

Next agenda item after this local audit feature is attendance Slack controls.

### 4. Improve Attendance Slack Controls

Status: First version implemented; refinement pending.

Possible improvements:

- Save default attendance columns.
- Save default attendance users using `include_in_slack_reports`.
- Add a concise attendance totals row.
- Add preview before sending.
- Add an automatic monthly or weekly attendance schedule only after the report
  format is approved.
- Ensure zero-hour executives/managers can remain excluded by default.

### 5. Improve Work-Hour Reports

Status: Planned.

Add report views using the same filters:

- Detailed entries
- By user
- By client
- By work type
- By tracker/profile
- User by client
- User by work type

Fix user totals so a person's total is shown once, not repeated on every
detail row.

Recommended web layout:

- Summary tabs above the detail table.
- Grouped user headers or a separate totals table.
- Shared searchable multi-select filters across all report tabs.

Recommended Slack layout:

- User totals table first.
- Optional detail table after it.
- Do not repeat the same user total on each detail row.

### 6. Continue Visual And Responsive Audit

Status: Ongoing.

Review these pages individually:

- Dashboard
- Users
- Clients
- Upwork Profiles
- Attendance
- Report
- Work Diary
- User create/edit
- Client create/edit

Check:

- Header wrapping and navigation crowding.
- Text/background contrast.
- Table overflow and horizontal scrolling.
- Consistent page width, spacing, headings, filters, and buttons.
- Empty, loading, success, and error states.
- Mobile and tablet layouts.
- Broken avatar fallback behavior.

### 7. Screenshot Monitoring

Status: Future project, not ready to implement.

Do not attempt desktop screenshot capture from the website. A separate,
transparent desktop tracker will be needed later, probably with Tauri or
Electron.

Before implementation, decide:

- Capture interval and whether it is fixed or randomized.
- Screenshot retention period.
- Storage provider and cost limits.
- Who can view screenshots.
- Employee privacy policy and deletion/flagging workflow.
- Whether manual time remains allowed.

See `FEATURE_ROADMAP_ATTENDANCE_REPORTS_MONITORING.md` for the proposed data
model and phased direction.

## Known Production Cautions

### Never Reuse Exposed Slack Webhooks

A Slack webhook was previously pasted into chat. It should be considered
exposed and rotated in Slack before production use. Store the replacement only
in the production `.env`:

```env
SLACK_REPORT_WEBHOOK_URL=
SLACK_WEEKLY_REPORT_ENABLED=true
SLACK_REPORT_TIMEZONE=Asia/Karachi
```

After editing production `.env`, run:

```bash
php artisan optimize:clear
php artisan optimize
```

### Production Migration History

The production database previously reported a duplicate `clients.work_type`
column while running an older migration. This means the production schema and
Laravel migration history may not be fully aligned.

Before the next deployment:

1. Back up the production database and `storage/app/public`.
2. Inspect the production `migrations` table.
3. Compare it with the actual database columns.
4. Do not repeatedly run a failing migration.
5. Repair the migration history carefully before applying the new attendance
   migrations.

Do not change production migration records without first verifying the actual
schema and obtaining Jawad's approval.

### Hostinger Deployment

The project is deployed to:

```bash
~/domains/timetracker.sparkingasia.com/public_html
```

Detailed instructions are in `PRODUCTION_DEPLOYMENT.md`.

Do not deploy until:

- Jawad explicitly requests it.
- Current work is approved locally.
- A database and uploads backup exists.
- The full verification checklist passes.
- Production migration history is understood.

## Local Development

Typical commands:

```powershell
php artisan serve --host=127.0.0.1 --port=8000
npm.cmd run dev -- --host 127.0.0.1 --port 5175
```

If dependencies are missing:

```powershell
composer install
npm.cmd ci
```

Local database changes:

```powershell
php artisan migrate
```

Never store a local or production password in this document. The local test
administrator email may be `admin@example.com`, but credentials should be
obtained from Jawad or safely reset in the local database when necessary.

## Verification Checklist

Run before asking Jawad to approve a release:

```powershell
php artisan optimize:clear
php artisan test
npm.cmd run build
vendor\bin\pint --test
git diff --check
git status --short
```

Also perform browser checks:

- Login works.
- No 500 pages.
- No console errors on changed pages.
- Forms save and display validation errors correctly.
- Role and permission restrictions work.
- Attendance totals and Slack totals agree.
- Desktop and smaller widths have no overlapping text or controls.

Only after Jawad explicitly asks for a push:

1. Review the complete diff.
2. Confirm no secret is included.
3. Stage only intended files.
4. Commit with a clear message.
5. Push the requested branch.
6. Do not deploy unless deployment was also explicitly requested.

## Supporting Documents

- `README.md`: setup, features, security, and general deployment.
- `APP_IMPROVEMENT_PLAN.md`: original UI/access/Slack improvement plan.
- `FEATURE_ROADMAP_ATTENDANCE_REPORTS_MONITORING.md`: detailed attendance,
  reporting, and screenshot-monitoring roadmap.
- `SLACK_INTEGRATION.md`: work-hour Slack report behavior and scheduler.
- `PRODUCTION_DEPLOYMENT.md`: Hostinger/cPanel production instructions.
- `SECURITY.md`: security guidance.

When these documents conflict, use this handoff document for workflow and
current status, then verify the code before making a product assumption.
