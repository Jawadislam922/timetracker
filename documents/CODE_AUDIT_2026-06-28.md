# Code Audit Report — Laravel/Inertia Time-Tracker

## Executive summary

Overall health is solid for a fast-moving internal tool: the architecture is coherent, tests exist, and recent migrations show the team converging on modern Laravel patterns. The recurring problems are not architectural — they cluster into four themes: (1) **route-level authorization gaps** where write endpoints sit behind read permissions or no permission at all; (2) **N+1 query patterns** in scheduled commands and paginated list controllers; (3) **copy-paste duplication** across paired controllers, services, and React Create/Edit pages; and (4) **timezone inconsistency**, where machine-local and hardcoded `Asia/Karachi` logic leaks into a system whose whole design is built around a configurable business timezone. Two genuine data-integrity gaps (missing foreign keys) and a cluster of fragile time-frozen tests (no `tearDown` to reset `Carbon::setTestNow()`) round out the must-fix list. None of these require a redesign — they are well-scoped, mostly mechanical fixes.

---

## Fix first (confirmed high-severity)

### Security / authorization

**1. Manual-status write endpoint guarded by view permission**
`routes/web.php:140` — `PATCH /employee-attendance/manual-status` uses `permission:attendance.view`. Anyone who can *view* attendance can *modify* it (privilege escalation). The controller has an internal `manual_mark` check today, but the route middleware contradicts the permission model in `config/access.php`.
**Fix:** change middleware to `permission:attendance.manual_mark`.

**2. Calendar update endpoint guarded by view permission**
`routes/web.php:141` — `POST /employee-attendance/calendar` has the same defect as #1. Also applies to the `getManualHistory` route on line 139.
**Fix:** `permission:attendance.manual_mark`.

**3. Monitoring sessions endpoint has no route permission**
`routes/web.php:226` — `GET /monitoring/sessions` has no permission middleware, despite `monitoring.view` existing in `config/access.php`. The sibling `showSession` route (227) enforces it. Internal code checks exist, but authorization belongs at the route layer for consistency.
**Fix:** add `->middleware('permission:monitoring.view')`.

### Data integrity (migrations)

**4. Missing FK on `attendance_clock_checks.clock_in_id`**
`database/migrations/2026_06_14_060000_create_attendance_clock_checks_table.php:19` — declared `unsignedBigInteger()->unique()` with no constraint to `time_entries`. Admin clock edits delete `TimeEntry` rows (`EmployeeAttendanceController:184`), leaving orphaned "zombie" clock-checks.
**Fix:** `$table->foreignId('clock_in_id')->unique()->constrained('time_entries')->cascadeOnDelete();`

**5. Missing FK on `work_hours.client_id`**
`database/migrations/2025_07_27_000002_create_work_hours_table.php:18` — indexed but unconstrained, while `user_id` on the same table is properly constrained. Deleting a client leaves orphaned work-hour rows.
**Fix:** `$table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();` (nullOnDelete is also defensible if you want to preserve hours after client deletion — pick per business rule).

### Performance (N+1 / redundant queries)

**6. `UserController` recomputes weekly hours per user**
`app/Http/Controllers/UserController.php:101` — `withSum()` already computes `weekly_hours_sum` (lines 89–92) for sorting, but the transform loop (101–118) discards it and calls `workHours()->sum('hours')` again per user. ~2× the queries on a 100-user page.
**Fix:** reuse the precomputed attribute: `$weeklyHours = (float) ($user->weekly_hours_sum ?? 0);` and drop the per-user `sum()`.

**7. `ClientController` N+1 on weekly hours**
`app/Http/Controllers/ClientController.php:37` — `workHours()->whereBetween()->sum()` per client in the transform loop; `workHours` is not eager-loaded. 50 extra queries per page.
**Fix:** one grouped query before the loop:
`$hoursByClientId = WorkHour::whereIn('client_id', $clients->pluck('id'))->whereBetween('date', [$startOfWeek, $endOfWeek])->groupBy('client_id')->selectRaw('client_id, SUM(hours) as h')->pluck('h','client_id');` then look up in-loop.

