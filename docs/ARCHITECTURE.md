# SA Track — What it is, how it works, and where everything lives

**SA Track** is Sparking Asia's internal **time & attendance tracker**. Staff clock in/out
and run a desktop app that records their working time — periodic screenshots, activity level,
and which client/task they're on — so managers get an accurate picture of attendance and work
without anyone filling in timesheets by hand.

Live site: **https://timetracker.sparkingasia.com**

> **Someone asked you "where is the database"?** Short answer: it's a **MySQL database named
> `u406855808_timetracker`, hosted on the same Hostinger server as the website** — not on
> anyone's PC and not in a separate cloud. See [Where everything lives](#where-everything-lives).

---

## The big picture

SA Track has **two halves** that both talk to one server:

```
   ┌─────────────────────────┐        ┌──────────────────────────────┐
   │  Web app (the website)  │        │   Desktop app ("SA Track")   │
   │  browser → Laravel/React │        │   Electron app on each PC    │
   │  clock in/out, dashboard │        │   screenshots + activity     │
   │  timeline, reports, admin│        │   runs while you're clocked  │
   └───────────┬─────────────┘        └───────────────┬──────────────┘
               │  HTTPS                                │  HTTPS API + token
               └──────────────────┬───────────────────┘
                                  ▼
                 ┌────────────────────────────────────────┐
                 │   Server @ Hostinger                    │
                 │   ├── Laravel app (PHP 8.3)             │
                 │   ├── MySQL DB  u406855808_timetracker  │  ← all records
                 │   └── storage/  (screenshot image files)│
                 └────────────────────────────────────────┘
```

1. **The web app** is what everyone opens in a browser. It handles clock in/out, the
   dashboard, the per-person **Timeline**, reports, the Help section, and all admin screens.
2. **The desktop app** is a small program each employee installs on their work PC. Once they
   clock in and press **Start**, it quietly captures screenshots + activity and uploads them
   to the server. It only records while you're clocked in and tracking — never on a break or
   after clock-out.

Both halves store everything in **one place: the MySQL database + the server's disk.** Nothing
important lives only on an employee's computer.

---

## Where everything lives

