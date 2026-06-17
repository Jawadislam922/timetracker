import React, { useEffect, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Avatar from '@/Components/Avatar';
import { ChevronLeft, ChevronRight, Eye, Search, Send } from 'lucide-react';

function fmtHm(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

let DISPLAY = { timezone: 'Asia/Karachi', format: '12' };

function fmtRelative(iso) {
    if (!iso) return '—';
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    try {
        return new Date(iso).toLocaleDateString('en-US', { timeZone: DISPLAY.timezone, month: 'short', day: 'numeric' });
    } catch {
        return new Date(iso).toLocaleDateString();
    }
}

function activityClass(percent) {
    if (percent >= 60) return 'bg-emerald-500';
    if (percent >= 30) return 'bg-amber-400';
    return 'bg-slate-600';
}

function shiftDate(iso, delta) {
    const d = new Date(iso);
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
}

export default function TeamIndex({ auth, date, rows, totals, permissions, slack }) {
    DISPLAY = usePage().props.display || DISPLAY;
    const [activeDate, setActiveDate] = useState(date);
    const [sending, setSending] = useState(false);
    const [query, setQuery] = useState('');
    const [nowTs, setNowTs] = useState(Date.now());
    const flash = usePage().props.flash || {};
    const canViewReports = auth.user?.is_super_admin || auth.user?.permissions?.includes('reports.view');

    // Tick once a second so a Live member's tracked time counts up in place
    // instead of sitting frozen at the last server render.
    useEffect(() => {
        const t = setInterval(() => setNowTs(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const q = query.trim().toLowerCase();
    const visibleRows = q
        ? rows.filter((r) => r.name.toLowerCase().includes(q) || (r.designation || '').toLowerCase().includes(q))
        : rows;

    // For a live row, show the running session age so "Live" never reads 0m.
    const trackedSecondsFor = (row) =>
        row.is_live && row.live?.started_at
            ? Math.max(row.total_seconds, Math.floor((nowTs - new Date(row.live.started_at).getTime()) / 1000))
            : row.total_seconds;

    const reload = (nextDate) => {
        router.get(route('team.index'), { date: nextDate }, {
            preserveScroll: true,
            onSuccess: (page) => setActiveDate(page.props.date),
        });
    };

    const sendDigest = () => {
        if (!confirm(`Send activity digest for ${activeDate} to Slack?`)) return;
        setSending(true);
        router.post(
            route('team.slack-digest'),
            { date: activeDate },
            {
                preserveScroll: true,
                onFinish: () => setSending(false),
            }
        );
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-xl font-semibold text-slate-900">Team Performance</h2>}>
            <Head title="Team Performance" />

            <div className="min-h-screen bg-slate-950">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
                {flash.success && (
                    <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
                        {flash.success}
                    </div>
                )}
                {flash.error && (
                    <div className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
                        {flash.error}
                    </div>
                )}
                <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1">
                                <span className="rounded-md bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm">Members</span>
                                <Link
                                    href={route('team.apps')}
                                    className="rounded-md px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
                                >
                                    Apps &amp; URLs
                                </Link>
                            </div>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-500" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search member…"
                                    className="w-44 rounded-md border border-slate-700 bg-slate-900 py-1 pl-7 pr-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                                {totals.people_live} live now
                            </span>
                            <span className="text-xs text-slate-400">
                                {totals.people_with_time} of {totals.team_size} tracked time · {fmtHm(totals.day)} total
                            </span>
                            {slack?.daily_enabled && (
                                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-300" title={`Auto-posts daily at ${slack.daily_time}`}>
                                    Daily Slack digest on
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            {permissions?.send_slack && slack?.configured && (
                                <button
                                    type="button"
                                    onClick={sendDigest}
                                    disabled={sending}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                                >
                                    <Send className="h-3 w-3" />
                                    {sending ? 'Sending…' : 'Send Slack digest'}
                                </button>
                            )}
                            <button type="button" onClick={() => reload(shiftDate(activeDate, -1))} className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Previous day">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <input
                                type="date"
                                value={activeDate}
                                onChange={(e) => reload(e.target.value)}
                                className="rounded border-slate-700 bg-slate-900 text-xs text-slate-200 [color-scheme:dark]"
                            />
                            <button type="button" onClick={() => reload(shiftDate(activeDate, 1))} className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Next day">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => reload(new Date().toISOString().slice(0, 10))} className="ml-2 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">
                                Today
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-800 text-sm">
                            <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-400">
                                <tr>
                                    <th className="px-4 py-2 text-left">Member</th>
                                    <th className="px-4 py-2 text-left">Status</th>
                                    <th className="px-4 py-2 text-right">Tracked</th>
                                    <th className="px-4 py-2 text-left">Activity</th>
                                    <th className="px-4 py-2 text-left">Top client</th>
                                    <th className="px-4 py-2 text-left">Top app</th>
                                    <th className="px-4 py-2 text-left">Last seen</th>
                                    <th className="px-4 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {visibleRows.map((row) => (
                                    <tr key={row.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3">
                                            {canViewReports ? (
                                                <Link
                                                    href={route('work-hours.report', { userIds: [row.id] })}
                                                    className="group flex items-center gap-3"
                                                    title={`View ${row.name}'s report`}
                                                >
                                                    <Avatar user={{ name: row.name, avatar_url: row.avatar_url }} size="sm" />
                                                    <div className="min-w-0">
                                                        <div className="truncate font-medium text-slate-100 group-hover:text-orange-400 group-hover:underline">{row.name}</div>
                                                        {row.designation && (
                                                            <div className="truncate text-[11px] text-slate-400">{row.designation}</div>
                                                        )}
                                                    </div>
                                                </Link>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <Avatar user={{ name: row.name, avatar_url: row.avatar_url }} size="sm" />
                                                    <div className="min-w-0">
                                                        <div className="truncate font-medium text-slate-100">{row.name}</div>
                                                        {row.designation && (
                                                            <div className="truncate text-[11px] text-slate-400">{row.designation}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.is_live ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                                    </span>
                                                    Live
                                                </span>
                                            ) : row.total_seconds > 0 ? (
                                                <span className="text-xs text-slate-400">Tracked earlier</span>
                                            ) : (
                                                <span className="text-xs text-slate-500">Idle</span>
                                            )}
                                            {row.is_live && row.live?.client && (
                                                <div className="mt-1 text-[11px] text-slate-400 truncate max-w-[220px]">{row.live.client}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-100">
                                            {fmtHm(trackedSecondsFor(row))}
                                            {row.manual_seconds > 0 && (
                                                <div className="text-[10px] font-sans text-amber-300/90" title="Manually logged work-diary hours — count as time but 0% activity">
                                                    {fmtHm(row.manual_seconds)} manual
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                                                    <div className={['h-full', activityClass(row.activity_percent)].join(' ')} style={{ width: `${Math.min(100, row.activity_percent)}%` }} />
                                                </div>
                                                <span className="text-xs text-slate-300">{row.activity_percent}%</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-300">
                                            {row.top_client ? (
                                                <span>{row.top_client.name} <span className="text-slate-500">· {fmtHm(row.top_client.total_seconds)}</span></span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-300">{row.top_app || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-slate-400">{fmtRelative(row.last_heartbeat_at)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                href={route('timeline.index', { user_id: row.id, date: activeDate })}
                                                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                                            >
                                                <Eye className="h-3 w-3" /> Timeline
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {visibleRows.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                                            {q ? `No members match “${query}”.` : 'No team members tracked today.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            </div>
        </AuthenticatedLayout>
    );
}
