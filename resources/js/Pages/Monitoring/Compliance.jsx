import { useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import { ShieldAlert, ShieldCheck, Monitor, Puzzle, Package, Cpu, Wifi, ChevronRight, Search } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

const SEV = {
    critical: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    high: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    warn: 'bg-slate-600/30 text-slate-300 border-slate-600/40',
};
const KIND_ICON = { extensions: Puzzle, programs: Package, processes: Cpu, network: Wifi };

export default function Compliance({ auth, machines = [], flags = [], extensions = [], summary = {}, lastReport }) {
    const clean = (summary.flagged_machines || 0) === 0;
    const [extQuery, setExtQuery] = useState('');
    const [openExt, setOpenExt] = useState(null);

    const shownExtensions = useMemo(() => {
        const q = extQuery.trim().toLowerCase();
        return q ? extensions.filter((e) => e.name.toLowerCase().includes(q)) : extensions;
    }, [extensions, extQuery]);

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-xl font-semibold text-slate-100">Machine Compliance</h2>}>
            <Head title="Machine Compliance" />
            <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
                <p className="text-sm text-slate-400">
                    What&apos;s installed and running on each PC, matched against known automation / VPN tools that can get an Upwork profile flagged.
                    {lastReport && <span className="ml-1 text-slate-500">Last report {lastReport}.</span>}
                </p>

                {/* Summary */}
                <div className="grid gap-3 sm:grid-cols-3">
                    <Tile icon={Monitor} label="Machines reporting" value={summary.machines || 0} tone="slate" />
                    <Tile icon={clean ? ShieldCheck : ShieldAlert} label="Machines flagged"
                        value={summary.flagged_machines || 0} tone={clean ? 'green' : 'rose'} />
                    <Tile icon={ShieldAlert} label="Flagged items" value={summary.flags || 0} tone={summary.flags ? 'amber' : 'slate'} />
                </div>

                {/* Flagged items — the money view */}
                <section className="rounded-lg border border-slate-800 bg-slate-900">
                    <div className="border-b border-slate-800 px-5 py-3">
                        <h3 className="font-semibold text-white">Flagged items</h3>
                        <p className="text-xs text-slate-400">Automation, scrapers, jigglers and VPNs found on any machine — review and remove.</p>
                    </div>
                    {flags.length === 0 ? (
                        <p className="px-5 py-8 text-center text-sm text-slate-500">
                            {summary.machines ? 'No automation/VPN tools found on any reporting machine. 👍' : 'No machines have reported yet — they report within ~an hour of updating to 0.4.4.'}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                                    <tr className="border-b border-slate-800">
                                        <th className="px-5 py-2 font-medium">Severity</th>
                                        <th className="px-3 py-2 font-medium">Item</th>
                                        <th className="px-3 py-2 font-medium">Type</th>
                                        <th className="px-3 py-2 font-medium">Person</th>
                                        <th className="px-3 py-2 font-medium">Machine</th>
                                        <th className="px-5 py-2 font-medium">Seen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {flags.map((f, i) => (
                                        <tr key={i} className="hover:bg-slate-800/40">
                                            <td className="px-5 py-2">
                                                <span className={['rounded border px-2 py-0.5 text-[11px] font-semibold uppercase', SEV[f.severity] || SEV.warn].join(' ')}>
                                                    {f.severity}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 font-medium text-slate-100">{f.item}</td>
                                            <td className="px-3 py-2 text-slate-400">{f.rule} · {f.kind}</td>
                                            <td className="px-3 py-2 text-slate-300">{f.user || '—'}</td>
                                            <td className="px-3 py-2 font-mono text-xs text-slate-300">{f.device}</td>
                                            <td className="px-5 py-2 text-xs text-slate-500">{f.seen || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Extensions across the team */}
                <section className="rounded-lg border border-slate-800 bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-5 py-3">
                        <div>
                            <h3 className="font-semibold text-white">Browser extensions</h3>
                            <p className="text-xs text-slate-400">Every extension across all machines — flagged first. Click one to see who has it.</p>
                        </div>
                        <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-1.5">
                            <Search className="h-3.5 w-3.5 text-slate-500" />
                            <input value={extQuery} onChange={(e) => setExtQuery(e.target.value)} placeholder="Search extensions…"
                                className="w-44 border-0 bg-transparent p-0 text-sm text-slate-200 placeholder-slate-500 focus:ring-0" />
                        </label>
                    </div>
                    {extensions.length === 0 ? (
                        <p className="px-5 py-8 text-center text-sm text-slate-500">No extension inventory yet — machines report within ~an hour of updating.</p>
                    ) : (
                        <div className="divide-y divide-slate-800">
                            {shownExtensions.map((e, i) => {
                                const open = openExt === e.name;
                                return (
                                    <div key={i}>
                                        <button type="button" onClick={() => setOpenExt(open ? null : e.name)}
                                            className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-slate-800/40">
                                            <ChevronRight className={['h-4 w-4 shrink-0 text-slate-500 transition-transform', open ? 'rotate-90' : ''].join(' ')} />
                                            <Puzzle className={['h-4 w-4 shrink-0', e.flagged ? 'text-rose-400' : 'text-slate-500'].join(' ')} />
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{e.name}</span>
                                            {e.flagged && (
                                                <span className={['rounded border px-2 py-0.5 text-[10px] font-semibold uppercase', SEV[e.severity] || SEV.warn].join(' ')}>
                                                    {e.rule}
                                                </span>
                                            )}
                                            <span className="shrink-0 text-xs text-slate-400">{e.people} {e.people === 1 ? 'person' : 'people'}</span>
                                        </button>
                                        {open && (
                                            <div className="bg-slate-950/40 px-5 pb-3 pl-12">
                                                <table className="w-full text-xs">
                                                    <tbody className="divide-y divide-slate-800/60">
                                                        {e.users.map((u, j) => (
                                                            <tr key={j}>
                                                                <td className="py-1.5 pr-3 text-slate-200">{u.user || '—'}</td>
                                                                <td className="py-1.5 pr-3 font-mono text-slate-400">{u.device}</td>
                                                                <td className="py-1.5 pr-3 text-slate-500">{u.browser}</td>
                                                                <td className="py-1.5 text-slate-500">{u.enabled === false ? 'disabled' : 'enabled'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {shownExtensions.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">No extensions match “{extQuery}”.</p>}
                        </div>
                    )}
                </section>

                {/* Machines */}
                <section className="rounded-lg border border-slate-800 bg-slate-900">
                    <div className="border-b border-slate-800 px-5 py-3">
                        <h3 className="font-semibold text-white">Machines</h3>
                        <p className="text-xs text-slate-400">Every PC that has reported its inventory, flagged first.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                                <tr className="border-b border-slate-800">
                                    <th className="px-5 py-2 font-medium">Machine</th>
                                    <th className="px-3 py-2 font-medium">Person</th>
                                    <th className="px-3 py-2 font-medium">Flags</th>
                                    <th className="px-3 py-2 font-medium">Inventory</th>
                                    <th className="px-3 py-2 font-medium">App</th>
                                    <th className="px-5 py-2 font-medium">Last report</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {machines.length === 0 ? (
                                    <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No machines reporting yet.</td></tr>
                                ) : machines.map((m, i) => (
                                    <tr key={i} className={['hover:bg-slate-800/40', m.flagged_count ? 'bg-rose-500/5' : ''].join(' ')}>
                                        <td className="px-5 py-2 font-mono text-xs font-semibold text-slate-100">{m.device}</td>
                                        <td className="px-3 py-2 text-slate-300">{m.user || '—'}</td>
                                        <td className="px-3 py-2">
                                            {m.flagged_count ? (
                                                <span className="rounded bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300">{m.flagged_count}</span>
                                            ) : <span className="text-xs text-emerald-400">clean</span>}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                                                {Object.entries(m.counts || {}).map(([k, n]) => {
                                                    const Icon = KIND_ICON[k];
                                                    return <span key={k} className="inline-flex items-center gap-1">{Icon && <Icon className="h-3 w-3" />}{n}</span>;
                                                })}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{m.app_version || '—'}</td>
                                        <td className="px-5 py-2 text-xs text-slate-500">{m.last_seen || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

function Tile({ icon: Icon, label, value, tone }) {
    const tones = {
        slate: 'text-slate-300', green: 'text-emerald-400', rose: 'text-rose-400', amber: 'text-amber-400',
    };
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <Icon className={['h-4 w-4', tones[tone]].join(' ')} /> {label}
            </div>
            <div className={['mt-1 text-2xl font-bold', tones[tone]].join(' ')}>{value}</div>
        </div>
    );
}
