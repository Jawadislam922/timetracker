# Complete Codex Chat And Project Handoff

Last updated: 2026-06-09 after GitHub release commit `349e67e`

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

This `documents/` reorganization and the latest master handoff update were
created after commit `349e67e` and are currently local documentation changes.
Do not assume they are on GitHub until Git status and remote history confirm
that separately.

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
  `shift start + grace`.
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
  joining, and Public holiday.
- Planned individual absence is Leave.
- Absent remains the automatic status when there is no clock-in and no approved
  manual status.
- Late joining counts in both Present and Late totals.
- Half day remains manual until expected working hours are configured.
- Each user can have a different shift start and grace period.
- Clock-in at the grace boundary is Present; one minute later is Late.
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
5. Production deployment and database migration still require verification.

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
4. Confirm clock-in one minute after the grace limit becomes `LI`.
5. Confirm a user without a shift start is not automatically marked late.
6. Confirm a manual status overrides the calculated status.
7. Confirm an unauthorized Member cannot manually edit attendance.
8. Confirm the Slack attendance summary matches the grid.
9. Check the grid at desktop and smaller browser widths.

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

- A late day remains `LI`, but contributes to both Present and Late totals.
- Half day remains manual until expected daily hours or shift duration is
  configured.
- Planned individual absence is stored as Leave.
- Overnight activity belongs to the date the shift started.

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

Status: Not implemented.

Manual marks currently identify who set the current value, but a complete
change history is still needed.

Add an audit table containing:

- employee
- attendance date
- old status
- new status
- changed by
- changed at
- optional reason

Add a small history view accessible only with the appropriate permission.

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
