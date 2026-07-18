'use strict';

// Endpoint-compliance collector. Gathers what's installed/running on this
// Windows PC — browser extensions, programs, processes, network adapters — and
// uploads it so automation tools (refresh tools, scrapers, jigglers) and VPNs
// that get an Upwork profile flagged are visible on the dashboard without
// visiting the machine. Everything is best-effort and wrapped: a collector that
// fails just yields [] and never touches tracking. Windows-only for now.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

const api = require('./api');
const store = require('./store');
const report = require('./report');

let appVersion = '?';
try { appVersion = require('../package.json').version; } catch { /* non-electron */ }

const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const ROAMING = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');

/**
 * Run a PowerShell command and parse its JSON stdout. Never throws.
 * Uses -EncodedCommand (base64 UTF-16LE) so quotes, backslashes and registry
 * paths can never be mangled by argument escaping — passing complex commands as
 * a plain -Command string silently returned nothing for the registry queries.
 */
function ps(command) {
  const encoded = Buffer.from(command, 'utf16le').toString('base64');
  return new Promise((resolve) => {
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { timeout: 30000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) return resolve([]);
        try {
          const data = JSON.parse(stdout);
          resolve(Array.isArray(data) ? data : [data]);
        } catch { resolve([]); }
      });
  });
}

/**
 * Is this extension enabled? Chromium has changed how it records this, so probe
 * in order and DEFAULT TO ENABLED when the shape is unknown — a wrong "disabled"
 * guess silently loses the extension entirely (0.4.5 checked `state === 1`, which
 * is `undefined` on current Chrome/Edge, and dropped 100% of extensions).
 */
function isExtensionEnabled(ext) {
  // Current Chrome/Edge: array of disable reasons — empty means enabled.
  if (Array.isArray(ext.disable_reasons)) return ext.disable_reasons.length === 0;
  // Some builds store it as a numeric bitmask.
  if (typeof ext.disable_reasons === 'number') return ext.disable_reasons === 0;
  // Older Chrome: 1 = enabled, 0 = disabled.
  if (typeof ext.state === 'number') return ext.state === 1;
  return true; // unknown shape → keep it, never silently drop
}

// Last scan's funnel, surfaced in telemetry so a regression like the above is
// visible as "ext=0/58" instead of a silent zero.
let extScanStats = { raw: 0, kept: 0 };

