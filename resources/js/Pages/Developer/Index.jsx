import React, { useEffect, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Database,
    FileText,
    HardDrive,
    Image as ImageIcon,
    KeyRound,
    Play,
    RefreshCw,
    Send,
    Terminal,
    Trash2,
    Wrench,
    XCircle,
    Zap,
} from 'lucide-react';

function InfoRow({ label, value, mono = true }) {
    return (
        <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="text-slate-400">{label}</span>
            <span className={['truncate text-right text-slate-100', mono ? 'font-mono text-xs' : ''].join(' ')} title={String(value ?? '')}>
                {value === null || value === undefined || value === '' ? '—' : String(value)}
            </span>
        </div>
    );
}

function Badge({ ok, children }) {
    return (
        <span
            className={[
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300',
            ].join(' ')}
        >
            {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {children}
        </span>
    );
}

function Card({ title, icon: Icon, children, accent }) {
    return (
        <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-sm">
            <header className={['flex items-center gap-2 border-b border-slate-800 px-4 py-2.5', accent || 'bg-slate-950'].join(' ')}>
                {Icon && <Icon className="h-4 w-4 text-slate-400" />}
                <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
            </header>
            <div className="px-4 py-3">{children}</div>
        </section>
    );
}

function ActionButton({ icon: Icon, label, hint, danger, busy, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            className={[
                'flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition disabled:opacity-50',
                danger
                    ? 'border-rose-500/40 hover:bg-rose-500/10'
                    : 'border-slate-800 hover:bg-slate-800',
            ].join(' ')}
        >
            <Icon className={['mt-0.5 h-4 w-4 shrink-0', danger ? 'text-rose-400' : 'text-slate-400'].join(' ')} />
            <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-100">{label}</span>
                {hint && <span className="block text-xs text-slate-400">{hint}</span>}
            </span>
        </button>
    );
}

function buildEnvDraft(groups) {
    const draft = {};
    (groups || []).forEach((group) => {
        group.fields.forEach((field) => {
            if (field.type === 'secret') {
                draft[field.key] = ''; // blank = keep current
            } else if (field.type === 'bool') {
                draft[field.key] = String(field.value) === 'true';
            } else {
                draft[field.key] = field.value ?? '';
            }
        });
    });
    return draft;
}

export default function DeveloperIndex({ auth, system, health, schedule, envGroups, lastOutput, lastAction }) {
    const flash = usePage().props.flash || {};
    const branding = usePage().props.branding || {};
    const [busy, setBusy] = useState(false);
    const [logLines, setLogLines] = useState([]);
    const [logFile, setLogFile] = useState(null);
    const [logsLoading, setLogsLoading] = useState(false);
    const [diag, setDiag] = useState({ counts: {}, recent: [] });
    const [diagLoading, setDiagLoading] = useState(false);
    const [storage, setStorage] = useState(null);
    const [storageLoading, setStorageLoading] = useState(false);
    const [envDraft, setEnvDraft] = useState(() => buildEnvDraft(envGroups));
    const [savingEnv, setSavingEnv] = useState(false);
    const [logoFile, setLogoFile] = useState(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    const uploadLogo = () => {
        if (!logoFile) return;
        setUploadingLogo(true);
        router.post(route('developer.branding.update'), { logo: logoFile }, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => setLogoFile(null),
            onFinish: () => setUploadingLogo(false),
        });
    };

    const runAction = (action, confirmText) => {
        if (confirmText && !confirm(confirmText)) return;
        setBusy(true);
        router.post(route('developer.run'), { action }, {
            preserveScroll: true,
            onFinish: () => setBusy(false),
        });
    };

    const setEnvField = (key, value) => setEnvDraft((d) => ({ ...d, [key]: value }));

    const saveEnv = () => {
        setSavingEnv(true);
        router.put(route('developer.env.update'), { values: envDraft }, {
            preserveScroll: true,
            onSuccess: () => setEnvDraft((d) => {
                // clear secret fields after a successful save so they show "set"
                const next = { ...d };
                (envGroups || []).forEach((g) => g.fields.forEach((f) => {
                    if (f.type === 'secret') next[f.key] = '';
                }));
                return next;
            }),
            onFinish: () => setSavingEnv(false),
        });
    };

    const loadLogs = async () => {
        setLogsLoading(true);
        try {
            const res = await fetch(route('developer.logs'), { credentials: 'same-origin', headers: { Accept: 'application/json' } });
            const json = await res.json();
            setLogLines(json.lines || []);
            setLogFile(json.file);
        } catch {
            setLogLines(['Could not load logs.']);
        } finally {
            setLogsLoading(false);
        }
    };

    const loadDiag = async () => {
        setDiagLoading(true);
        try {
            const res = await fetch(route('developer.diagnostics'), { credentials: 'same-origin', headers: { Accept: 'application/json' } });
            const json = await res.json();
            setDiag({ counts: json.counts || {}, recent: json.recent || [] });
        } catch {
            setDiag({ counts: {}, recent: [] });
        } finally {
            setDiagLoading(false);
        }
    };

    const loadStorage = async ({ cost = false, fresh = false } = {}) => {
        setStorageLoading(true);
        try {
            const qs = new URLSearchParams();
            if (cost) qs.set('cost', '1');
            if (fresh) qs.set('fresh', '1');
            const res = await fetch(route('developer.storage') + (qs.toString() ? `?${qs}` : ''), {
                credentials: 'same-origin', headers: { Accept: 'application/json' },
            });
            setStorage(await res.json());
        } catch {
            setStorage({ error: 'Could not reach the server.' });
        } finally {
            setStorageLoading(false);
        }
    };

    useEffect(() => { loadLogs(); loadDiag(); loadStorage(); }, []);

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-xl font-semibold text-slate-100">Developer</h2>}>
            <Head title="Developer" />

            <div className="min-h-screen bg-slate-950">
            <div className="mx-auto max-w-none space-y-4 px-4 py-6 sm:px-6 lg:px-8">
                {(flash.success || flash.error) && (
                    <div
                        className={[
                            'rounded-md border px-4 py-2 text-sm',
                            flash.error
                                ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                                : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
                        ].join(' ')}
                    >
                        {flash.error || flash.success}
                    </div>
                )}

                {lastOutput && (
                    <Card title={`Output — ${lastAction || 'last action'}`} icon={Terminal} accent="bg-slate-900 text-white [&_h2]:text-white [&_svg]:text-slate-300">
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 font-mono text-xs leading-relaxed text-emerald-200">
                            {lastOutput}
                        </pre>
                    </Card>
                )}

                <Card title="Storage (S3)" icon={HardDrive}>
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs text-slate-500">Screenshot bucket usage &amp; estimated cost</span>
                        <button type="button" onClick={() => loadStorage({ fresh: true })} disabled={storageLoading}
                            className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50">
                            <RefreshCw className={['h-3 w-3', storageLoading ? 'animate-spin' : ''].join(' ')} /> Refresh
                        </button>
                    </div>
                    {!storage ? (
                        <p className="py-2 text-sm text-slate-500">Loading…</p>
                    ) : storage.configured === false ? (
                        <p className="py-2 text-sm text-slate-400">{storage.message || 'Screenshots are not on S3.'}</p>
                    ) : storage.error ? (
                        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">{storage.error}</div>
                    ) : (
                        <>
                            <InfoRow label="Bucket" value={storage.bucket} />
                            <InfoRow label="Region" value={storage.region} />
                            <InfoRow label="Space used" value={storage.gb != null ? `${storage.gb} GB` : '—'} mono={false} />
                            <InfoRow label="Objects" value={storage.objects != null ? storage.objects.toLocaleString() : '—'} mono={false} />
                            <InfoRow label="Est. monthly cost" value={storage.estimated_monthly_usd != null ? `~$${storage.estimated_monthly_usd}/mo` : '—'} mono={false} />
                            {storage.real_cost && (
                                <InfoRow label="Actual S3 spend (this month)"
                                    value={storage.real_cost.amount != null ? `$${storage.real_cost.amount} ${storage.real_cost.unit}` : (storage.real_cost.error || '—')} mono={false} />
                            )}
                            <InfoRow label="As of" value={storage.as_of} />
                            {!storage.real_cost && (
                                <button type="button" onClick={() => loadStorage({ cost: true, fresh: true })} disabled={storageLoading}
                                    className="mt-2 text-xs font-medium text-orange-400 hover:text-orange-300 disabled:opacity-50">
                                    Fetch actual cost (AWS Cost Explorer)
                                </button>
                            )}
                            <p className="mt-2 text-[11px] leading-4 text-slate-500">
                                Size comes from CloudWatch (updates ~daily). Estimate = size × ${storage.price_per_gb_month}/GB-month.
                            </p>
                        </>
                    )}
                </Card>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <Card title="System" icon={Database}>
                        <InfoRow label="Environment" value={system.app_env} />
                        <InfoRow label="Debug" value={system.app_debug ? 'on' : 'off'} />
                        <InfoRow label="App URL" value={system.app_url} />
                        <InfoRow label="Timezone" value={system.app_timezone} />
                        <InfoRow label="Server time" value={system.server_time} />
                        <InfoRow label="PHP" value={system.php_version} />
                        <InfoRow label="Laravel" value={system.laravel_version} />
                        <InfoRow label="Database" value={`${system.db_connection} · ${system.db_database}`} />
                        <InfoRow label="Cache / Session / Queue" value={`${system.cache_driver} / ${system.session_driver} / ${system.queue_driver}`} />
                        <InfoRow label="Config cached" value={system.config_cached ? 'yes' : 'no'} />
                        <InfoRow label="Routes cached" value={system.routes_cached ? 'yes' : 'no'} />
                        <InfoRow label="Web build" value={system.web_build_at} />
                        <InfoRow label="Desktop build" value={system.desktop_build_at} />
                        <InfoRow
                            label="Git"
                            value={system.git?.commit ? `${system.git.branch}@${system.git.commit} · ${system.git.dirty_files} changed` : '—'}
                        />
                    </Card>

                    <Card title="Health" icon={Activity}>
                        <ul className="divide-y divide-slate-800">
                            {health.map((check) => (
                                <li key={check.name} className="flex items-center justify-between gap-3 py-2">
                                    <span className="text-sm text-slate-300">{check.name}</span>
                                    <span className="flex items-center gap-2">
                                        <span className="max-w-44 truncate text-xs text-slate-400" title={check.detail}>{check.detail}</span>
                                        <Badge ok={check.ok}>{check.ok ? 'OK' : 'FAIL'}</Badge>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-3 border-t border-slate-800 pt-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Scheduled jobs</p>
                            <ul className="space-y-1.5">
                                {schedule.map((job) => (
                                    <li key={job.name} className="flex items-center justify-between gap-2 text-xs">
                                        <span className="text-slate-300">{job.name}</span>
                                        <span className="flex items-center gap-2">
                                            <span className="text-slate-400">{job.when}</span>
                                            <Badge ok={job.enabled}>{job.enabled ? 'on' : 'off'}</Badge>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Card>

                    <Card title="Actions" icon={Wrench}>
                        <div className="space-y-2">
                            <ActionButton
                                icon={Zap}
                                label="Optimize (build caches)"
                                hint="Faster pages. Warning: breaks php artisan test until cleared."
                                busy={busy}
                                onClick={() => runAction('optimize')}
                            />
                            <ActionButton
                                icon={RefreshCw}
                                label="Clear caches"
                                hint="optimize:clear — run before the test suite."
                                busy={busy}
                                onClick={() => runAction('optimize_clear')}
                            />
                            <ActionButton
                                icon={Play}
                                label="Run migrations (local only)"
                                hint="php artisan migrate against the local DB."
                                busy={busy}
                                onClick={() => runAction('migrate', 'Run pending migrations against the local database?')}
                            />
                            <ActionButton
                                icon={Send}
                                label="Test Slack webhook"
                                hint="Sends one test message to the configured channel."
                                busy={busy}
                                onClick={() => runAction('slack_test', 'Send a test message to Slack?')}
                            />
                            <ActionButton
                                icon={Database}
                                label="Test screenshot storage"
                                hint="Writes, reads, signs, and deletes a probe file (S3 or local)."
                                busy={busy}
                                onClick={() => runAction('s3_test')}
                            />
                            <ActionButton
                                icon={FileText}
                                label="Preview activity digest"
                                hint="Builds yesterday's digest text without sending."
                                busy={busy}
                                onClick={() => runAction('digest_preview')}
                            />
                            <ActionButton
                                icon={Trash2}
                                label="Screenshot retention dry-run"
                                hint="Shows what the nightly prune would delete."
                                busy={busy}
                                onClick={() => runAction('prune_dry_run')}
                            />
                        </div>
                    </Card>
                </div>

                <Card title="Integration credentials" icon={KeyRound}>
                    <p className="mb-4 text-xs text-slate-400">
                        Edit Slack and S3 settings without touching the server. Secret fields are write-only —
                        they show whether a value is set, never the value itself. Leave a secret blank to keep
                        the current one. Saving reloads the config automatically.
                    </p>
                    <div className="grid gap-5 lg:grid-cols-2">
                        {(envGroups || []).map((group) => (
                            <div key={group.key} className="rounded-lg border border-slate-800 p-4">
                                <h3 className="mb-3 text-sm font-semibold text-slate-100">{group.label}</h3>
                                <div className="space-y-3">
                                    {group.fields.map((field) => (
                                        <div key={field.key}>
                                            <label className="flex items-center justify-between text-xs font-medium text-slate-400">
                                                <span>{field.label}</span>
                                                {field.type === 'secret' && (
                                                    <span className={field.is_set ? 'text-emerald-400' : 'text-slate-500'}>
                                                        {field.is_set ? 'set' : 'not set'}
                                                    </span>
                                                )}
                                            </label>
                                            <div className="mt-1">
                                                {field.type === 'bool' ? (
                                                    <select
                                                        value={envDraft[field.key] ? 'true' : 'false'}
                                                        onChange={(e) => setEnvField(field.key, e.target.value === 'true')}
                                                        className="w-full rounded border-slate-700 bg-slate-900 text-sm text-slate-200 [color-scheme:dark] focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                                                    >
                                                        <option value="true">Enabled</option>
                                                        <option value="false">Disabled</option>
                                                    </select>
                                                ) : field.type === 'select' ? (
                                                    <select
                                                        value={envDraft[field.key] ?? ''}
                                                        onChange={(e) => setEnvField(field.key, e.target.value)}
                                                        className="w-full rounded border-slate-700 bg-slate-900 text-sm text-slate-200 [color-scheme:dark] focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                                                    >
                                                        {field.options.map((opt) => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type={field.type === 'secret' ? 'password' : 'text'}
                                                        value={envDraft[field.key] ?? ''}
                                                        onChange={(e) => setEnvField(field.key, e.target.value)}
                                                        placeholder={field.type === 'secret' ? (field.is_set ? '•••••••• (leave blank to keep)' : 'not set') : (field.placeholder || '')}
                                                        autoComplete="off"
                                                        className="w-full rounded border-slate-700 bg-slate-900 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={saveEnv}
                            disabled={savingEnv}
                            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                        >
                            <KeyRound className="h-4 w-4" />
                            {savingEnv ? 'Saving…' : 'Save credentials'}
                        </button>
                        <span className="text-xs text-slate-400">After saving, use “Test screenshot storage” / “Test Slack webhook” above to verify.</span>
                    </div>
                </Card>

                <Card title="Branding" icon={ImageIcon}>
                    <div className="flex flex-wrap items-center gap-5">
                        <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 p-2">
                            <img
                                src={branding?.logo_url || '/images/sparking-asia-logo.png?v=2'}
                                alt="Current logo"
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="mb-2 text-xs text-slate-400">
                                App logo shown in the navigation, login, and welcome pages. Stored on S3 so
                                deploys can't wipe it. PNG/JPG/WebP, max 1&nbsp;MB — a square image works best.
                            </p>
                            <div className="flex items-center gap-3">
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                                    className="text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-200 hover:file:bg-slate-700"
                                />
                                <button
                                    type="button"
                                    onClick={uploadLogo}
                                    disabled={!logoFile || uploadingLogo}
                                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                                >
                                    {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                                </button>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card title="Diagnostics — recent errors & events" icon={Activity}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                            {Object.entries(diag.counts).length === 0 && (
                                <span className="text-xs text-slate-400">Nothing captured yet.</span>
                            )}
                            {Object.entries(diag.counts).map(([cat, n]) => (
                                <span key={cat} className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                                    {cat} <b className="text-slate-100">{n}</b>
                                </span>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={loadDiag}
                            disabled={diagLoading}
                            className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                            <RefreshCw className={['h-3 w-3', diagLoading ? 'animate-spin' : ''].join(' ')} />
                            Refresh
                        </button>
                    </div>
                    <div className="max-h-80 divide-y divide-slate-800 overflow-auto rounded bg-slate-900">
                        {diag.recent.length === 0 ? (
                            <p className="p-3 text-xs text-slate-500">{diagLoading ? 'Loading…' : 'No events captured — no errors. 👍'}</p>
                        ) : diag.recent.map((e, i) => {
                            const severe = e.level === 'error' || e.category === 'errors';
                            const warnish = e.level === 'warn';
                            const chip = severe
                                ? 'bg-rose-500/15 text-rose-300'
                                : warnish ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-700/40 text-slate-300';
                            return (
                                <div key={i} className="flex items-start gap-2 p-2.5">
                                    <span className={['mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold', chip].join(' ')}>{e.category}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="break-words font-mono text-[11px] leading-snug text-slate-200">{e.summary}</p>
                                        <p className="text-[10px] text-slate-500">{e.captured_at}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">Full detail over SSH: <code className="text-slate-300">php artisan diagnostics &lt;category&gt; --full</code></p>
                </Card>

                <Card title={`Logs ${logFile ? `— ${logFile}` : ''}`} icon={AlertTriangle}>
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs text-slate-400">Last 300 lines of the newest log file.</p>
                        <button
                            type="button"
                            onClick={loadLogs}
                            disabled={logsLoading}
                            className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                            <RefreshCw className={['h-3 w-3', logsLoading ? 'animate-spin' : ''].join(' ')} />
                            Refresh
                        </button>
                    </div>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
                        {logLines.length ? logLines.join('\n') : (logsLoading ? 'Loading…' : 'No log entries.')}
                    </pre>
                </Card>
            </div>
            </div>
        </AuthenticatedLayout>
    );
}
