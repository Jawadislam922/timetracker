# History — what happened, and what it taught us

> Major milestones and incidents, newest first. Each entry is short on
> ceremony and long on the lesson, because the lesson is why this file exists.

## 2026-08 — Installer self-kill defect found and fixed (0.4.10)

The NSIS installer force-closed the app with `taskkill /F /IM "SA Track.exe" /T`
before installing. During an **auto**-update the installer is spawned as a child
of the running app, so `/T` (kill the whole child tree) could kill **the
installer itself** between its uninstall and install phases — leaving a machine
with no app at all, silently. Manual double-click installs never hit this,
which is why testing missed it. Fixed by dropping `/T`.

**Lessons:** (1) an auto-update path can only be validated by exercising the
real updater flow — a manual install of the same exe proves nothing about it;
(2) when an entire fleet goes silent at once and nobody complains, ask the
owner whether it was deliberate before building an incident story (it was —
see STATUS.md).

## 2026-08 — Upwork removals; company moves to web-only

Upwork permanently banned one company profile and flagged others. The owner
removed the desktop tracker from every office PC to present clean machines.
Attendance continued seamlessly via the web clock — the system's fallback
worked exactly as designed.

## 2026-07 — Machine Compliance: per-profile extension attribution (0.4.8–0.4.9)

People run 20–30 Chrome profiles per PC (often one per Upwork account), so "a
scraper on PC-VA-7" was not actionable. The agent now reports which **browser
profile** each extension lives in, the page reads person → profile →
extensions, and detection reacts within ~1 minute of an install (mtime polling)
instead of an hourly timer.

Hard-won specifics: the collector's dedup key must include the profile
(without it, `Default` shadows every other profile — a false all-clear on the
exact Upwork profile at risk); the field is `browser_profile` because the
host's WAF blocks bodies repeating a parameter named exactly `profile`
(HTTP-parameter-pollution rule, threshold between 10 and 40 occurrences —
established by unauthenticated probing where the WAF answers before Laravel);
a separate WAF rule 403s any body containing `<>`, so employee-typed profile
labels are sanitized on both ends.

**Lessons:** never filter on a vendor field without checking it exists in live
data (`state` vs `disable_reasons` dropped 100% of extensions in 0.4.5); a
plain-text 403 with no Laravel log line is infrastructure, not the app.

## 2026-07 — VPN alerting policy settled

Office VPNs are used for client work, so `vpn_proxy` findings are recorded and
shown but never ping Slack. The alerting categories are exactly the things
Upwork bans for: auto-refresh/bidding tools, scrapers, jigglers/auto-clickers,
and antidetect browsers (GoLogin etc.).

## 2026-07 — Timezone correctness + the re-save corruption

Per-user work timezones landed end-to-end (attendance bucketing, auto-close,
Slack display). During it: **never re-save a loaded TimeEntry** — Eloquent
re-serializes `action_timestamp` and shifts it 5h on this UTC MySQL server;
write via query-builder `update()` instead. 66 corrupted rows were repaired.

## 2026-06 — attendance day bucketing, shifts, auto-close, Slack threads

The shift system (shifts, per-day overrides, `attendanceDateFor`), auto
clock-out at shift end with the "still working?" Slack prompt, and one Slack
thread per person per day. Design rules that still bind (do not re-break them):

- **The tracker follows the clock**, never the reverse: presence is clock
  in/out; a quiet tracker must never trigger a clock-out (re-adding that rule
  once mis-closed a real person's day).
- **The dashboard measures tracked work; attendance lives in Attendance** —
  never side by side, because some people legitimately cannot track.
- Sub-minute (<60 s) tracking sessions are treated as nothing everywhere —
  deliberate deletion-residue rule.
- No keystroke content, webcam, or microphone — activity is keyboard/mouse
  **counts** only; capture only between Start and Stop; employees can see
  their own screenshots.

## 2026-06 — the deploy pipeline's real behavior learned the hard way

Hostinger's git auto-deploy **pulls files only** — no composer, no npm, no
migrations (`.cpanel.yml` is not executed). It also prunes untracked files in
`public_html` and wipes `bootstrap/cache` on every deploy. hPanel cron breaks
silently on any shell metacharacter. The production `.env` once had no trailing
newline, so a blind `echo >>` glued onto the last line and 500'd the site.
All of this is codified in OPERATIONS.md — read it before touching prod.