**8. `SilentTrackerCheck` — 2 queries per session**
`app/Console/Commands/SilentTrackerCheck.php:50` — for each active session, two separate `max(captured_at)` queries (screenshots + samples). 101 queries for 50 sessions; runs every 15 min.
**Fix:** single grouped query (or two `selectRaw('MAX(...)')...groupBy('tracking_session_id')` lookups) before the loop.

**9. `AutoCloseAttendance` — 3–4 queries per user**
`app/Console/Commands/AutoCloseAttendance.php:66` — per-user queries for most-recent `TimeEntry` (66–68), clock-in (77–80), `AttendanceClockCheck` (87), plus `lastTrackerSignal()` (130). 300–400+ queries for 100 users; runs every 30 min.
**Fix:** batch-load the latest entries/checks keyed by `user_id` before the loop (window function or `groupBy` in PHP).

**10. `StillWorkingCheck` — unfiltered user loop**
`app/Console/Commands/StillWorkingCheck.php:57` — iterates *all* users, calling `openClockIn()` (2 `TimeEntry` queries each) and `effectiveShiftFor()` (lazy-loads `shiftOverrides`, +1 query each) even for clocked-out users. (Reviewer flagged this as effectively medium-impact since it's a scheduled command — but the fix is cheap.)
**Fix:** pre-filter to users with an open clock-in via `whereExists` on `TimeEntry`; `User::with('shiftOverrides')`.

**11. `AttendanceCloser::close()` — redundant clock-in re-query**
`app/Services/AttendanceCloser.php:27` — when `$last->action_type === 'clock_in'`, the code fetches the same clock-in row again at lines 35–38. (Note: the original detail said this triggers "if `$last` is break_start" — that's inaccurate; the redundancy occurs when `$last` *is* the clock-in.)
**Fix:** reuse `$last` when it is already the clock-in instead of re-querying.

### Duplication (DRY)

**12. `calculateTimeStats()` duplicated across two controllers**
`app/Http/Controllers/EmployeeAttendanceController.php:798` is byte-for-byte identical to `TimeEntryController.php:754`. The helper `positiveMinutesBetween()` (952 / 823) is also duplicated.
**Fix:** extract to `App\Services\TimeStatisticsService` (or a trait) and call from both.

**13. Slack table-cell + `formatHours()` duplication**
`app/Services/SlackReportService.php:289` (`tableTextCell`), `:297` (`tableBoldCell`), `:327` (`formatHours`) are identical to `AttendanceSlackReportService` (345 / 353 / 368).
**Fix:** one shared `SlackTableFormatter`/`HoursFormatter` trait used by both services. (Combine with #12 into one "shared formatting/stats" PR.)

**14. `WorkHourCreate.jsx` / `WorkHourEdit.jsx` massive duplication**
`resources/js/Pages/WorkHourCreate.jsx:116` — ~400 shared lines: `validateClient`/`validateTracker`, the search/select/blur dropdown handlers, and the entire client/tracker JSX block are duplicated in `WorkHourEdit.jsx`. Beyond maintenance cost, the two have drifted (see bug #16).
**Fix:** extract a `useClientTrackerValidation` hook + `ClientTrackerDropdowns` component shared by both pages.

### Bugs

**15. `getTimeBasedGreeting()` uses machine timezone**
`resources/js/Utils/timeUtils.js:149` — `new Date().getHours()` reads the *viewer's* local clock, contradicting the app's business-timezone design (`datetime.js` / `useFormatters`). A California viewer at 2 AM sees "Good evening" for a Pakistan business.
**Fix:** pass the business timezone in and extract the hour via `toLocaleString(..., { timeZone })`.

**16. Edit form skips client work-type filtering**
`resources/js/Pages/WorkHourEdit.jsx:148` — Edit lacks `getFilteredClients()`; line 79 validates against *all* clients, so invalid client/work-type combinations can be saved through Edit but not Create. The backend `update()` also doesn't enforce work-type/client compatibility.
**Fix:** port `getFilteredClients()` into Edit (naturally resolved by the #14 shared-hook extraction) and add server-side compatibility validation in `update()`.

**17. Hours passed as route param, not body**
`resources/js/Pages/WorkHourCreate.jsx:205` — `form.post(route('work-hours.store', { hours: roundedTotal }))` puts `hours` in the URL query string; the server ignores it and recomputes from body `hours`+`minutes`. Data is currently correct *by luck*, but the code is misleading dead effort.
**Fix:** remove the route param (server recompute is fine), or send `roundedTotal` in the body intentionally. Low real risk — fix for clarity.

### Missing tests (Carbon time leakage)

**18–20. No `tearDown()` to reset `Carbon::setTestNow()`**
`tests/Feature/StillWorkingThresholdTest.php:20`, `tests/Feature/EmployeeAttendanceTest.php:20`, `tests/Feature/SlackReportTest.php:182` — all freeze time and rely on inline cleanup at the end of each test. If any assertion fails first, time stays frozen and leaks into later tests (intermittent pass/fail). Other tests in the suite (`AttendanceComprehensiveTest`, `AttendanceConsistencyTest`, `WorkTimezoneStage2Test`) already do this correctly.
**Fix:** add to each class:
```php
protected function tearDown(): void { Carbon::setTestNow(); parent::tearDown(); }
```

---

## Worth doing (medium-severity, grouped)

### Authorization / route guards (consistency)
- `routes/web.php:185` — `POST /ai-assistant/questions` (`saveQuestions`) has no permission while sibling AI routes require `ai.assistant`. Add it.
- `routes/web.php:157` — `Route::resource('work-hours')` has no permission middleware; `work_hours.manage_all` exists in config but is unapplied. Personal vs. others' entries likely bypass checks.
- `routes/web.php:159` — `work-hours/bulk-delete` unguarded; add `permission:work_hours.manage_all`.
- `routes/web.php:162` / `:174` — `time-entries` and `timeline` groups lack consistent guards (e.g. `team-activity`, `timeline/data`, `timeline/ai-summary`). Gate the cross-user data endpoints explicitly.
- `app/Http/Controllers/AiAssistantController.php:99` — `ask()` validates payload but never checks `ai.assistant` permission server-side. Add `abort_unless(...)` (matches `TimelineController::aiSummary`).
- `app/Http/Controllers/TimeEntryController.php:178` — `teamOverview()` builds a sensitive needs-attention list with no internal guard; relies entirely on caller. Add a defensive `abort_unless(dashboard.view_team)`.
- `app/Http/Requests/Desktop/StartSessionRequest.php:18` (+ Heartbeat/Stop) — authorize only checks `user() !== null`; session ownership is enforced later in the controller. Move ownership validation into the Request.
- `config/cors.php:22` — `allowed_origins`, `allowed_methods`, `allowed_headers` all `['*']`. Restrict to the real frontend origin and a concrete method/header list.
- `routes/api.php:39` — `POST /api/desktop/login` has no rate limiting. Add `throttle:6,1`.

### Timezone correctness
- `app/Console/Commands/*.php:16` — `Asia/Karachi` hardcoded as the fallback (and used directly in `Carbon::now('Asia/Karachi')`) across 7 files. Centralize in an `appTimezone()` helper so config changes propagate everywhere.
- `app/Console/Commands/AutoCloseAttendance.php:179` — `lastTrackerSignal()` forces `Asia/Karachi` while the caller uses `$user->workTimezone()`. Mixing timezones corrupts idle/active detection for VAs in other zones. Pass `$tz` through.
- `app/Models/TimeEntry.php:71` — `getFormattedAction{Time,Date,Timestamp}Attribute` hardcode `Asia/Karachi`, ignoring the display-timezone system. Use the configured display timezone.
- `app/Models/User.php:250` — previous-day spillover uses `12h`, but `AttendanceHours::dayInOfficeHours()` uses `18h` for stale detection. A 15h session buckets to the previous day but is excluded from hour totals. Define one `STALE_SESSION_MINUTES` constant.
- `app/Services/AttendanceClockNotifier.php:155` — `workedSuffix()` computes the worked-minutes diff on raw timestamps without the timezone conversion `message()` applies; off-by-one across DST/zone boundaries.

### Performance (medium)
- `app/Services/TrackingSessionService.php:70` — `UpworkProfile` looked up inside the `syncWorkHour()` loop; preload by id and key in memory.
- `resources/js/Pages/WorkHoursList.jsx:346` — `dailyGroups` rebuilt on every render (every keystroke). Wrap in `useMemo([filteredData])`.
- `resources/js/Pages/UsersList.jsx:122` — `activeFilterChips` `useMemo` depends on `roleOptions`/`designationOptions` rebuilt fresh each render, defeating memoization. Memoize the option maps.
- `resources/js/lib/chartConfig.js:70` — `getChartOptions` returns a new object each call, re-rendering Chart.js. Memoize at the call site.
- `resources/js/Components/AiChatWidget.jsx:43` — unbounded message history in state. Cap at ~100.

### Duplication / inconsistency (medium)
- `app/Services/ActivityDigestService.php:178` vs `WeeklyDigestService.php:154` — `'8h 00m'` vs `'8h 12m'` formatting differ. Share one `TimeFormatter`.
- `app/Console/Commands/SendWeeklySlackReport.php:18` — date-range parsing reimplemented in 3 commands. Extract `ReportDateRange::fromOptions()`.
- `app/Http/Controllers/ClientController.php:80` — `store()`/`update()` carry duplicated validation plus legacy `upwork_profile_id` alongside `upwork_profile_ids`. Drop the legacy path or document/deprecate it.
- `resources/js/Pages/ClientsList.jsx:82` / `WorkHoursReport.jsx:521` — timeout IDs stashed on `window`. Use `useRef`.
- `resources/js/Pages/Dashboard.jsx:45` — status→label mapping split between `statusFromAction()` and the table re-map (~675). One shared `statusMap`/helper.
- Test helpers: `AttendanceComprehensiveTest.php:31/42`, `AttendanceConsistencyTest`, `WeeklyDigestTest.php:17` define overlapping `clockIn()` / `makeEntry()` / `clock()` / `makeSession()` with divergent signatures. Consolidate into a shared test trait.

### Bugs (medium)
- `app/Http/Controllers/EmployeeAttendanceController.php:238` — `resolveMonthlyStatus` returns a null status for "shift not started today"; the `match()` summary silently drops it, so grid totals don't reconcile. Give it an explicit `NS` code and count it.
- `app/Services/WeeklyDigestService.php:157` — fragile `'8h 60m'` rounding. Normalize via `$total = round($hours*60); $h = intdiv($total,60); $m = $total%60;`.
- `app/Services/AttendanceSlackReportService.php:301` — an unclosed break at day-end leaves `$currentBreakStart` set and silently drops that span. Handle the dangling state after the loop.
- `app/Services/TrackingSessionService.php:117` — `diffInSeconds(..., false)` + `max(0,...)` can hide a negative-overlap invariant violation. Assert `overlapStart <= overlapEnd`.
- `app/Models/MonitoringSetting.php:148` — `require_active_window_metadata` is fillable + in `teamPayload()` but absent from `effectiveForUser()` override groups, so it can't be overridden per-user. Add the override group.
- `resources/js/Pages/WorkHourCreate.jsx:322` — `setTimeout(...,50)` validation chain races on rapid client switching; no cancellation. Validate synchronously or via `useEffect` with cleanup.
- `resources/js/Pages/WorkHoursReport.jsx:439` — totals (`totalHours`, unique users/clients) computed from the current page only, so they're wrong/misleading under pagination. Return aggregates from the backend or label "this page".
- `resources/js/Components/TimeDisplay.jsx:4` — no validation of `timestamp`; invalid input silently renders "Invalid Date". Guard with `isNaN(date.getTime())`.
- `resources/js/Components/TagInput.jsx:38` — index-based key; use `key={tag}` (dupes already filtered).
- `tests/Feature/EmployeeAttendanceTest.php:48` — `assertEquals(0.0, ...)` (loose) for floats; use `assertSame`/`assertEqualsWithDelta` per the rest of the suite.

### Tech debt / dead code / migrations (medium)
- `app/Http/Middleware/HandleInertiaRequests.php:77` (and 119, 147) — three `catch (\Throwable)` blocks swallow errors silently. Log at WARNING with `user_id` context so missing tables/config surface.
- `app/Http/Controllers/SettingsController.php:172` — `flagFieldFor()` maps `week_starts_on`/`currency` to `override_screenshots` while `valueFieldsFor()` returns empty arrays — dead/confusing path. Reject these categories upfront or add an explicit `no_override` field.
- `app/Models/Client.php:16` / `app/Models/UpworkProfile.php:25` — dual `upwork_profile_id` FK + many-to-many pivot can desync; `workHours()` joins on `name` (breaks on rename, null-prone). Plan a proper `upwork_profile_id` FK on `work_hours`.
- `app/Models/User.php:149` — `expandedPermissions()` rebuilds the array with spread each iteration (O(n²) space). Use `array_merge`.
- `app/Console/Commands/StillWorkingCheck.php:45` — `->distinct()->pluck('user_id')` without explicit `select('user_id')` is fragile across DB drivers. Add the select.
- `database/migrations` — mixed `->onDelete('cascade')` (2025) vs `->cascadeOnDelete()` (2026) styles; standardize. `2026_06_25_000004` adds the new minutes column before dropping the hours column without copying data — add a data-copy step. `2026_06_09_000006_set_testing_screenshot_intervals` is a test-only override that should not ship — move to a `local`-gated seeder. `2026_06_27_000002_fix_action_timestamp_on_update` (the 5h-corruption fix) has no audit of already-corrupted rows and no verification test — add both. `2025_08_02_000001_add_performance_indexes` duplicates the `(user_id, date)` composite added later in `2026_06_11_000001` — drop the redundant single-column indexes.
- `tests/Feature/ExampleTest.php:13` and `tests/Unit/ExampleTest.php:12` — placeholder tests; remove.
- `resources/js/Pages/UsersList.jsx:75` — bulk-update errors shown via `window.alert()` (leaks raw server message); use the existing toast pattern.

---

## Nice to have (low-severity, terse)

- `app/Http/Controllers/TimeEntryController.php:503` — unused `resolveDate()`; remove.
- `app/Http/Controllers/UserController.php:113` — `$user->role_label = $user->role_label;` no-op; remove (or compute it).
- `app/Services/TrackingSessionService.php:123` — redundant `max(1, ...)` given prior guard; drop or comment.
- `app/Services/AnthropicService.php:51` — verify default model id `claude-opus-4-8` is current/intended.
- `app/Services/AttendanceSlackReportService.php:180` — `emptySummary()` mutated by reference; consider a value object.
- `app/Models/User.php:43` — `permissions` stored as plain JSON; consider `encrypted:array`.
- `app/Support/AttendanceHours.php:63` — `isLateClockIn()` lacks edge-case tests (grace, overrides, null grace, timezones).
- `app/Models/TimeEntry.php:36` — Slack notify in `booted()` fails silently as a warning; consider queue+retry or surfacing to UI.
- `app/Models/ManualAttendanceAudit.php:12` — `UPDATED_AT` disabled but `CREATED_AT` kept alongside `changed_at`; document or simplify.
- `app/Console/Commands/SendWeeklySlackReport.php:12` — no validation of `--start`/`--end` before `Carbon::parse`; wrap with a friendly error.
- `app/Http/Middleware/PermissionMiddleware.php:15` — redundant `!$user` redirect (Authenticate should run first); document or remove.
- `app/Http/Middleware/HandleInertiaRequests.php:86` — cache keys unversioned; add a `.v1.` segment.
- `app/Console/Commands/CreateAdminUser.php:54` — 12-char min, no complexity; use `Password::min(12)->mixedCase()->numbers()->symbols()`.
- `config/workhours.php:1` — hardcoded employee names in `trackers`; derive from DB.
- `resources/js/Pages/WorkHoursList.jsx` / `WorkHoursReport.jsx:31` — duplicate `Toast` component and `formatDateLocal()`/`getDateRange()`; centralize.
- `resources/js/Pages/Dashboard.jsx:289` — `fmtH()`/`fmtSecs()` local; move to `Utils/formatters.js`.
- `resources/js/Components/Pagination.jsx:1` — mixes `React.useEffect` with destructured imports; tidy.
- `resources/js/lib/utils.js:1` — empty file; delete or stub.
- `resources/js/Components/ErrorBoundary.jsx:50` — `process.env.NODE_ENV` in a Vite app; use `import.meta.env.MODE`.
- `resources/js/Components/Users/UserForm.jsx:74` — `URL.createObjectURL` avatar preview never revoked; add cleanup `useEffect`.
- `resources/js/Components/Filters/SearchableMultiSelect.jsx:38` — add `containerRef` to deps for lint clarity.
- Migrations: hardcoded `where('id', 1)` singleton assumption (`2026_06_09_000006`), `dropConstrainedForeignId` vs `dropForeign` style mix (`2025_08_26_...`), inline enum comments (`2026_06_09_000001`), `down()` drop-order (`2026_06_08_000005`), confusing index migration name (`2026_06_11_000001`) — all cosmetic/consistency.
- Tests: `SlackReportTest:17` setup-without-teardown; `DeletionCascadeTest:18` over-creates records; `EmployeeAttendanceTest:165` repetitive assertions; `AccessControlTest:13` thin edge cases; `TimelineIdleSplitTest:35` hardcoded tz; `InputPatternTest:9` extends PHPUnit base instead of `Tests\TestCase`.

*Refuted on review (not issues, noted for the record):* the `calculateEmployeeStats`/grid-nesting concerns, the various screenshot/thumbnail/`flagScreenshot`/`monitoring.sessions.show` "missing permission" claims (those are guarded), the `dangerouslySetInnerHTML` XSS claim in Pagination, the duplicate-migration-timestamp claims, and the `tracking_session_id` missing-FK claim. No action needed.

---

## Suggested batches (safe, reviewable PRs)

**PR 1 — Authorization hardening (high + medium, security).** All `routes/web.php` permission corrections (#1–3, plus `saveQuestions`, work-hours resource/bulk-delete, time-entries/timeline groups), the `AiAssistantController::ask` and `teamOverview` server-side guards, the Desktop Request ownership checks, CORS tightening, and the desktop-login throttle. Pure middleware/guard changes — easy to review, high payoff. Add a feature test per corrected route.

**PR 2 — Data-integrity migrations (high).** New migrations adding the two missing foreign keys (#4, #5) with a pre-cleanup of existing orphans. Keep separate from app code so it can be reviewed and run (`migrate --force`) deliberately on prod per your deploy rules.

**PR 3 — Scheduled-command N+1 fixes (high + medium perf).** Batch-loading in `SilentTrackerCheck`, `AutoCloseAttendance`, `StillWorkingCheck`, `AttendanceCloser`, and `TrackingSessionService` (#8–11, +profile preload). Self-contained backend perf work; add assertions/`assertQueryCount`-style checks where practical.

**PR 4 — List-controller perf (high perf).** `UserController` and `ClientController` aggregate reuse (#6, #7). Small and isolated.

**PR 5 — Shared backend helpers (high + medium duplication).** Extract `TimeStatisticsService` (#12), Slack formatting trait (#13), `TimeFormatter` (digests), and `ReportDateRange`. One "DRY the services/controllers" PR.

**PR 6 — Timezone consolidation (high + medium).** `getTimeBasedGreeting` fix (#15), `appTimezone()` helper across the 7 commands, `AutoCloseAttendance::lastTrackerSignal` tz param, `TimeEntry` formatted accessors, the 12h/18h stale constant, and `AttendanceClockNotifier::workedSuffix`. Group because they share the same root cause and want one consistent helper.

**PR 7 — WorkHour form refactor (high duplication + bugs).** Extract the shared hook/component for Create/Edit (#14), which naturally fixes the Edit filtering bug (#16); clean up the route-param hours call (#17); add backend work-type/client validation in `update()`. Ship with a Cypress/manual check since it touches user-facing forms.

**PR 8 — Test isolation (high + medium tests).** Add `tearDown()` Carbon reset to the three classes (#18–20), consolidate the duplicated test helpers into a trait, fix the float-assertion, and delete the placeholder Example tests. Tests-only, zero production risk — good first merge to stabilize CI.

**PR 9 — Frontend polish (medium/low).** `useMemo`/`useRef` perf fixes, shared `Toast`/date utils/formatters, `window.alert`→toast, `TimeDisplay` guard, blob-URL cleanup, `ErrorBoundary` env check. Cosmetic-to-moderate, batched to avoid review churn.

**PR 10 — Migration hygiene & misc tech debt (medium/low).** Standardize FK syntax, fix the column-replace data-copy, remove/relocate the testing-interval migration, add the action-timestamp corruption audit + test, drop redundant indexes, log the silent Inertia catches, and the assorted low-severity dead-code removals. Lowest urgency; safe to trail the others.