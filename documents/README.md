# SA Track — documentation index

Ten files, no archaeology. If a document contradicts production, test
production, then fix the document.

## Start here

| File | Question it answers |
|---|---|
| [STATUS.md](STATUS.md) | What is true **right now**? |
| [HISTORY.md](HISTORY.md) | What happened, and what did it teach us? |
| [ROADMAP.md](ROADMAP.md) | What happens next, in what order? |

## Reference

| File | What it covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the system fits together (web + desktop + S3 + deploy reality) |
| [OPERATIONS.md](OPERATIONS.md) | Deploying, cron, Slack, desktop releases, the host's sharp edges |
| [SECURITY.md](SECURITY.md) | Security policy |
| [SANITIZATION_AUDIT.md](SANITIZATION_AUDIT.md) | Living security-audit record (append per pass) |
| [ATTENDANCE_DAY_BUCKETING.md](ATTENDANCE_DAY_BUCKETING.md) | How a clock punch chooses its attendance day |
| [BITDEFENDER_EXCLUSION_GUIDE.md](BITDEFENDER_EXCLUSION_GUIDE.md) | IT runbook: AV exclusions for the desktop app |

User documentation lives **in the app** (Help section, seeded from
`database/seeders/HelpArticleSeeder.php`) — not here.

Everything else that used to be in this folder (dated audits, shipped plans,
per-version build prompts, a giant session handoff) was deleted on 2026-08-09
after an audit extracted the still-true facts into the files above. History is
in git if it is ever missed.
