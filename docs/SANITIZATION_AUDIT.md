# SA Track — Site Sanitization / Security Audit

> A living record of full-site security & correctness sweeps: what was checked, what was
> found, what was fixed, and — importantly — **what was NOT checked**, so the next pass can
> pick up where this one left off. Append a new dated section each time you re-run it.

---

## Pass 1 — 2026-07-03

**Auditor:** Claude (Opus 4.8) · **Scope:** whole app — Laravel 12 backend (`app/`, `routes/`,
`config/`), Inertia/React frontend (`resources/js/`), and the Electron desktop tracker
(`desktop/`). **Method:** targeted pattern greps + reads of every high-risk surface, plus the
dependency scanners. (A parallel multi-agent pass was attempted but hit a transient server
rate-limit, so this pass was done directly.)

**Overall verdict: the codebase is well-secured.** Authorization, input handling, secrets, and
the desktop IPC surface are all sound. The only real issues were **dependency CVEs**; the
web-side ones are fixed in this pass.

### How to re-run this audit (copy/paste)

```bash
# from C:/laragon/www/timetracker  (php = C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe)

# 1. Dependency CVEs
php C:\laragon\bin\composer\composer.phar audit           # web PHP deps
npm audit --omit=dev                                      # web JS deps
cd desktop && npm audit --omit=dev && cd ..               # desktop deps

# 2. Injection / mass-assignment / XSS pattern scan
#    (Grep tool; all should be parameterized / framework-generated)
#    DB::raw|whereRaw|selectRaw|orderByRaw|DB::statement          -> app/
#    ::create($request->all)|->update($request->all)|->fill(      -> app/Http/Controllers
#    dangerouslySetInnerHTML|v-html|innerHTML=                    -> resources/js
#    catch (...) {}  (empty)                                      -> app/
#    env(  (should only appear in config/)                        -> app/

# 3. Secrets / config
git ls-files | grep -E '(^|/)\.env$'                      # must be empty
ssh <prod> 'grep -E "^APP_ENV|^APP_DEBUG" .env'           # production / false

# 4. Tests
php artisan test                                          # full suite green
```

### Coverage & results

| # | Area | How checked | Result |
|---|------|-------------|--------|
| 1 | **Authorization / IDOR** | Read `routes/web.php` + `routes/auth.php`; `MonitoringController`, `UserController`, `TeamController`, `EmployeeAttendanceController`, `Api/Desktop/*` | ✅ Secure. Every admin/data route behind `permission:*` middleware in an `auth,verified` group. `MonitoringController` scopes non-privileged users to `where('user_id', $user->id)` and gates cross-user views/deletes with `monitoring.view` / `.view_screenshots` / `.delete_screenshots`. No IDOR found. |
| 2 | **SQL injection** | Grep all `DB::raw`/`whereRaw`/`selectRaw`/`DB::statement` | ✅ Safe. All parameterized (`?` bindings) or use **fixed-literal** columns. `TeamController:337 selectRaw("$column …")` — `$column` is only ever `'active_app'`/`'url_domain'` (closure args), never user input. |
| 3 | **Mass assignment** | Grep `::create($request->all())` / `->update($request->all())` / `->fill(` | ✅ None. Controllers use Form Requests / `validated()` / explicit fields. |
| 4 | **Secrets & config** | `git ls-files` for `.env`; `.gitignore`; `env(` usage in `app/`; prod `.env` | ✅ No `.env` committed; `.env*` gitignored; **no `env()` calls in `app/`** (config-cache safe); prod is `APP_ENV=production`, `APP_DEBUG=false`. |
| 5 | **Sensitive data → browser** | `HandleInertiaRequests::share()` + auth prop | ✅ `auth.user` exposes id/name/email/role/avatar/designation/permissions only — no password hash or token. |
| 6 | **XSS (frontend)** | Grep `dangerouslySetInnerHTML` in `resources/js` | ✅ Only `Pagination.jsx` (×3), rendering **framework-generated** Laravel paginator labels (`« Previous`, page numbers) — not user input. Safe. |
| 7 | **CSRF / cookies** | `app/Http/Kernel.php` web group | ✅ `VerifyCsrfToken` + `EncryptCookies` active on `web`; Inertia sends the XSRF token. Desktop API is tokened (no CSRF needed, correct). |
| 8 | **Auth throttling** | `routes/auth.php`, desktop route group | ✅ Login + password-reset + verification are `throttle:6,1`; the desktop shared-token endpoint is `throttle:12,1`. |
| 9 | **Desktop token auth / lockout** | `Api/Desktop/AuthController`, `EnsureUserIsActive`, `UserController` | ✅ Deactivated accounts can't obtain a token and their tokens are revoked immediately on deactivation; `EnsureUserIsActive` gates requests. |
| 10 | **File upload (screenshots)** | `Api/Desktop/ScreenshotController` | ✅ `validated()` Form Request → stored with a **generated** filename (`His_uniqid.ext`, not client name) on a **private** disk served only through the authed controller. No path traversal, no public execution. |
| 11 | **Desktop IPC surface** | `desktop/preload/preload.js`, `main/main.js` webPreferences | ✅ `contextIsolation: true`, `nodeIntegration: false`, and a curated `contextBridge` allowlist of `ipcRenderer.invoke` channels — no raw ipc/node exposed to the renderer. |
| 12 | **Time / tracking integrity** | This session's work (see `sa-track-tracker-double-start` memory) | ✅ The double-start race → time inflation was root-caused and fixed in desktop **0.4.2**; a server-side clamp (`total_seconds ≤ elapsed`) is the permanent backstop; inflated history was repaired. |
| 13 | **Dependencies (PHP)** | `composer audit` | ⚠️→✅ **Fixed this pass** (see Findings F1). |
| 14 | **Dependencies (JS)** | `npm audit --omit=dev` (web + desktop) | Web: ✅ 0 vulns. Desktop: ⚠️ 11 (5 moderate, 6 high) — **deferred** (see F2). |

### Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| **F1** | Medium | Web PHP deps: `guzzlehttp/guzzle < 7.12.1` (cookie-domain match `GHSA-cwxw-98qj-8qjx`; HTTPS→cleartext proxy downgrade `CVE-2026-55568`) and `guzzlehttp/psr7 < 2.12.1` (CRLF injection `CVE-2026-55766`). | **✅ FIXED locally** — updated to guzzle 7.13.1 / psr7 2.12.3; `composer audit` now clean; 243 tests pass. **Prod not yet patched** (see below). |
| **F2** | Moderate/High | Desktop `node_modules`: 11 vulns (5 moderate, 6 high) reported by `npm audit`. Bundled into the installed app; **not a web-facing surface**. | **DEFERRED** — needs `cd desktop && npm audit fix`, careful review (some fixes are `--force` = major bumps that could break `better-sqlite3`/`uiohook-napi`/`jimp`), a self-test run, and its own 0.4.x release. |
| **L1** | Low | `SESSION_SECURE_COOKIE` not explicitly set; site is HTTPS-only. | Recommend `SESSION_SECURE_COOKIE=true` in prod `.env`. |
| **L2** | Low | Desktop `webPreferences.sandbox: false`. | Optional hardening: try `sandbox: true` (verify native modules still load). |
| **L3** | Low | `ScreenshotController` trusts the client file extension (`getClientOriginalExtension()`). Mitigated by the private disk (never executed). | Optional: add `mimes:jpg,jpeg,png` to the screenshot Form Request. |

### Fixed in this pass
- **F1** — guzzle → 7.13.1, psr7 → 2.12.3 (`composer.lock` updated). Verified: `composer audit` clean, full test suite green.

### NOT checked / out of scope this pass (do next time)
- **Exhaustive N+1 / performance profiling** of *every* endpoint. Verified the known hotspots (Timeline `screenshotInput` now O(n); team-month cached), but did not profile the full route list under load.
- **Deep timezone re-verification across every page.** The tz system was audited/rebuilt in earlier work (per-worker `work_timezone`, `useFormatters`); not re-exercised end-to-end here.
- **Business-logic fuzzing** of auto-close / still-working / Slack edge cases beyond what this session already covered.
- **Prod infrastructure** (Hostinger web-server config, TLS settings, file permissions, backups) — not in the codebase, not reviewed.
- **The `F2` desktop dependency upgrades** — identified but not applied (needs a release cycle).
- **Full accessibility / a11y audit** — not a security concern; skipped.

