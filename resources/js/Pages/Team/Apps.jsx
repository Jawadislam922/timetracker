import React from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Globe, Laptop, Users } from 'lucide-react';

function fmtHm(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

const RANGES = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
];

function UsageTable({ title, icon: Icon, rows, emptyLabel }) {
    const max = Math.max(...rows.map((r) => r.total_seconds || 0), 1);
    return (
        <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <Icon className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            </div>
            {rows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">{emptyLabel}</p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {rows.map((row) => (
                        <li key={row.name} className="space-y-1.5 px-4 py-2.5">
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="min-w-0 truncate font-medium text-slate-800" title={row.name}>{row.name}</span>
                                <span className="shrink-0 font-mono text-slate-900">{fmtHm(row.total_seconds)}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full bg-emerald-400" style={{ width: `${Math.max(2, Math.round((row.total_seconds / max) * 100))}%` }} />
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {row.user_count}</span>
                                {row.top_user && <span>Most: {row.top_user}</span>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function TeamApps({ auth, range, start, end, userId, users, apps, urls, totals }) {
    const reload = (params) => {
        router.get(route('team.apps'), { range, user_id: userId || undefined, ...params }, { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-xl font-semibold text-slate-900">Team Performance</h2>}>
            <Head title="Team Apps & URLs" />

            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
                <div className="overflow-hidden rounded-lg bg-white shadow">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                        <div className="flex items-center gap-1">
                            <Link
                                href={route('team.index')}
                                className="rounded-md px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
                            >
                                Members
                            </Link>
                            <span className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white shadow-sm">
                                Apps &amp; URLs
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <select
                                value={userId || ''}
                                onChange={(e) => reload({ user_id: e.target.value || undefined })}
                                className="rounded border-slate-200 text-xs"
                            >
                                <option value="">Everyone</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                            <div className="flex items-center gap-1">
                                {RANGES.map((r) => (
                                    <button
                                        key={r.value}
                                        type="button"
                                        onClick={() => reload({ range: r.value })}
                                        className={[
                                            'rounded-md border px-2 py-1 text-xs transition',
                                            range === r.value
                                                ? 'border-slate-900 bg-slate-900 text-white'
                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                                        ].join(' ')}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
                        <span>{start} → {end}</span>
                        <span>· {totals.people} {totals.people === 1 ? 'person' : 'people'} sampled</span>
                        <span>· ~{fmtHm(totals.tracked_seconds)} of sampled activity</span>
                        <span className="text-slate-400">Times are estimates from activity samples.</span>
                    </div>

                    <div className="grid grid-cols-1 gap-5 px-5 py-5 lg:grid-cols-2">
                        <UsageTable title="Applications" icon={Laptop} rows={apps} emptyLabel="No app activity in this range." />
                        <UsageTable title="Websites" icon={Globe} rows={urls} emptyLabel="No browser activity in this range." />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