/** Installed browser extensions across all Chrome/Edge/Brave profiles. */
function collectExtensions() {
  const browsers = [
    ['Chrome', path.join(LOCAL, 'Google', 'Chrome', 'User Data')],
    ['Edge', path.join(LOCAL, 'Microsoft', 'Edge', 'User Data')],
    ['Brave', path.join(LOCAL, 'BraveSoftware', 'Brave-Browser', 'User Data')],
  ];
  const out = [];
  let raw = 0;

  for (const [browser, userData] of browsers) {
    let profiles = [];
    try { profiles = fs.readdirSync(userData, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
    catch { continue; }

    for (const profile of profiles) {
      // Which extension ids are actually unpacked on disk for this profile — lets
      // us drop account-SYNCED "ghosts" Chrome knows about but that aren't really
      // installed here (why two people on one Google account showed identical lists).
      let installedIds = null;
      try { installedIds = new Set(fs.readdirSync(path.join(userData, profile, 'Extensions'))); }
      catch { installedIds = null; }

      for (const file of ['Secure Preferences', 'Preferences']) {
        const p = path.join(userData, profile, file);
        let prefs;
        try { prefs = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
        const settings = prefs?.extensions?.settings;
        if (!settings || typeof settings !== 'object') continue;

        for (const [id, ext] of Object.entries(settings)) {
          const man = ext?.manifest;
          if (!man || !man.name) continue;                        // skip stubs
          if (ext.location === 5 || ext.location === 10) continue; // component/system
          raw++;
          if (!isExtensionEnabled(ext)) continue;                 // owner policy: enabled only
          if (installedIds && !installedIds.has(id)) continue;    // synced ghost, not on disk
          let name = man.name;
          if (typeof name === 'string' && name.startsWith('__MSG_')) name = ext.path || id;
          out.push({
            // NOTE: the Chrome profile directory name is deliberately NOT sent.
            // Hostinger's firewall blocks any request body carrying a repeated
            // `profile` field (standard ModSecurity rule), which 403'd the whole
            // inventory upload — extensions, programs and processes together —
            // for every machine with ~20+ extensions. The server never used it.
            browser, id,
            name: String(name).slice(0, 160),
            version: man.version || null,
            enabled: true,
            from_webstore: ext.from_webstore === true,
            permissions: []
              .concat(man.permissions || [], man.host_permissions || [], man.optional_permissions || [])
              .filter((x) => typeof x === 'string').slice(0, 40),
          });
        }
        break; // one prefs file per profile is enough
      }
    }
  }
  // Dedup by browser+id (Secure Preferences + Preferences overlap).
  const seen = new Set();
  const deduped = out.filter((e) => { const k = e.browser + e.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 500);
  extScanStats = { raw, kept: deduped.length };

  return deduped;
}

/**
 * Installed programs from the registry uninstall keys. Opens BOTH the 64- and
 * 32-bit views explicitly via .NET so it works regardless of the host process
 * bitness — a plain `HKLM:\SOFTWARE\...` query silently returns nothing from a
 * redirected 32-bit process.
 */
async function collectPrograms() {
  const rows = await ps([
    '$o=@();',
    "foreach($h in 'LocalMachine','CurrentUser'){foreach($v in 'Registry64','Registry32'){try{",
    '$b=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::$h,[Microsoft.Win32.RegistryView]::$v);',
    "$u=$b.OpenSubKey('SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall');",
    'if($u){foreach($n in $u.GetSubKeyNames()){$k=$u.OpenSubKey($n);$d=$k.GetValue(\'DisplayName\');',
    'if($d){$o+=[pscustomobject]@{name=$d;version=$k.GetValue(\'DisplayVersion\');publisher=$k.GetValue(\'Publisher\')}}}}',
    '}catch{}}}',
    '$o | Sort-Object name -Unique | ConvertTo-Json -Compress',
  ].join(''));
  return rows.filter((r) => r && r.name).slice(0, 600);
}

/** Distinct running processes (name + path). */
async function collectProcesses() {
  const rows = await ps(
    'Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ' +
    'Select-Object @{n=\'process\';e={$_.Name}},@{n=\'path\';e={$_.ExecutablePath}} | ' +
    'Sort-Object process -Unique | ConvertTo-Json -Compress');
  return rows.filter((r) => r && r.process).slice(0, 400);
}

/** Network adapters (VPN/proxy adapters surface here) + startup entries. */
async function collectNetwork() {
  const adapters = await ps(
    'Get-NetAdapter -ErrorAction SilentlyContinue | ' +
    'Select-Object @{n=\'adapter\';e={$_.Name}},@{n=\'description\';e={$_.InterfaceDescription}},@{n=\'status\';e={$_.Status}} | ' +
    'ConvertTo-Json -Compress');
  return adapters.filter((a) => a && a.adapter).slice(0, 60);
}

let lastRun = 0;

/**
 * Gather everything and upload. Runs on a timer, on sign-in, and right after a
 * clock-in. Every outcome — including the no-op branches — is reported to the
 * diagnostics pipe so a silent machine is diagnosable instead of invisible.
 *
 * @param {string} [reason] what triggered this run (timer|login|clock_in) — for telemetry
 */
async function run(reason) {
  if (process.platform !== 'win32') { report.info('machine_report_skip', 'non-windows platform'); return; }
  if (!store.get('token')) { report.info('machine_report_skip', 'not signed in yet'); return; }

  // Debounce: the hourly timer and a clock-in can land together; one upload is enough.
  const startedAt = Date.now();
  if (startedAt - lastRun < 90_000) return;
  lastRun = startedAt;

  try {
    const [extensions, programs, processes, network] = await Promise.all([
      Promise.resolve().then(collectExtensions).catch(() => []),
      collectPrograms().catch(() => []),
      collectProcesses().catch(() => []),
      collectNetwork().catch(() => []),
    ]);

    const nowIso = new Date().toISOString();
    const reports = [
      { kind: 'extensions', collected_at: nowIso, items: extensions },
      { kind: 'programs', collected_at: nowIso, items: programs },
      { kind: 'processes', collected_at: nowIso, items: processes },
      { kind: 'network', collected_at: nowIso, items: network },
    ].filter((r) => r.items.length);

    if (!reports.length) { report.warn('machine_report_empty', 'all collectors returned 0 items (PowerShell blocked?)'); return; }

    await api.sendMachineReport({
      device_name: store.get('deviceName') || os.hostname(),
      app_version: appVersion,
      platform: process.platform,
      reports,
    });
    report.info('machine_report', `sent (${reason || 'timer'}): ext=${extensions.length}/${extScanStats.raw} prog=${programs.length} proc=${processes.length} net=${network.length}`);
  } catch (e) {
    report.warn('machine_report_failed', e && e.message ? e.message : String(e));
  }
}

module.exports = { run, collectExtensions };
