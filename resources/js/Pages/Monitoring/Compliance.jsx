import { useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    ShieldAlert, ShieldCheck, Monitor, Puzzle, Search, ChevronRight, Trash2,
    Check, BellOff, RotateCcw, Eye, User, Chrome,
} from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

const SEV = {
    critical: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    high: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    medium: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    low: 'bg-slate-600/30 text-slate-300 border-slate-600/40',
};
// Plain language — you shouldn't need to know my internal category names.
const RULE_LABEL = {
    upwork_refresh_bid: 'Auto-refresh / bidding bot',
    scraper: 'Scraper',
    jiggler_autoclicker: 'Jiggler / auto-clicker',
    antidetect_browser: 'Antidetect browser',
    vpn_proxy: 'VPN / proxy',
    automation_framework: 'Dev automation (watch only)',
};

const VIEWS = [
    ['action', 'Needs action'],
    ['people', 'By employee'],
    ['software', 'By extension'],
    ['machines', 'Machines'],
];

export default function Compliance({ auth, tools = [], machines = [], employees = [], extensions = [], summary = {}, lastReport }) {
    const [view, setView] = useState('action'); // action | people | software | machines
    const [query, setQuery] = useState('');
    const [cat, setCat] = useState('all'); // all | ban | watch
    const [openTool, setOpenTool] = useState(null);
    const [openEmp, setOpenEmp] = useState(null);
    const [openProfile, setOpenProfile] = useState(null);
    const [openExt, setOpenExt] = useState(null);
    const [busy, setBusy] = useState(null);

    const shownTools = useMemo(() => {
        const q = query.trim().toLowerCase();
        return tools.filter((t) => (cat === 'all' || t.category === cat)
            && (!q || t.name.toLowerCase().includes(q) || (RULE_LABEL[t.rule] || t.rule).toLowerCase().includes(q)));
    }, [tools, query, cat]);

    const shownEmployees = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q
            ? employees.filter((e) => (e.user || '').toLowerCase().includes(q)
                || e.extensions.some((x) => x.name.toLowerCase().includes(q)))
            : employees;
    }, [employees, query]);

    const filterExts = (list) => {
        const q = query.trim().toLowerCase();
        if (!q) return list;
        const m = list.filter((x) => x.name.toLowerCase().includes(q));
        return m.length ? m : list; // employee matched by name → show all their extensions
    };

    // Searching narrows to the profiles that actually contain a match, and drops
    // the extensions inside them that don't — so "scraper" answers "which of this
    // person's 26 profiles has a scraper" instead of listing all 26.
    const filterProfiles = (list) => {
        const q = query.trim().toLowerCase();
        if (!q) return list;
        const hits = list
            .map((p) => ({ ...p, extensions: p.extensions.filter((x) => x.name.toLowerCase().includes(q)) }))
            .filter((p) => p.extensions.length
                || (p.profile || '').toLowerCase().includes(q)
                || (p.device || '').toLowerCase().includes(q));
        return hits.length ? hits : list; // matched on the person's name → show everything
    };

    const shownExtensions = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? extensions.filter((e) => e.name.toLowerCase().includes(q)) : extensions;
    }, [extensions, query]);

    // `ids` covers every browser profile this row represents, so one click clears
    // the tool for that person instead of once per profile. The server re-scopes the
    // list to the same person/machine/tool, so it can't reach another machine.
    const setStatus = (flagId, status, ids) => {
        setBusy(flagId);
        // Partial reload: only refresh the cheap ledger-backed props. The heavy
        // extension/employee inventories are skipped, so the button is snappy and
        // the expanded rows stay put (preserveState).
        router.patch(route('monitoring.compliance.flag', flagId), { status, ids: ids || [] }, {
            preserveScroll: true, preserveState: true, only: ['tools', 'summary', 'machines'],
            onFinish: () => setBusy(null),
        });
    };

    const deleteMachine = (m) => {
        if (!window.confirm(`Delete all compliance history for ${m.user || 'this user'} on ${m.device}? This can't be undone.`)) return;
        router.delete(route('monitoring.compliance.machine.destroy'), {
            data: { user_id: m.user_id, device_name: m.device_name }, preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-xl font-semibold text-slate-100">Machine Compliance</h2>}>
            <Head title="Machine Compliance" />
            <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <p className="text-sm text-slate-400">
                    What&apos;s installed on each PC, matched against tools that can get an Upwork profile flagged. Auto-refresh
                    bots, scrapers, jigglers, antidetect browsers and VPNs raise an alert; dev automation tooling is watch-only.
                    {lastReport && <span className="ml-1 text-slate-500">Last report {lastReport}.</span>}
                </p>

                {summary.outdated_agents > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                            <strong>{summary.outdated_agents}</strong> machine{summary.outdated_agents === 1 ? '' : 's'} still
                            run an agent older than {summary.min_agent}, which could not report browser extensions at all.
                            Treat an empty extension list from those as <em>unknown</em>, not clean — they update automatically
                            when the tracker next starts.
                        </span>
                    </div>
                )}

                {/* Summary */}
                <div className="grid gap-3 sm:grid-cols-3">
                    <Tile icon={Monitor} label="Machines reporting" value={summary.machines || 0} tone="slate" />
                    <Tile icon={summary.open_alerts ? ShieldAlert : ShieldCheck} label="Open alerts (banning tools)"
                        value={summary.open_alerts || 0} tone={summary.open_alerts ? 'rose' : 'green'} />
                    <Tile icon={Eye} label="Watch items (VPN / automation)" value={summary.watch || 0} tone={summary.watch ? 'amber' : 'slate'} />
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-1.5">
                        <Search className="h-3.5 w-3.5 text-slate-500" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tools & extensions…"
                            className="w-56 border-0 bg-transparent p-0 text-sm text-slate-200 placeholder-slate-500 focus:ring-0" />
                    </label>
                    <div className="flex rounded-lg border border-slate-700 bg-slate-800/60 p-0.5 text-sm">
                        {[['all', 'All'], ['ban', 'Banning'], ['watch', 'Watch']].map(([k, label]) => (
                            <button key={k} type="button" onClick={() => setCat(k)}
                                className={['rounded-md px-3 py-1 font-medium transition', cat === k ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'].join(' ')}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* One view at a time — the page answers a single question instead of
                    being one long scroll of four overlapping lists. */}
                <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
                    {VIEWS.map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setView(key)}
                            className={['rounded-md px-4 py-2 text-sm font-medium transition',
                                view === key ? 'bg-orange-500/15 text-orange-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'].join(' ')}
                        >
                            {label}
                            {key === 'action' && summary.open_alerts > 0 && (
                                <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-rose-300">{summary.open_alerts}</span>
                            )}
                        </button>
                    ))}
                </div>

                {view === 'action' && (
                <section className="rounded-lg border border-slate-800 bg-slate-900">
                    <div className="border-b border-slate-800 px-5 py-3">
                        <h3 className="font-semibold text-white">Flagged tools</h3>
                        <p className="text-xs text-slate-400">One row per tool. Click to see every person/PC that has it, then Acknowledge or Ignore.</p>
                    </div>
                    {shownTools.length === 0 ? (
                        <p className="px-5 py-8 text-center text-sm text-slate-500">
                            {tools.length ? 'Nothing matches your filter.' : 'No flagged tools on any reporting machine. 👍'}
                        </p>
                    ) : (
                        <div className="divide-y divide-slate-800">
                            {shownTools.map((t) => {
                                const key = t.rule + '|' + t.name;
                                const open = openTool === key;
                                return (
                                    <div key={key}>
                                        <button type="button" onClick={() => setOpenTool(open ? null : key)}
                                            className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-slate-800/40">
                                            <ChevronRight className={['h-4 w-4 shrink-0 text-slate-500 transition-transform', open ? 'rotate-90' : ''].join(' ')} />
                                            <span className={['rounded border px-2 py-0.5 text-[10px] font-semibold uppercase', SEV[t.severity] || SEV.low].join(' ')}>
                                                {t.severity}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{t.name}</span>
                                            {!t.alert && <span className="shrink-0 rounded bg-slate-700/50 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">watch</span>}
                                            <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{RULE_LABEL[t.rule] || t.rule}</span>
                                            <span className="shrink-0 text-xs text-slate-400">{t.people} {t.people === 1 ? 'person' : 'people'}</span>
                                        </button>
                                        {open && (
                                            <div className="bg-slate-950/40 px-5 pb-3 pl-12">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                                                            <th className="py-1 pr-3 font-medium">Signed in as</th>
                                                            <th className="py-1 pr-3 font-medium">On PC</th>
                                                            <th className="py-1 pr-3 font-medium">In profile</th>
                                                            <th className="py-1 pr-3 font-medium">Still there on</th>
                                                            <th className="py-1 pr-3 font-medium">Status</th>
                                                            <th className="py-1 font-medium"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800/60">
                                                        {t.occurrences.map((o) => (
                                                            <tr key={o.id}>
                                                                <td className="py-1.5 pr-3 text-slate-200">{o.user || '—'}</td>
                                                                <td className="py-1.5 pr-3 font-mono text-slate-400">{o.device}</td>
                                                                <td className="py-1.5 pr-3">
                                                                    <ProfileList profiles={o.profiles} unknown={o.unknown_profiles} />
                                                                </td>
                                                                {/* LAST seen, not first seen: this date moves every time the tool
                                                                    is still found, so today's date means it is still on that PC
                                                                    today — i.e. they were told to remove it and haven't. */}
                                                                <td className="py-1.5 pr-3 whitespace-nowrap">
                                                                    <DateSeen iso={o.last_seen} firstSeen={o.first_seen} />
                                                                </td>
                                                                <td className="py-1.5 pr-3">
                                                                    {o.status === 'acknowledged'
                                                                        ? <span className="text-emerald-400">acknowledged</span>
                                                                        : <span className="text-amber-400">open</span>}
                                                                </td>
                                                                <td className="py-1.5 text-right">
                                                                    <div className="inline-flex gap-1">
                                                                        {o.status !== 'acknowledged' && (
                                                                            <ActionBtn disabled={busy === o.id} onClick={() => setStatus(o.id, 'acknowledged', o.ids)} icon={Check}
                                                                                title={`Acknowledge — seen, stay quiet${o.ids?.length > 1 ? ` (all ${o.ids.length} profiles)` : ''}`} />
                                                                        )}
                                                                        {o.status === 'acknowledged' && (
                                                                            <ActionBtn disabled={busy === o.id} onClick={() => setStatus(o.id, 'open', o.ids)} icon={RotateCcw} title="Reopen" />
                                                                        )}
                                                                        <ActionBtn disabled={busy === o.id} onClick={() => setStatus(o.id, 'ignored', o.ids)} icon={BellOff}
                                                                            title={`Ignore on this PC — never alert again${o.ids?.length > 1 ? ` (all ${o.ids.length} profiles)` : ''}`} danger />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                )}

                {view === 'machines' && (
                <section className="rounded-lg border border-slate-800 bg-slate-900">
                    <div className="border-b border-slate-800 px-5 py-3">
                        <h3 className="font-semibold text-white">Machines</h3>
                        <p className="text-xs text-slate-400">Every PC that reported, its app version and when. Delete clears that PC&apos;s history.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                                <tr className="border-b border-slate-800">
                                    <th className="px-5 py-2 font-medium">Machine</th>
                                    <th className="px-3 py-2 font-medium">Person</th>
                                    <th className="px-3 py-2 font-medium">Alerts</th>
                                    <th className="px-3 py-2 font-medium">App</th>
                                    <th className="px-3 py-2 font-medium">Last report</th>
                                    <th className="px-5 py-2 font-medium" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {machines.length === 0 ? (
                                    <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No machines reporting yet.</td></tr>
                                ) : machines.map((m, i) => (
                                    <tr key={i} className={['hover:bg-slate-800/40', m.open_alerts ? 'bg-rose-500/5' : ''].join(' ')}>
                                        <td className="px-5 py-2 font-mono text-xs font-semibold text-slate-100">{m.device}</td>
                                        <td className="px-3 py-2 text-slate-300">{m.user || '—'}</td>
                                        <td className="px-3 py-2">
                                            {m.open_alerts ? (
                                                <span className="rounded bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300">{m.open_alerts}</span>
                                            ) : <span className="text-xs text-emerald-400">clean</span>}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{m.app_version || '—'}</td>
                                        <td className="px-3 py-2 text-xs text-slate-500">{m.last_seen || '—'}</td>
                                        <td className="px-5 py-2 text-right">
                                            <ActionBtn onClick={() => deleteMachine(m)} icon={Trash2} title="Delete this machine's history" danger />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                )}

                {view === 'people' && (
                <section className="rounded-lg border border-slate-800 bg-slate-900">
                    <div className="border-b border-slate-800 px-5 py-3">
                        <h3 className="font-semibold text-white">By employee</h3>
                        <p className="text-xs text-slate-400">
                            Pick a person, then a browser profile, to see exactly which extensions live in it.
                            Search a tool name to jump straight to the profiles that have it.
                        </p>
                    </div>
                    {employees.length === 0 ? (
                        <p className="px-5 py-8 text-center text-sm text-slate-500">No employee inventory yet.</p>
                    ) : (
                        <div className="divide-y divide-slate-800">
                            {shownEmployees.map((emp) => {
                                const open = openEmp === emp.user_id;
                                // Extensions are grouped by browser profile; programs have
                                // no profile, so they stay in a flat list underneath.
                                const profiles = open ? filterProfiles(emp.profiles || []) : [];
                                const programs = open ? filterExts((emp.extensions || []).filter((x) => x.kind === 'programs')) : [];
                                return (
                                    <div key={emp.user_id}>
                                        <button type="button" onClick={() => setOpenEmp(open ? null : emp.user_id)}
                                            className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-slate-800/40">
                                            <ChevronRight className={['h-4 w-4 shrink-0 text-slate-500 transition-transform', open ? 'rotate-90' : ''].join(' ')} />
                                            <User className="h-4 w-4 shrink-0 text-slate-500" />
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{emp.user || '—'}</span>
                                            {emp.flagged > 0 && (
                                                <span className="shrink-0 rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-300">{emp.flagged} flagged</span>
                                            )}
                                            <span className="shrink-0 text-xs text-slate-400">
                                                {(emp.profiles || []).length} profiles · {emp.extension_count ?? 0} ext · {emp.program_count ?? 0} programs
                                            </span>
                                        </button>
                                        {open && (
                                            <div className="bg-slate-950/40 px-5 pb-4 pl-12">
                                                {profiles.length === 0 && programs.length === 0 ? (
                                                    <p className="py-2 text-xs text-slate-500">Nothing matches “{query}”.</p>
                                                ) : (
                                                    <div className="max-h-[32rem] space-y-3 overflow-y-auto py-2">
                                                        {profiles.map((p, i) => {
                                                            const pkey = `${emp.user_id}|${p.device}|${p.browser}|${p.profile}`;
                                                            const popen = openProfile === pkey;
                                                            return (
                                                                <div key={i} className="rounded border border-slate-800 bg-slate-900/60">
                                                                    <button type="button" onClick={() => setOpenProfile(popen ? null : pkey)}
                                                                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-800/40">
                                                                        <ChevronRight className={['h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform', popen ? 'rotate-90' : ''].join(' ')} />
                                                                        <Chrome className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                                                        {p.profile ? (
                                                                            <span className="min-w-0 truncate text-xs font-semibold text-slate-100">{p.profile}</span>
                                                                        ) : (
                                                                            <span className="min-w-0 truncate text-xs font-semibold italic text-slate-500" title="This PC runs an agent older than 0.4.8, which cannot report which profile an extension is in — not the same as having no profile.">
                                                                                profile unknown
                                                                            </span>
                                                                        )}
                                                                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500">
                                                                            {p.browser} · {p.device || 'unknown PC'}
                                                                        </span>
                                                                        <span className="ml-auto shrink-0 text-[11px] text-slate-400">
                                                                            {p.flagged > 0 && (
                                                                                <span className="mr-2 rounded bg-rose-500/15 px-1.5 py-0.5 font-semibold text-rose-300">{p.flagged} flagged</span>
                                                                            )}
                                                                            {p.count} ext
                                                                        </span>
                                                                    </button>
                                                                    {popen && (
                                                                        <table className="w-full border-t border-slate-800 text-xs">
                                                                            <tbody className="divide-y divide-slate-800/60">
                                                                                {p.extensions.map((x, j) => (
                                                                                    <tr key={j}>
                                                                                        <td className="py-1.5 pl-9 pr-3">
                                                                                            <span className={x.flagged ? 'font-medium text-amber-300' : 'text-slate-200'}>{x.name}</span>
                                                                                        </td>
                                                                                        <td className="py-1.5 pr-3 whitespace-nowrap text-[10px]">
                                                                                            <DateSeen iso={x.last_seen} />
                                                                                        </td>
                                                                                        <td className="py-1.5 pr-3 text-right">
                                                                                            {x.flagged && (
                                                                                                <span className={['rounded border px-2 py-0.5 text-[10px] font-semibold uppercase', SEV[x.severity] || SEV.low].join(' ')}>
                                                                                                    {RULE_LABEL[x.rule] || x.rule}
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {programs.length > 0 && (
                                                            <div className="rounded border border-slate-800 bg-slate-900/60">
                                                                <div className="border-b border-slate-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                    Installed programs — not tied to a browser profile
                                                                </div>
                                                                <table className="w-full text-xs">
                                                                    <tbody className="divide-y divide-slate-800/60">
                                                                        {programs.map((x, j) => (
                                                                            <tr key={j}>
                                                                                <td className="py-1.5 pl-9 pr-3">
                                                                                    <span className={x.flagged ? 'font-medium text-amber-300' : 'text-slate-200'}>{x.name}</span>
                                                                                </td>
                                                                                <td className="py-1.5 pr-3 text-slate-500">{x.publisher}</td>
                                                                                <td className="py-1.5 pr-3 text-right">
                                                                                    {x.flagged && (
                                                                                        <span className={['rounded border px-2 py-0.5 text-[10px] font-semibold uppercase', SEV[x.severity] || SEV.low].join(' ')}>
                                                                                            {RULE_LABEL[x.rule] || x.rule}
                                                                                        </span>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {shownEmployees.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">No employees match “{query}”.</p>}
                        </div>
                    )}
                </section>

                )}

                {view === 'software' && (
                <section className="rounded-lg border border-slate-800 bg-slate-900">
                    <div className="border-b border-slate-800 px-5 py-3">
                        <h3 className="font-semibold text-white">Browser extensions</h3>
                        <p className="text-xs text-slate-400">Every enabled extension across all machines — flagged first. Click one to see who has it.</p>
                    </div>
                    {extensions.length === 0 ? (
                        <p className="px-5 py-8 text-center text-sm text-slate-500">No extension inventory yet.</p>
                    ) : (
                        <div className="divide-y divide-slate-800">
                            {shownExtensions.map((e, i) => {
                                const open = openExt === e.name;
                                return (
                                    <div key={i}>
                                        <button type="button" onClick={() => setOpenExt(open ? null : e.name)}
                                            className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-slate-800/40">
                                            <ChevronRight className={['h-4 w-4 shrink-0 text-slate-500 transition-transform', open ? 'rotate-90' : ''].join(' ')} />
                                            <Puzzle className={['h-4 w-4 shrink-0', e.flagged ? 'text-amber-400' : 'text-slate-500'].join(' ')} />
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{e.name}</span>
                                            {e.flagged && (
                                                <span className={['rounded border px-2 py-0.5 text-[10px] font-semibold uppercase', SEV[e.severity] || SEV.low].join(' ')}>
                                                    {RULE_LABEL[e.rule] || e.rule}
                                                </span>
                                            )}
                                            <span className="shrink-0 text-xs text-slate-400">
                                                {e.people} {e.people === 1 ? 'person' : 'people'}
                                                {e.profiles > 0 && <span className="text-slate-500"> · {e.profiles} {e.profiles === 1 ? 'profile' : 'profiles'}</span>}
                                            </span>
                                        </button>
                                        {open && (
                                            <div className="bg-slate-950/40 px-5 pb-3 pl-12">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                                                            <th className="py-1 pr-3 font-medium">Signed in as</th>
                                                            <th className="py-1 pr-3 font-medium">On PC</th>
                                                            <th className="py-1 pr-3 font-medium">In profile</th>
                                                            <th className="py-1 font-medium">Browser</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800/60">
                                                        {e.users.map((u, j) => (
                                                            <tr key={j}>
                                                                <td className="py-1.5 pr-3 align-top text-slate-200">{u.user || '—'}</td>
                                                                <td className="py-1.5 pr-3 align-top font-mono text-slate-400">{u.device}</td>
                                                                <td className="py-1.5 pr-3 align-top">
                                                                    <ProfileList profiles={u.profiles} unknown={u.unknown_profiles} max={4} />
                                                                </td>
                                                                <td className="py-1.5 align-top text-slate-500">{u.browser}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {shownExtensions.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">No extensions match “{query}”.</p>}
                        </div>
                    )}
                </section>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

/**
 * The date a tool was LAST seen on a machine — the one that keeps moving.
 *
 * Today's date means it is still installed right now, so if someone was told to
 * remove it yesterday and this still says today, they haven't. "Today" and
 * "Yesterday" are spelled out because that is the distinction being made at a
 * glance; anything older shows the plain date and reads as stale.
 */
function DateSeen({ iso, firstSeen }) {
    if (!iso) return <span className="text-slate-600">—</span>;
    const day = iso.slice(0, 10);
    const today = new Date();
    const t = today.toISOString().slice(0, 10);
    const y = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
    const label = day === t ? 'Today' : day === y ? 'Yesterday' : day;
    return (
        <span className={day === t ? 'font-medium text-amber-300' : 'text-slate-400'}
            title={firstSeen ? `First seen ${firstSeen.slice(0, 10)} · last seen ${iso}` : `Last seen ${iso}`}>
            {label}
        </span>
    );
}

/**
 * The browser profiles one finding covers, on a single line.
 *
 * Someone can have a tool in a dozen profiles, so the first few are named and the
 * rest collapse into "+N more" (full list on hover) — the names are the actionable
 * part, but not at the cost of a cell that wraps to six lines.
 */
function ProfileList({ profiles = [], unknown = 0, max = 3 }) {
    if (!profiles.length && !unknown) {
        return <span className="text-slate-600">—</span>;
    }
    const shown = profiles.slice(0, max);
    const rest = profiles.slice(max);
    return (
        <span className="inline-flex flex-wrap items-center gap-1">
            {shown.map((p) => (
                <span key={p} className="rounded bg-slate-700/40 px-1.5 py-0.5 text-[10px] text-slate-200">{p}</span>
            ))}
            {rest.length > 0 && (
                <span className="cursor-help text-[10px] text-slate-400" title={rest.join(', ')}>
                    +{rest.length} more
                </span>
            )}
            {unknown > 0 && (
                <span className="text-[10px] italic text-slate-600"
                    title="Reported by an agent older than 0.4.8, which cannot tell which profile an extension is in. Not the same as having no profile.">
                    profile unknown
                </span>
            )}
        </span>
    );
}

function ActionBtn({ icon: Icon, title, onClick, danger, disabled }) {
    return (
        <button type="button" title={title} onClick={onClick} disabled={disabled}
            className={['rounded-md border p-1.5 transition disabled:opacity-40',
                danger
                    ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/15'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-700/40'].join(' ')}>
            <Icon className="h-3.5 w-3.5" />
        </button>
    );
}

function Tile({ icon: Icon, label, value, tone }) {
    const tones = { slate: 'text-slate-300', green: 'text-emerald-400', rose: 'text-rose-400', amber: 'text-amber-400' };
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <Icon className={['h-4 w-4', tones[tone]].join(' ')} /> {label}
            </div>
            <div className={['mt-1 text-2xl font-bold', tones[tone]].join(' ')}>{value}</div>
        </div>
    );
}
