# Operations — deploying and running SA Track in production

> The runbook. Everything here was learned on the real host, usually the hard
> way; the "why" comments are the scar tissue. Replaces the old
> PRODUCTION_DEPLOYMENT.md and SLACK_INTEGRATION.md. Updated **2026-08-09**.

## The one-paragraph mental model

Production is Hostinger shared hosting. Pushing to the `jawad` branch makes
Hostinger pull the files into
`~/domains/timetracker.sparkingasia.com/public_html` within ~30–75 s — **files
only**: no composer install, no npm build, no migrations (`.cpanel.yml` exists
but is NOT executed; its contents are aspirational and its paths are wrong).
Everything else is done manually over SSH.

```
ssh -p 65002 u406855808@31.170.164.232
```

## Standard deploy

1. Build the frontend locally and **commit `public/build`** (the server never
   builds): `node node_modules/vite/bin/vite.js build`
2. Run the full test suite. Green or it does not ship.
3. `git push origin jawad`, wait for the pull (verify by **file content**, not
   just the commit hash — one `git checkout -f` deploy silently didn't stick).
4. If a migration shipped: `php artisan migrate --force` over SSH — it will
   never run itself.
5. Rebuild caches (the deploy wipes `bootstrap/cache`):
   `php artisan config:cache && php artisan route:cache && php artisan view:cache`
6. Verify live: curl `/login` and match the `app-*.js` content hash against the
   local build; smoke the routes you touched.

### Cache facts (tested 2026-08-09, believe this over older notes)

- `route:cache` **works on this app** — verified live: exit 0, all routes 200.
  An old handoff doc said closure routes make it 500 the site; whatever was
  true then is false now, and the claim cost real performance while believed.
- A scheduled self-heal rebuilds config and route caches within 5 minutes
  whenever a deploy wipes them (`config-cache-self-heal` in
  `app/Console/Kernel.php`).
- `php artisan optimize` did 500 the site in June 2026. The explicit trio in
  step 5 does the same work predictably — prefer it.

## Hostinger sharp edges (each one has bitten us)

- **hPanel cron breaks silently on shell metacharacters.** `&&` jobs never
  ran; `>` truncated its target to 0 bytes. The working crontab line is
  exactly: `/usr/bin/php /home/u406855808/domains/timetracker.sparkingasia.com/public_html/artisan schedule:run`
  — never add `&&`, `>`, `>>`, or `$()`. Backup trigger: `GET /cron/run/{token}`
  (token `SCHEDULER_HTTP_TOKEN`, throttled). Liveness: mtime of
  `storage/framework/schedule-heartbeat`.
- **The production `.env` has no trailing newline.** A blind `echo X >> .env`
  glues onto the last line and 500s the whole site ("The environment file is
  invalid!"). Append with `printf "\nKEY=val\n"` or use the Developer page's
  credentials editor (super-admin, whitelisted keys, write-only secrets).
- **Auto-deploy prunes untracked files in `public_html`** within minutes of a
  push. Anything that must survive lives outside the web tree
  (`~/desktop-installers/`) or on S3 (screenshots, avatars, installers).
- **The WAF answers before Laravel.** A plain-text `403 Forbidden` with no
  Laravel log line is the firewall, not the app. Known rules: a request body
  repeating a parameter named exactly `profile` (~10–40+ occurrences), and any
  body containing `<>`. Probe unauthenticated: WAF block = text 403, healthy =
  JSON 401.
- **MySQL intermittently refuses connections** (bursts of
  `SQLSTATE[HY000] 2002`). Host-side; see STATUS.md. The 500 page auto-retries
  once so users mostly self-heal.
- Auto-deploy can lag or leave detached HEAD. Emergency deploy: SSH,
  `git fetch origin jawad && git checkout -f <sha>`, then step 5, then verify
  by content.

## Desktop releases (Windows)

1. Bump `desktop/package.json` version (+ its `_comment_version` changelog).
2. `node node_modules/vite/bin/vite.js build` in `desktop/`, then
   `node node_modules/electron-builder/cli.js --win --x64`.
3. Verify the manifest: the base64 sha512 in `dist-app/latest.yml` **must**
   equal `openssl dgst -sha512 -binary <exe> | openssl base64 -A` — a mismatch
   silently rejects every update fleet-wide.
4. Upload the exe to S3 bucket `sparkingasia-timetracker-downloads`
   (ap-south-1, public via bucket policy — **no ACL**) using the server-side
   PHP `putObject`; Hostinger cannot stream 94 MB reliably (that caused the
   endless restart-at-62% loop).
5. Copy `latest.yml` to `~/desktop-installers/` **after** backing up the live
   one (`cp latest.yml latest.yml.<ver>.bak`).
6. **Never publish a `.blockmap`** — differential download loops on the host's
   CDN. The app also sets `disableDifferentialDownload` since 0.4.6.
7. Verify end-to-end: feed shows the new version; the exe URL 302s to S3; the
   blockmap URL 404s; S3-served bytes hash-match the manifest.
8. Installer rule: the NSIS force-close macro must **never** use
   `taskkill /T` — during auto-update the installer is a child of the app and
   `/T` can kill the installer itself mid-update (this uninstalled the entire
   fleet's app in July 2026). `/IM` alone is correct.

Rollback: `php artisan desktop:set-active-version <ver>` points the feed at an
archived manifest (`--list` shows what is available; floor is 0.3.0).

## Desktop releases (macOS — evergreen procedure)

Apple Silicon only, macOS 12+, Node 20+, Xcode CLT. On the Mac:
`cd desktop && npm install && npm run rebuild && npm run dist:mac` → DMG in
`desktop/dist-app/`. If dist fails on a symlink/privilege error:
`sudo xattr -dr com.apple.quarantine ~/Library/Caches/electron-builder`, retry.
The app is ad-hoc signed: first launch needs right-click → Open (or
`xattr -dr com.apple.quarantine "/Applications/SA Track.app"`), then grant
Screen Recording AND Accessibility (quit + relaunch after Screen Recording).
**No Mac auto-update** (needs real signing; $99/yr Apple account would enable
notarization + auto-update) — Mac users reinstall the DMG manually. Publish:
scp the DMG to `~/desktop-installers/`, then bump `MAC_VERSION` and the
`MAC_INSTALLERS` list in `DesktopDownloadController` and deploy.

## Slack

- Env keys (server `.env` only): `SLACK_REPORT_WEBHOOK_URL`,
  `SLACK_WEEKLY_REPORT_ENABLED`, `SLACK_REPORT_TIMEZONE` (default
  Asia/Karachi), plus the bot/channel keys in `config/services.php`.
- Weekly report: `reports:send-weekly-slack`, Sundays 10:00 in the configured
  timezone, covering the seven completed days ending Saturday; `--start/--end`
  for manual runs. Requires the scheduler cron.
- Manual "Send to Slack" on the Report page with selectable dimensions;
  gated by the "Send work-hour reports to Slack" permission.
- Hard limit: one table, ≤100 rows per message (header + total reserved; a
  notice appears when grouped rows are omitted).
- Clock events post as **one thread per person per day** (anchor =
  `slack_thread_ts` on the day's first clock-in); auto clock-outs join the
  same thread.

## Attendance automation (live jobs)

- `attendance:auto-clock-out` (*/30): closes forgotten days at shift end +
  buffer, 12 h hard cap backstop. **A quiet tracker must never trigger
  clock-out** — that rule was removed after it mis-closed a real person's day;
  do not re-add it.
- `attendance:still-working-check` (*/10): Slack DM with Yes/No at 8 h open;
  Yes snoozes 2 h, No clocks out; 6 nudges then auto-close. Buttons POST to
  `/api/slack/interact` (HMAC via `SLACK_SIGNING_SECRET`, replay guard).
  Tunables: `ATTENDANCE_PROMPT_AFTER_HOURS`, `--cap-hours`, `--max-prompts`,
  `--snooze-hours`; gates `ATTENDANCE_AUTO_CLOCKOUT`,
  `ATTENDANCE_STILL_WORKING_SLACK`.
- Multi-device: `users.allow_multiple_devices` (default false), single active
  session, last-device-wins.

## Golden rules

1. Nothing reaches prod without the full suite green and the built assets
   committed.
2. Deploy, then **verify live by content** — asset hash, a smoke curl of the
   routes you touched, and the caches rebuilt.
3. Never re-save a loaded `TimeEntry` model (timestamp re-serialization shifts
   times 5 h on this UTC MySQL server) — use query-builder `update()`.
4. When prod contradicts a document — including this one — test it, then fix
   the document.
