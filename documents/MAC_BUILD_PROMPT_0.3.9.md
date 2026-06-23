# Mac build prompt — SA Track Desktop v0.3.9

Paste the block below into a **Claude Code session on an Apple Silicon Mac**
(M1/M2/M3). It builds, smoke-tests, and publishes the macOS build of SA Track
Desktop **v0.3.9** from the same source the Windows 0.3.9 build uses. No Apple
Developer account or paid certificate is needed — the app is **ad-hoc signed**
(`identity: null`), so the first launch needs a Gatekeeper bypass (covered in the
smoke test).

**What's new since the last Mac build (0.3.2/0.3.3) — all already on the `jawad` branch:**
- **Idle time is never counted.** The timer now counts *active* seconds only —
  step away and it stops within ~20s; move and it resumes. (Continuous idle
  exclusion, independent of the 5-min auto-pause, which now only stops
  screenshots.)
- **Starting a break pauses the tracker** (timer freezes + screenshots stop),
  whether the break is pressed in the desktop app *or* on the web dashboard.
  Ending a break requires pressing **Resume** (no auto-resume).
- **Idempotent screenshot upload** (no duplicate on a retry) and clearer sign-in
  errors / per-task Today list (from 0.3.3–0.3.7).

`desktop/package.json` is already at version **0.3.9** — do **not** edit the
version; just build.

---

You are building **SA Track Desktop v0.3.9 for macOS (Apple Silicon / arm64)**.
Repo: https://github.com/jawadislam92/timetracker — branch **`jawad`**.

### Prerequisites (check, install if missing)
- Apple Silicon Mac, macOS 12+.
- **Node.js 20+** and npm 10+ (`node -v`, `npm -v`).
- **Xcode Command Line Tools** (needed to compile native modules):
  `xcode-select -p` — if it errors, run `xcode-select --install` and wait for it.

### Build steps
1. Get the latest source:
   - If the repo isn't cloned yet: `git clone https://github.com/jawadislam92/timetracker.git && cd timetracker`
   - Then: `git fetch origin jawad && git checkout -f jawad && git pull`
2. `cd desktop`
3. `npm install`
4. `npm run rebuild`  *(rebuilds the native modules — better-sqlite3, uiohook-napi — against Electron's ABI; electron-builder also rebuilds active-win/screenshot-desktop during dist.)*
5. `npm run dist:mac`
   - Produces in `desktop/dist-app/`:
     - **`SA Track-0.3.9-arm64.dmg`**
     - **`SA Track-0.3.9-arm64-mac.zip`**
   - If the build fails extracting electron-builder's helper with a symlink/privilege error, it's a Gatekeeper/quarantine issue on the cache — retry once; if it persists, run `sudo xattr -dr com.apple.quarantine ~/Library/Caches/electron-builder` and rebuild.

### Smoke test (do this — it validates the headline 0.3.9 behaviour)
1. Open the DMG → drag **SA Track** into **Applications**.
2. First launch is blocked (unsigned). Clear quarantine, then open:
   `xattr -dr com.apple.quarantine "/Applications/SA Track.app"` → launch it
   (or right-click the app → **Open** → **Open**).
3. Grant macOS permissions when prompted (required for capture):
   **System Settings → Privacy & Security → Accessibility** (for activity/idle
   detection) **and → Screen Recording** (for screenshots and app/window names).
   Quit and relaunch the app after granting Screen Recording.
4. Sign in (server URL `https://timetracker.sparkingasia.com`).
5. **Idle test:** start tracking, then don't touch the mouse/keyboard for ~30–40s
   → the timer should **stop advancing**; move the mouse → it resumes. (Confirms
   idle is excluded.)
6. **Break test:** press **Start Break** → the timer **freezes**, screenshots
   stop, the ring shows **"On break"**, and a **Resume** button appears. Press
   **Resume** → tracking continues. (Confirms break pauses the tracker.)
7. Confirm a wrong password shows **"Incorrect email or password."**

### Publish (upload to the deploy-proof installer folder)
The installers live OUTSIDE the web tree so deploys never wipe them. SSH key auth
is set up (port **65002**, user **u406855808**, host **31.170.164.232**):

```
scp -P 65002 "dist-app/SA Track-0.3.9-arm64.dmg"     u406855808@31.170.164.232:~/desktop-installers/
scp -P 65002 "dist-app/SA Track-0.3.9-arm64-mac.zip" u406855808@31.170.164.232:~/desktop-installers/
```

### Report back
- The exact DMG filename and `shasum -a 256 "dist-app/SA Track-0.3.9-arm64.dmg"`.
- Whether the **idle test** and **break test** passed.
- Any permission prompts or build warnings you hit.

### Caveats
- **arm64 only** (Apple Silicon). No Intel build.
- **Unsigned / ad-hoc** — first launch needs the quarantine bypass above.
- **No auto-update on macOS** — Mac users download + reinstall the new DMG
  manually (the Windows app auto-updates; Mac does not).

### Follow-up on the web side (NOT done by this Mac session)
After the dmg/zip are uploaded, the web **Downloads page** still points at the old
Mac version. On the web/Windows side, bump `MAC_VERSION` and the `MAC_INSTALLERS`
filename list in `app/Http/Controllers/DesktopDownloadController.php` to
`SA Track-0.3.9-arm64.dmg` (+ `.zip`), commit to `jawad`, and deploy so the
Downloads page offers 0.3.9 for Mac.
