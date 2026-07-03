# Dashboard "Tracked Work" Redesign — Approved Plan (2026-07-04)

Approved by Jawad (**Option A** on the mock: https://claude.ai/code/artifact/aaf78203-4deb-49b7-aec8-fd98c922b57d).

## The rule

**The dashboard measures tracked work. Attendance lives in Attendance.**
A tracked day is a **calendar day** — the same number on the Dashboard, the Timeline,
and the desktop app. In-office / breaks / clock punches are attendance data and live in
the Attendance section (Summary + Monthly grid), never beside tracked time — because
some people legitimately can't track, so the side-by-side comparison misleads.

## Scope

### 1. Team table (Dashboard)
- Columns become: **Employee · Status · Tracked today · Activity · Yesterday · This week · This month** — all TRACKED (desktop tracker + manual diary hours), calendar days.
- Removed: In Office, Break, Week (in-office), Month (in-office) → already fully available in **Attendance → Summary / Monthly grid**.
- "Yesterday" column added so a night shift's finished day is one glance away.
- Status pill reflects tracking state (Tracking / idle), not clock state (clock state is the Shifts tab's job).

### 2. Personal cards (Option A — kept)
- The four cards above the Clock In/Out buttons stay: they are the feedback for those buttons and show only YOUR own numbers.
- In Office / Break / Punches remain shift-work-day (attendance semantics, honest labels).
- **Tracked** card becomes calendar-today ("since midnight — matches your Timeline").

### 3. One tracked definition everywhere
- Dashboard tracked stats: per-user calendar windows (today / yesterday / since Monday / since the 1st) via the shared `inDaySeconds` split + manual diary hours.
- Desktop `/sessions/today` reverts to the calendar day (matches its own week chart, the Timeline, and the dashboard).
- The shift-aware work-day window (`User::attendanceDayWindowFor`, property-tested) is RETAINED for attendance-side logic — it is simply no longer applied to tracked numbers.

### 4. Timeline: collapsible sessions (new feature, Jawad's idea)
- Chevron on each session card hides/shows its screenshot grid; the header (start–end time, client/task, duration, activity) stays visible.
- Global **Collapse all / Expand all** control so a manager can scan "worked from X to Y" without scrolling screenshots.
- Preference persisted locally.

### 5. Attendance rules — confirmed, no changes
Jawad's described behavior is the CURRENT behavior (tests exist for each):
- 11 PM arrival for a 12 AM shift → attaches to the new day (early-grace rule).
- No clock-out → "still working?" nudges; if tracking/responding, the day keeps counting; if unresponsive → auto clock-out at shift end + buffer.
- Timeline date pages show only that calendar date.

### 6. Open slot
Jawad mentioned one more item that slipped his mind — reserved here. Also pending
decision from earlier discussion: the clock-in confirmation toast ("Clocked in — counted
toward Monday") — proposed, not yet approved.

## Verification bar
Full PHP suite green · vite build · deploy · Help article reseeded · **browser-verified
with real night-shift rows** (not an empty account) before reporting done.