| Thing | Where it is | Notes |
|-------|-------------|-------|
| **The database** | **MySQL, on the Hostinger server**, database name **`u406855808_timetracker`**, reached at `localhost:3306` *from the server itself*. | Holds users, attendance (clock in/out), tracking sessions, screenshot metadata, work hours, settings, Help articles, etc. It is **not** exposed to the public internet — only the app on the same server connects to it. |
| **Screenshots (the image files)** | On the **server's disk** at `storage/app/private/screenshots/` (a **private** folder). | Served only through the logged-in app — the folder returns *403 Forbidden* if opened directly. Can optionally be moved to private S3 via `SCREENSHOTS_DRIVER=s3`. |
| **The website code** | Hostinger, `~/domains/timetracker.sparkingasia.com/public_html`. | Laravel 12 + Inertia/React app. |
| **The source repository** | GitHub `jawadislam92/timetracker`, branch **`jawad`**. | Pushing to `jawad` auto-deploys the code to Hostinger. |
| **Desktop app data on each PC** | `%APPDATA%\SA Track\` on Windows — and **per user** under `%APPDATA%\SA Track\users\<user id>\`. | A local **queue** (unsent time/screenshots waiting for internet) + a temporary screenshot cache. It empties as it uploads; the real copy lives on the server. On a shared PC each signed-in person gets their own folder. |
| **Desktop installers + auto-update feed** | On the server at `~/desktop-installers/` (outside `public_html`), published at `/desktop-updates/latest.yml`. | The desktop app checks this to update itself. |

### "So where *exactly* is my data?"
Almost all of it is in the **MySQL database on the Hostinger server**, with the screenshot
**images** sitting next to it on the same server's disk. An employee's own PC only ever holds a
short-lived queue of not-yet-uploaded data. If a PC is wiped, no history is lost — it's on the
server.

---

## How it works (the main flows)

**Attendance (clock in/out).** Your clock is the same whether you press it on the website or in
the desktop app. "In-Office" time = the span from clock-in to clock-out, minus breaks. If you
forget to clock out, the system **auto-closes** your day at your shift end (+ a short grace
period) so a forgotten clock-out never inflates your hours.

**Tracking (the desktop app).** After you clock in and press **Start**, the app:
- takes **periodic screenshots**,
- counts **keyboard/mouse activity** (a count and an *idle-vs-active* percentage — never the
  actual keys you press),
- notes the **active app / window title**,
- and uploads all of it, tagged with the **client/task** you chose.

Time is measured by **real elapsed wall-clock, minus idle and paused time** — so it can't be
inflated by duplicate timers or a sleeping PC, and the server additionally **clamps** any
reported time so it can never exceed the real elapsed time of the session.

**Breaks.** Pressing **Start Break** pauses tracking; that time doesn't count as work.

**Timeline & dashboard.** Managers see a per-person **Timeline** (screenshots + activity over
the day) and a **dashboard** with the live team, shift boards, leaderboards, and per-person
analytics. "In-Office vs Tracked vs Activity %" tells them presence vs recorded work.

**Time zones.** Every time is stored as an exact moment and **displayed in each viewer's own
time zone** (set once in Profile). A viewer's wrong PC clock can't throw the times off, and a
remote worker can be measured in their own country's working day.

---

## Tech stack

- **Backend:** Laravel 12, PHP 8.3, MySQL. Server-rendered via **Inertia.js**.
- **Frontend:** React 18 (JSX) + Vite + Tailwind (dark "Ember" theme). Charts via Chart.js.
- **Desktop app:** Electron (`desktop/`) — native screenshot + input-activity capture,
  a local SQLite queue (`better-sqlite3`), and **electron-updater** auto-updates.
- **Auth:** session cookies for the web app; a per-device **token** for the desktop app.
- **Integrations:** Slack (attendance notifications, "still working?" nudges, weekly digest).

---

## Deploying (important gotchas)

Deploy is **push-to-deploy on the `jawad` branch**, but Hostinger's auto-deploy only **pulls
the code** — it does **not** run installers, builds, or migrations. So:

```bash
# 1. Commit + push (this ships the code)
git push origin jawad

# 2. Frontend changes: build locally BEFORE committing (server does not run `npm run build`)
npm run build      # then commit the public/build assets

# 3. Migrations & Composer changes must be run MANUALLY over SSH after the deploy:
ssh -p 65002 u406855808@31.170.164.232
cd ~/domains/timetracker.sparkingasia.com/public_html
php artisan migrate --force               # only if a migration shipped
composer install --no-dev --optimize-autoloader   # only if composer.lock changed
php artisan optimize:clear                # refresh cached routes/config/permissions
```

**Desktop releases** are separate: build the installer (`cd desktop && npm run dist`), then
upload `latest.yml` + `SA Track Setup X.Y.Z.exe` + `.exe.blockmap` to `~/desktop-installers/`.
electron-updater verifies the installer's base64 **sha512** against `latest.yml` — they must
match or every client rejects the update. Employees then auto-update in the background.

> **Golden rule:** production is real staff data. Only push/deploy/run migrations when it's
> been explicitly decided to — never as a side effect of local work.

---

## Data & privacy (what's recorded)

- Screenshots + activity are captured **only while actively tracking** (clocked in, Start
  pressed, not on a break). Nothing is captured on a break, after clock-out, or when the
  tracker is stopped.
- The app records **how much** you type (a count) and the active window title — **not the keys
  you type**, and it does not use the webcam or read your files.
- Screenshots live on the **private** disk and are visible only to the employee and authorised
  managers, served through the authenticated app (never a public URL).

---

## Security

The full security review — what was checked, what was found, what was fixed, and what was
deliberately left — lives in [`SANITIZATION_AUDIT.md`](SANITIZATION_AUDIT.md), alongside the
exact commands to re-run it.
