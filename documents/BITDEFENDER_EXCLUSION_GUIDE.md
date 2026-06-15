# Allow SA Track in Bitdefender (GravityZone) — IT guide

SA Track is our own time-tracker. Bitdefender flags it as malware (false positive)
because it's an unsigned app that takes screenshots and reads keyboard/mouse
activity — normal for a monitoring tool, but it looks suspicious to behavioural
AV. This also blocks installs/updates ("SA Track cannot be closed"). The fix is a
one-time **exclusion** pushed to all endpoints. (Same as Hubstaff/Time Doctor.)

## The install folder to exclude
SA Track installs per-user at:
```
C:\Users\<username>\AppData\Local\Programs\timetracker-desktop\
```
For a policy that covers everyone, use the environment-variable form (GravityZone
expands it per user):
```
%LocalAppData%\Programs\timetracker-desktop\
```

## Steps (GravityZone Control Center)
1. Log in to **GravityZone Control Center** → **Policies**.
2. Open the **policy assigned to the company endpoints** (or create/clone one).
3. Go to **Antimalware → Settings → Exclusions** → enable **Custom Exclusions** → **Add**:
   - **Type: Folder** — Path: `%LocalAppData%\Programs\timetracker-desktop`
   - Apply to **all modules** available (On-Access, On-Demand, **Advanced Threat
     Defense**). ATD is the one that showed the "Malware – SA Track.exe" block,
     so make sure ATD is ticked.
4. Add a second exclusion for the executable specifically:
   - **Type: Process** — Path: `%LocalAppData%\Programs\timetracker-desktop\SA Track.exe`
5. **Save** the policy. It syncs to endpoints on their next heartbeat (a few minutes).
6. Clear any existing detections: **Network → (endpoint) → Quarantine** → restore
   the "SA Track" items, OR just reinstall SA Track after the policy is live.

## Also present on at least one machine: NordVPN Threat Protection
`nordsec-threatprotection-service` is running too. If it also flags SA Track, add
the same folder to **NordVPN → Threat Protection → exclusions** (or uninstall
NordVPN Threat Protection if it's not needed alongside Bitdefender).

## After the exclusion is live
- The app stops being blocked / quarantined.
- Installs and **auto-updates** complete cleanly (no more "cannot be closed").
- No per-machine steps needed — the policy covers every endpoint.

## Note
We are not buying a code-signing certificate, so the exclusion is the supported
fix. (A cert would remove the Windows SmartScreen warning and reduce friction on
un-managed machines, but on AV-managed company machines the exclusion is what's
needed regardless.)
