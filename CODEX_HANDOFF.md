# Codex Project Handoff

Last updated: 2026-06-09

This is the canonical starting document for any new Codex session or account
working on the Sparking Asia Time Tracker.

## Instructions For A New Codex Session

Use this prompt:

> Read `CODEX_HANDOFF.md` completely before making changes. Then inspect the
> current Git status and the files named in the relevant section. Preserve all
> existing work. Do not commit, push, deploy, or change production data unless
> I explicitly ask. Continue with the first incomplete item under "Next Steps",
> but ask before implementing any product decision marked "Decision Needed".

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
  `edf4ae0 Fix attendance time and avatar display`
- Local URL: `http://127.0.0.1:8000`
- Production URL: `https://timetracker.sparkingasia.com`
- Production host: Hostinger shared hosting
- Portfolio functionality is intentionally removed and should not be restored.
- HR is not a role at present. Access should use Super Admin plus granular
  permissions assigned to Admin or Member accounts.

## Current Uncommitted Work

There is a substantial local working tree. A new session must run:

```powershell
git status --short
git diff --check
```

Do not treat generated `public/build` filename replacements as accidental.
They are expected after `npm.cmd run build`.

The current local work includes:

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

Important uncommitted/new files include:

- `app/Models/ManualAttendanceMark.php`
- `app/Services/AttendanceSlackReportService.php`
- `database/migrations/2026_06_08_000004_create_manual_attendance_marks_table.php`
- `database/migrations/2026_06_08_000005_add_shift_timing_to_users_table.php`
- `FEATURE_ROADMAP_ATTENDANCE_REPORTS_MONITORING.md`
- This document

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
53 tests passed, 148 assertions

npm.cmd run build
Build passed

vendor\bin\pint --test
Passed

git diff --check
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

Because later sessions may change files, these results are historical and must
be rerun before approval or deployment.

## Next Steps

Work through these in order unless Jawad changes the priority.

### Current Release Plan

Jawad confirmed this sequence on 2026-06-09:

1. Add manual attendance audit history.
2. Improve work-hour reports, including summaries by user, client, work type,
   and tracker/profile.
3. Fix report user totals so each person's total appears once rather than on
   every detail row.
4. Complete the visual and responsive review of the release pages.
5. Separate or exclude unfinished screenshot-monitoring work from the
   attendance/report release.
6. Run the complete automated, browser, migration, security, and deployment
   checks.
7. Show Jawad the final local result and obtain explicit approval.
8. Only then commit and push the approved files to GitHub.
9. Deploy to Hostinger only after a separate explicit production approval and
   after backups are confirmed.

Do not automatically commit, push, or deploy while implementing this plan.
The GitHub branch may be connected to Hostinger auto-deployment.

Recommended starting point for the next Codex chat:

> Read `CODEX_HANDOFF.md` first. Continue the Current Release Plan without
> pushing. Start with manual attendance audit history, preserve existing user
> changes, and verify the feature locally before moving to report summaries.

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

Status: Implemented locally.

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
