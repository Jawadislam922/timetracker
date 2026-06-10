import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ChevronLeft, ChevronRight, Clock, Flag, Globe, History, Laptop, MonitorPlay, Plus, Trash2, X } from 'lucide-react';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SLOTS_PER_HOUR = 10;
const TOTAL_SLOTS = 24 * SLOTS_PER_HOUR;

function fmtHm(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
}

function fmtHour(h) {
    const period = h >= 12 ? 'pm' : 'am';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}${period}`;
}

function activityDot(percent) {
    if (percent >= 60) return 'bg-emerald-500';
    if (percent >= 30) return 'bg-amber-400';
    return 'bg-slate-300';
}

function sessionLabel(session) {
    return session.client_name || session.task_note || 'Untracked';
}

function isoFromDate(date, day) {
    const d = new Date(date);
    d.setDate(day);
    return d.toISOString().slice(0, 10);
}

function shiftDate(iso, deltaDays) {
    const d = new Date(iso);
    d.setDate(d.getDate() + deltaDays);
    return d.toISOString().slice(0, 10);
}

function MonthStrip({ days, onPick }) {
    return (
        <div className="overflow-x-auto">
            <div className="flex min-w-full gap-1 px-2 pb-3 pt-1">
                {days.map((d) => {
                    const has = d.total_seconds > 0;
                    return (
                        <button
                            key={d.date}
                            type="button"
                            onClick={() => onPick(d.date)}
                            className={[
                                'flex w-10 shrink-0 flex-col items-center rounded-md border px-1 py-2 text-xs transition',
                                d.is_selected
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : d.is_today
                                    ? 'border-slate-400 bg-white text-slate-900'
                                    : 'border-transparent text-slate-500 hover:bg-slate-100',
                            ].join(' ')}
                            title={fmtHm(d.total_seconds)}
                        >
                            <span className="text-[10px] uppercase">{d.weekday}</span>
                            <span className="text-base font-semibold leading-none">{d.day}</span>
                            <span className={['mt-1 h-1.5 w-6 rounded-full', has ? 'bg-emerald-400' : 'bg-transparent'].join(' ')} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function HourRuler({ date, bands = [] }) {
    const nowHour = new Date().getHours();
    const isToday = date === new Date().toISOString().slice(0, 10);

    // Build a slot map: 240 slots (24h × 10 per hour), each "active" | "idle" | "quiet".
    const slotMap = useMemo(() => {
        const arr = Array(TOTAL_SLOTS).fill('quiet');
        bands.forEach((b) => {
            if (b.slot >= 0 && b.slot < TOTAL_SLOTS) arr[b.slot] = b.state;
        });
        return arr;
    }, [bands]);

    return (
        <div className="relative mt-3 space-y-1">
            <div className="grid h-3 overflow-hidden rounded-sm" style={{ gridTemplateColumns: `repeat(${TOTAL_SLOTS}, minmax(0, 1fr))` }}>
                {slotMap.map((state, i) => (
                    <div
                        key={i}
                        className={[
                            'h-full',
                            state === 'active' ? 'bg-emerald-400' : state === 'idle' ? 'bg-amber-300' : 'bg-slate-100',
                        ].join(' ')}
                        title={`${Math.floor(i / SLOTS_PER_HOUR)}:${String((i % SLOTS_PER_HOUR) * (60 / SLOTS_PER_HOUR)).padStart(2, '0')} ${state}`}
                    />
                ))}
            </div>
            <div className="grid border-b border-slate-200 text-[10px] text-slate-400" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                {HOURS.map((h) => (
                    <div key={h} className={['flex h-5 items-end justify-start border-l px-1 pb-0.5', isToday && h === nowHour ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200'].join(' ')}>
                        {h % 3 === 0 ? fmtHour(h) : ''}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-emerald-400" /> Active</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-amber-300" /> Idle</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-slate-200" /> No tracking</span>
            </div>
        </div>
    );
}

function RollupList({ items, icon: Icon, emptyLabel }) {
    if (!items || items.length === 0) {
        return <p className="text-xs text-slate-500">{emptyLabel}</p>;
    }
    const max = Math.max(...items.map((x) => x.total_seconds || 0), 1);
    return (
        <ul className="space-y-2">
            {items.map((item) => {
                const pct = Math.max(2, Math.round((item.total_seconds / max) * 100));
                return (
                    <li key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-1.5 truncate text-slate-700">
                                {Icon && <Icon className="h-3 w-3 text-slate-400" />}
                                <span className="truncate">{item.name || 'Unknown'}</span>
                            </span>
                            <strong className="text-slate-900">{fmtHm(item.total_seconds)}</strong>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

function ScreenshotTile({ shot, canManage, canDelete, onChanged }) {
    const [busy, setBusy] = useState(false);

    const toggleFlag = () => {
        if (!canManage || busy) return;
        const next = !shot.is_flagged;
        const reason = next ? prompt('Reason for flagging? (optional)') ?? '' : '';
        setBusy(true);
        router.patch(
            route('monitoring.screenshots.flag', { screenshot: shot.id }),
            { is_flagged: next, reason },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => onChanged?.(),
                onFinish: () => setBusy(false),
            }
        );
    };

    const remove = () => {
        if (!canDelete || busy) return;
        const reason = prompt('Reason for deleting this screenshot? (recorded in audit log)') ?? '';
        if (reason === null) return;
        if (!confirm('Delete this screenshot? It will disappear from the timeline.')) return;
        setBusy(true);
        router.delete(
            route('monitoring.screenshots.delete', { screenshot: shot.id }),
            {
                data: { reason },
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => onChanged?.(),
                onFinish: () => setBusy(false),
            }
        );
    };

    return (
        <figure className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between bg-white px-2 py-1 text-[11px] text-slate-500">
                <span>{fmtTime(shot.captured_at)}</span>
                <div className="flex items-center gap-1.5">
                    {shot.is_flagged && <Flag className="h-3 w-3 text-rose-500" />}
                    <span className={['inline-block h-2 w-2 rounded-full', activityDot(shot.activity_percent)].join(' ')} title={`Activity ${shot.activity_percent}%`} />
                </div>
            </div>
            {shot.thumbnail_url ? (
                <a href={shot.image_url || shot.thumbnail_url} target="_blank" rel="noreferrer">
                    <img
                        src={shot.thumbnail_url}
                        alt={shot.active_window_title || 'Screenshot'}
                        loading="lazy"
                        className="block h-32 w-full object-cover"
                    />
                </a>
            ) : (
                <div className="flex h-32 w-full items-center justify-center text-xs text-slate-400">Image unavailable</div>
            )}
            {(shot.active_app || shot.url_domain) && (
                <figcaption className="truncate bg-white px-2 py-1 text-[11px] text-slate-500" title={shot.active_window_title || ''}>
                    {shot.url_domain || shot.active_app}
                </figcaption>
            )}
            {(canManage || canDelete) && (
                <div className="absolute right-1 top-7 flex gap-1">
                    {canManage && (
                        <button
                            type="button"
                            onClick={toggleFlag}
                            disabled={busy}
                            className={[
                                'inline-flex h-6 w-6 items-center justify-center rounded-full border bg-white/90 shadow-sm transition',
                                shot.is_flagged ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                            ].join(' ')}
                            title={shot.is_flagged ? 'Remove flag' : 'Flag this screenshot'}
                        >
                            <Flag className="h-3 w-3" />
                        </button>
                    )}
                    {canDelete && (
                        <button
                            type="button"
                            onClick={remove}
                            disabled={busy}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:bg-rose-50 hover:text-rose-600"
                            title="Delete screenshot"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    )}
                </div>
            )}
        </figure>
    );
}

function SessionCard({ session, canViewScreenshots, canManageScreenshots, canDeleteScreenshots, view, onShotChanged }) {
    return (
        <section className="space-y-3">
            <header className="flex items-center gap-2 text-sm font-semibold">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-rose-600">{fmtTime(session.started_at)} - {fmtTime(session.stopped_at)}</span>
                <span className="text-slate-700">• {sessionLabel(session)}</span>
                <span className="ml-auto text-xs font-normal text-slate-500">
                    {fmtHm(session.total_seconds)} · activity {session.activity_percent ?? 0}%
                </span>
            </header>

            {view === 'apps' ? (
                <div className="grid grid-cols-1 gap-4 rounded-md border border-slate-100 bg-slate-50 p-3 sm:grid-cols-2">
                    <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Apps</p>
                        <RollupList items={session.apps} icon={Laptop} emptyLabel="No app data captured." />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">URLs</p>
                        <RollupList items={session.urls} icon={Globe} emptyLabel="No browser activity captured." />
                    </div>
                </div>
            ) : (
                <>
                    {!canViewScreenshots && session.screenshot_count_hidden > 0 && (
                        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                            {session.screenshot_count_hidden} screenshot{session.screenshot_count_hidden === 1 ? '' : 's'} captured. Permission required to view.
                        </p>
                    )}

                    {canViewScreenshots && session.screenshots.length === 0 && (
                        <p className="text-xs text-slate-500">No screenshots captured for this session.</p>
                    )}

                    {canViewScreenshots && session.screenshots.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {session.screenshots.map((shot) => (
                                <ScreenshotTile
                                    key={shot.id}
                                    shot={shot}
                                    canManage={canManageScreenshots}
                                    canDelete={canDeleteScreenshots}
                                    onChanged={onShotChanged}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

export default function TimelineIndex({
    auth,
    targetUser,
    date,
    users,
    permissions,
    initialData,
    weekStartsOn,
}) {
    const [data, setData] = useState(initialData);
    const [activeDate, setActiveDate] = useState(date);
    const [activeUserId, setActiveUserId] = useState(targetUser.id);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('tasks'); // 'tasks' | 'apps'
    const [historyOpen, setHistoryOpen] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showDownloadHint, setShowDownloadHint] = useState(false);

    // Try to launch the desktop tracker via its custom protocol. If nothing
    // handles it within ~1.6s (window never lost focus), the app isn't
    // installed — offer the download page instead.
    const openDesktopApp = () => {
        let handled = false;
        const onBlur = () => { handled = true; };
        window.addEventListener('blur', onBlur);
        window.location.href = 'timetracker://open';
        setTimeout(() => {
            window.removeEventListener('blur', onBlur);
            if (!handled) setShowDownloadHint(true);
        }, 1600);
    };

    const reload = (nextDate, nextUserId) => {
        const d = nextDate ?? activeDate;
        const u = nextUserId ?? activeUserId;
        setLoading(true);
        router.get(
            route('timeline.index'),
            { date: d, user_id: u },
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: (page) => {
                    const props = page.props;
                    setActiveDate(props.date);
                    setActiveUserId(props.targetUser.id);
                    setData(props.initialData);
                },
                onFinish: () => setLoading(false),
            }
        );
    };

    const openHistory = async () => {
        setHistoryOpen(true);
        setHistoryLoading(true);
        try {
            const res = await fetch(route('timeline.history', { user_id: activeUserId, date: activeDate }), {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            const json = await res.json();
            setHistory(json.logs || []);
        } catch {
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (!historyOpen) return;
        const onEsc = (e) => e.key === 'Escape' && setHistoryOpen(false);
        document.addEventListener('keydown', onEsc);
        return () => document.removeEventListener('keydown', onEsc);
    }, [historyOpen]);

    const clientBreakdownTotal = useMemo(
        () => (data.client_breakdown || []).reduce((s, x) => s + x.total_seconds, 0),
        [data.client_breakdown]
    );

    const userOptions = users || [];
    const showUserPicker = permissions.view_others && userOptions.length > 1;

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="text-xl font-semibold text-slate-900">Timeline</h2>}>
            <Head title="Timeline" />

            <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
                <div className="overflow-hidden rounded-lg bg-white shadow">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                        <div className="flex items-center gap-3">
                            {showUserPicker ? (
                                <select
                                    value={activeUserId}
                                    onChange={(e) => reload(activeDate, Number(e.target.value))}
                                    className="rounded border-slate-300 text-sm font-semibold"
                                >
                                    {userOptions.map((u) => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <h1 className="text-base font-semibold text-slate-900">{targetUser.name}</h1>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <button type="button" onClick={() => reload(shiftDate(activeDate, -1))} className="rounded p-1 hover:bg-slate-100" aria-label="Previous day">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <input
                                type="date"
                                value={activeDate}
                                onChange={(e) => reload(e.target.value)}
                                className="rounded border-slate-200 text-xs"
                            />
                            <button type="button" onClick={() => reload(shiftDate(activeDate, 1))} className="rounded p-1 hover:bg-slate-100" aria-label="Next day">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => reload(new Date().toISOString().slice(0, 10))} className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs">
                                Today
                            </button>
                        </div>
                    </div>

                    <MonthStrip days={data.month_strip || []} onPick={(d) => reload(d)} />

                    <div className="grid grid-cols-1 gap-5 border-t border-slate-200 px-5 py-5 md:grid-cols-[1fr_320px]">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-slate-500">{data.day_label}</p>
                            <div className="flex items-end gap-3">
                                <div className="text-4xl font-bold text-slate-900">{fmtHm(data.totals?.day || 0)}</div>
                                <div className="text-xs text-slate-500">
                                    Week: <strong>{fmtHm(data.totals?.week || 0)}</strong>
                                    <span className="mx-2">·</span>
                                    Month: <strong>{fmtHm(data.totals?.month || 0)}</strong>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400">Week starts on {weekStartsOn === 'sunday' ? 'Sunday' : 'Monday'}</p>
                        </div>
                        <div className="space-y-2 rounded-md bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tasks</p>
                            {(data.client_breakdown || []).length === 0 && (
                                <p className="text-xs text-slate-500">No tracked client work for this day.</p>
                            )}
                            <ul className="space-y-1">
                                {(data.client_breakdown || []).map((row) => (
                                    <li key={row.client} className="flex items-center justify-between text-sm">
                                        <span className="truncate text-slate-700">{row.client}</span>
                                        <strong className="text-slate-900">{fmtHm(row.total_seconds)}</strong>
                                    </li>
                                ))}
                            </ul>
                            {clientBreakdownTotal !== (data.totals?.day || 0) && data.totals?.day > clientBreakdownTotal && (
                                <p className="border-t border-slate-200 pt-1 text-[11px] text-slate-400">
                                    Sessions without a client: {fmtHm((data.totals?.day || 0) - clientBreakdownTotal)}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-slate-200 px-5 py-4">
                        <HourRuler date={activeDate} bands={data.activity_bands || []} />
                    </div>

                    <div className="flex items-center gap-1 border-t border-slate-200 px-5 pt-3">
                        <button
                            type="button"
                            onClick={() => setView('tasks')}
                            className={[
                                'rounded-md px-3 py-1.5 text-sm transition',
                                view === 'tasks'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100',
                            ].join(' ')}
                        >
                            Tasks
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('apps')}
                            className={[
                                'rounded-md px-3 py-1.5 text-sm transition',
                                view === 'apps'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100',
                            ].join(' ')}
                        >
                            Apps &amp; URLs
                        </button>
                    </div>

                    {view === 'apps' && (
                        <div className="grid grid-cols-1 gap-4 border-t border-slate-200 px-5 py-4 md:grid-cols-2">
                            <div className="space-y-2 rounded-md bg-slate-50 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Top apps today</p>
                                <RollupList items={data.day_apps} icon={Laptop} emptyLabel="No app activity tracked yet." />
                            </div>
                            <div className="space-y-2 rounded-md bg-slate-50 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Top URLs today</p>
                                <RollupList items={data.day_urls} icon={Globe} emptyLabel="No browser activity tracked yet." />
                            </div>
                        </div>
                    )}

                    <div className="space-y-8 px-5 pb-8 pt-4">
                        {loading && <p className="text-xs text-slate-400">Loading...</p>}
                        {(data.sessions || []).length === 0 && !loading && (
                            <div className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                                No tracking sessions for {data.day_label}.
                            </div>
                        )}
                        {(data.sessions || []).map((session) => (
                            <SessionCard
                                key={session.id}
                                session={session}
                                canViewScreenshots={permissions.view_screenshots}
                                canManageScreenshots={permissions.manage_screenshots}
                                canDeleteScreenshots={permissions.delete_screenshots}
                                view={view}
                                onShotChanged={() => reload(activeDate, activeUserId)}
                            />
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm">
                        {permissions.add_offline_time && (
                            <Link href={route('work-hours.create', { date: activeDate })} className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800">
                                <Plus className="h-4 w-4" />
                                Add offline time
                            </Link>
                        )}
                        <button type="button" onClick={openHistory} className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">
                            <History className="h-4 w-4" />
                            History of changes
                        </button>
                        <button type="button" onClick={openDesktopApp} className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">
                            <MonitorPlay className="h-4 w-4" />
                            Open desktop tracker
                        </button>
                        {showDownloadHint && (
                            <span className="inline-flex items-center gap-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                                Tracker not installed?
                                <Link href={route('desktop-downloads.index')} className="font-semibold underline">Download it here</Link>
                            </span>
                        )}
                        <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" /> Times in your local timezone
                        </span>
                    </div>
                </div>
            </div>

            {historyOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" onClick={() => setHistoryOpen(false)}>
                    <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">History of changes</h3>
                                <p className="text-xs text-slate-500">{data.day_label} · {targetUser.name}</p>
                            </div>
                            <button type="button" onClick={() => setHistoryOpen(false)} className="rounded p-1 hover:bg-slate-100" aria-label="Close">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="max-h-[65vh] overflow-y-auto px-4 py-3">
                            {historyLoading && <p className="text-sm text-slate-500">Loading...</p>}
                            {!historyLoading && history.length === 0 && (
                                <p className="text-sm text-slate-500">No edits recorded for this day.</p>
                            )}
                            <ul className="divide-y divide-slate-100">
                                {history.map((entry) => (
                                    <li key={entry.id} className="py-3 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-slate-900">{entry.action_label}</span>
                                            <span className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()}</span>
                                        </div>
                                        <div className="mt-1 text-xs text-slate-600">
                                            By <strong>{entry.actor_name}</strong>
                                            {entry.tracking_screenshot_id && <span className="text-slate-400"> · screenshot #{entry.tracking_screenshot_id}</span>}
                                            {entry.tracking_session_id && <span className="text-slate-400"> · session #{entry.tracking_session_id}</span>}
                                        </div>
                                        {entry.reason && (
                                            <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">“{entry.reason}”</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
