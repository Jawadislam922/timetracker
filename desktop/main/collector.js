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

/** Installed browser extensions across all Chrome/Edge/Brave profiles. */
function collectExtensions() {
  const browsers = [
    ['Chrome', path.join(LOCAL, 'Google', 'Chrome', 'User Data')],
    ['Edge', path.join(LOCAL, 'Microsoft', 'Edge', 'User Data')],
    ['Brave', path.join(LOCAL, 'BraveSoftware', 'Brave-Browser', 'User Data')],
  ];
  const out = [];

  for (const [browser, userData] of browsers) {
    let profiles = [];
    try { profiles = fs.readdirSync(userData, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
    catch { continue; }

    for (const profile of profiles) {
      for (const file of ['Secure Preferences', 'Preferences']) {
        const p = path.join(userData, profile, file);
        let prefs;
        try { prefs = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
        const settings = prefs?.extensions?.settings;
        if (!settings || typeof settings !== 'object') continue;

        for (const [id, ext] of Object.entries(settings)) {
          const man = ext?.manifest;
          if (!man || !man.name) continue;                       // skip stubs
          if (ext.location === 5 || ext.location === 10) continue; // component/system
          let name = man.name;
          if (typeof name === 'string' && name.startsWith('__MSG_')) name = ext.path || id;
          out.push({
            browser, profile, id,
            name: String(name).slice(0, 160),
            version: man.version || null,
            enabled: ext.state === 1,
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
  return out.filter((e) => { const k = e.browser + e.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 500);
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

/** Gather everything and upload. Runs on a timer + on demand. */
async function run() {
  if (process.platform !== 'win32') return;      // Windows-only for now
  if (!store.get('token')) return;               // not signed in yet

  try {
    const [extensions, programs, processes, network] = await Promise.all([
      Promise.resolve().then(collectExtensions).catch(() => []),
      collectPrograms().catch(() => []),
      collectProcesses().catch(() => []),
      collectNetwork().catch(() => []),
    ]);

    const now = new Date().toISOString();
    const reports = [
      { kind: 'extensions', collected_at: now, items: extensions },
      { kind: 'programs', collected_at: now, items: programs },
      { kind: 'processes', collected_at: now, items: processes },
      { kind: 'network', collected_at: now, items: network },
    ].filter((r) => r.items.length);

    if (!reports.length) return;

    await api.sendMachineReport({
      device_name: store.get('deviceName') || os.hostname(),
      app_version: appVersion,
      platform: process.platform,
      reports,
    });
    report.info('machine_report', `inventory sent: ext=${extensions.length} prog=${programs.length} proc=${processes.length}`);
  } catch (e) {
    report.warn('machine_report_failed', e && e.message ? e.message : String(e));
  }
}

module.exports = { run, collectExtensions };