### To finish F1 on production (auto-deploy does NOT run `composer install`)
```bash
git push origin jawad         # ships composer.lock
ssh <prod> 'cd ~/domains/timetracker.sparkingasia.com/public_html && \
  composer install --no-dev --optimize-autoloader && php artisan optimize:clear'
```

---

## Pass 2 — 2026-07-04 (close-out of the Pass 1 findings)

**Auditor:** Claude (Opus 4.8) · **Goal:** finish every deferred / low item from Pass 1 and
run a live leakage sweep, so the app can enter a full employee-testing phase with nothing
security-related left open.

### Live leakage sweep (production)
Probed the running site directly — all good:

| Probe | Result |
|-------|--------|
| `GET /.env` | **403** (not exposed) |
| `GET /.git/config` | **403** |
| `GET /composer.json` | **403** |
| `GET /storage/app/private/screenshots/` | **403** (private disk, not listable) |
| Session cookie flags | **`secure; httponly; samesite=lax`** already set |
| `APP_ENV` / `APP_DEBUG` (prod) | `production` / `false` |
| CSP header | `upgrade-insecure-requests` present |

### Disposition of every Pass 1 finding

| ID | Pass 1 status | Pass 2 outcome |
|----|---------------|----------------|
| **F1** (guzzle/psr7 CVEs) | Fixed locally, prod pending | ✅ **DEPLOYED to prod.** `composer install --no-dev` run over SSH; **`composer audit` on prod now returns "No security vulnerability advisories found."** |
| **F2** (desktop `npm audit`: 11 vulns) | Deferred | ✅ **Assessed & consciously deferred.** `npm audit fix` (non-breaking) resolves **none** of them — every remaining fix needs `npm audit fix --force`, i.e. a **breaking major bump of a core capture library**: `jimp` 0.22→1.6 (screenshot processing), `active-win` 8→7.7.2 (window-title capture, a downgrade), `uuid` 10→14. Real-world exposure is low: `form-data` uses fixed field names, the app uses `uuid` **v4 without a buffer** (the advisory is v3/v5/v6-with-buffer only), and `tar`/`node-pre-gyp` are **build-time only**, not shipped runtime paths. Forcing these right before a testing freeze would risk breaking capture on an app that can't be GUI-verified here. **Left on stable 0.4.2; the major bumps belong in their own dedicated, tested desktop release.** |
| **L1** (`SESSION_SECURE_COOKIE` unset) | Recommend setting | ◑ **Behaviour already correct** — the live session cookie is already `secure` (Laravel auto-marks cookies secure over HTTPS). Making it explicit (`SESSION_SECURE_COOKIE=true`) is documented in `.env.example`; applying it to the **prod `.env`** is a one-line production config change left for an explicit go-ahead (auto-mode correctly blocks unattended prod `.env` writes). Not fixing a real exposure — hardening only. |
| **L2** (desktop `sandbox: false`) | Optional | ◑ **Deferred with rationale.** The core renderer protections are already in place (`contextIsolation: true`, `nodeIntegration: false`, curated `contextBridge` allowlist). Flipping `sandbox: true` cannot be GUI-verified in this environment and a bad flip would block **all** tracking; it belongs in the same dedicated desktop release as F2, where the packaged app can be launch-tested. |
| **L3** (screenshot mime validation) | Optional | ✅ **Already satisfied.** `UploadScreenshotRequest` already enforces `image`, `mimes:jpeg,jpg,png,webp`, and `max:8192`. The Pass 1 note referred to the stored *filename* extension, which is moot because the file content is validated and the disk is private/never executed. |

### Docs shipped this pass
- **`README.md`** — refreshed (desktop app + current features; corrected the deploy section to
  match how the host actually deploys).
- **`docs/ARCHITECTURE.md`** — new plain-English "what it does / how it works / **where the
  database and data live**" explainer (answers the "where is the database" question directly).
- **Help knowledge base** — added "Using SA Track on a shared computer" and "What SA Track
  records — and who can see it," plus an auto-update note; re-seeded (idempotent).

### Net state
The **web/server side is fully hardened and deployed** (no known CVEs on prod, no leaked files,
secure cookies, debug off). The only open items are **desktop-side hardening** (F2/L2) that
require a separately-testable desktop release, and one **optional** explicit `.env` line (L1) —
none of which block or affect employee testing.

