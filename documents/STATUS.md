# Current Status

> What is true **right now**. Update this file when the situation changes —
> it is the first thing to read when picking the project back up.
> Last updated: **2026-08-09**.

## Operating mode: WEB ONLY (temporary)

The desktop tracker has been **deliberately removed from all office PCs** by the
owner because Upwork flagged several of the company's profiles for "bots,
scrapers, refresh tools, or third-party software" — and permanently banned one
(Naila). Machines are being kept clean while the company waits to see whether
Upwork reverses its decisions.

What that means in practice:

- Everyone clocks in/out through the **website** (~130 clock events/day).
- **No tracking sessions, screenshots, or activity samples** are being recorded.
  The gap from **Aug 1 onward is intentional and permanent** — that data was
  never captured.
- Auto clock-out closes the day for the 16–20 people per day who forget; this
  job is now load-bearing.
- Compliance monitoring (extension inventory) is blind — the agents that
  collect it are the thing that was removed.

## Desktop app: parked at 0.4.10, ready for return

- The auto-update feed and the public download page both serve **0.4.10**,
  which fixes the installer self-kill defect (see HISTORY.md).
- When the Upwork situation resolves, recovery is **one manual reinstall per
  PC** from `timetracker.sparkingasia.com/download` — a machine with no app
  cannot auto-update. After that, updates are automatic again.
- Rollback manifests are archived on the server (`latest.yml.047.bak`,
  `.049.bak`).

## Known open problem: Hostinger MySQL

The shared host's database intermittently refuses connections
(`SQLSTATE[HY000] 2002 Operation not permitted`) in bursts — 90–300 failures on
Aug 2, 3, 5, 7, 9. This is the cause of the intermittent 500s and perceived
slowness. **It is host-side**: app error logs show no other error class, and
server-local response time is ~50 ms. A support ticket with Hostinger is the
fix; the 500 page now auto-retries once as a stopgap.

## Health facts (verified 2026-08-09)

- Full test suite green (305 tests).
- Scheduler running (heartbeat file + daily auto clock-outs confirm).
- `route:cache` is **safe and in use** on this app — an old doc claimed
  otherwise; that claim was tested and is false for the current code.
- Server-side page time ~0.05 s; the ~1.3 s a user in Pakistan feels is network
  distance to the host plus the MySQL issue above.
