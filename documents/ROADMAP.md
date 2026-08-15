# Roadmap — what happens next, in order

> What we need to do and what is planned. Reprioritize freely, but keep the
> "blocked on" notes honest. Last updated: **2026-08-09**.

## Now (unblocked, highest value)

1. **Hostinger support ticket** for the MySQL connection refusals — the real
   cause of the intermittent 500s/slowness, and only the host can fix it.
   Wording: *"My database u406855808_timetracker is intermittently refusing
   connections with 'SQLSTATE[HY000] 2002 Operation not permitted' — bursts of
   90–300 failures on Aug 2, 3, 5, 7, 9. Please check MySQL connection limits
   and DB server health for my account."* **Owner action.**
2. **Queue worker.** `QUEUE_CONNECTION=sync` means Slack messages send inside
   the request — every clock in/out pays that latency, and the whole company
   now clocks via the web. DB queue + a worker driven from the existing
   scheduler would make punches near-instant.

## When Upwork resolves (owner decides the moment)

3. **Fleet reinstall** — one manual install per PC from `/download` (0.4.10).
   Machines reappear on the dashboard as they return.
4. Verify per-profile compliance attribution on real fleet data, then raise
   `desktop.min_agent_version` to 0.4.10 so stragglers are flagged.
5. Decide the pending compliance questions: per-profile Acknowledge granularity
   (deliberately coarse today) and the deferred max-capture phase.

## Next (valuable, not urgent)

6. **"Fleet silent" alert** — Slack warning when zero agents report for N
   hours on a workday. Deliberately NOT built while the removal is intentional;
   build it as part of the fleet's return.
7. **Desktop dependency majors** (from the sanitization audit, deferred):
   jimp 0.22→1.x, uuid 10→14, active-win pin — their own tested desktop
   release. Same release should revisit `sandbox: true` (L2).
8. **Ollama / local AI** for the AI assistant to cut API cost (VPS exists;
   model research first).
9. **Profile-selectable bidding** so each bid session attributes to an Upwork
   profile (sessions already carry `upwork_profile_id`).

## Standing security chores (from the old backlog — verify, then close)

10. Rotate the prod DB password and `SCHEDULER_HTTP_TOKEN` (both were pasted
    into a chat log in June 2026); delete the old AWS key `AKIA…7B6P` if it
    still exists in IAM; remove leftover hPanel test crons (`cron-test`,
    `cron-simple`). The S3 secret was likewise exposed — rotate when touching
    IAM anyway.

## Open investigations

11. **`action_date` mis-filing** — Aqsa's early clock-ins filed under the
    previous day. Her rows were repaired and a guard-log deployed; the write
    mechanism was never reproduced, and a ~125-row broad historical repair
    waits on a decision. See ATTENDANCE_DAY_BUCKETING.md for the resolver.
12. **Parked owner decision:** global 8AM–8AM business day (plan sketched in
    ATTENDANCE_DAY_BUCKETING.md; not approved).

## Small items parked from the old backlog

- Coverage chip in Attendance Summary (blocked: summary endpoint lacks
  tracked-seconds).
- Self-service rollback button on the Developer page (rollback is
  SSH/artisan-only today; `desktop:set-active-version` exists).
- Dark-theme variants for shared form components + Settings page.
- "Double tracked" label for multi-device users — planned fast-follow;
  verify whether it was ever built before scheduling.
