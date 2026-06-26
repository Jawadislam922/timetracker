import { useMemo } from 'react';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import PageHeader from '../Components/Layout/PageHeader';
import PageShell from '../Components/Layout/PageShell';
import { CalendarClock, Clock, Trash2, Info } from 'lucide-react';

// Today in Pakistan time as YYYY-MM-DD (the form min + default).
function pkToday() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

// "08:00" -> "8:00 AM"
function prettyTime(hhmm) {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function prettyHours(hours) {
    if (hours === null || hours === undefined || hours === '') return null;
    const n = Number(hours);
    if (Number.isNaN(n)) return null;
    const h = Math.floor(n);
    const mins = Math.round((n - h) * 60);
    return mins ? `${h}h ${mins}m` : `${h}h`;
}

export default function MySchedule({ auth, standingShift = {}, overrides = [], canEdit = false }) {
    const flash = usePage().props?.flash || {};
    const today = useMemo(() => pkToday(), []);

    const form = useForm({
        date: today,
        shift_start_time: standingShift.start_time || '',
        shift_hours: standingShift.hours ?? '',
        reason: '',
    });

    const submit = (e) => {
        e.preventDefault();
        form.post(route('shift-overrides.store'), {
            preserveScroll: true,
            onSuccess: () => form.setData('reason', ''),
        });
    };

    const remove = (id) => {
        if (!confirm('Remove this shift change?')) return;
        router.delete(route('shift-overrides.destroy', id), { preserveScroll: true });
    };

    const standingSummary = standingShift.start_time
        ? `${prettyTime(standingShift.start_time)}${standingShift.hours ? ` · ${prettyHours(standingShift.hours)}` : ''}`
        : 'No standing shift set';

    const inputClass =
        'w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 focus:outline-none';

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="My Schedule" />

            <PageShell width="max-w-4xl">
                <PageHeader
                    title="My Schedule"
                    description="Change your shift for a single day — e.g. start earlier on Friday because you're off Saturday."
                />

                {flash.success && (
                    <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300">
                        {flash.success}
                    </div>
                )}

                {/* Standing shift */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-orange-400">
                            <Clock className="h-5 w-5" />
                        </span>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Your standing shift</p>
                            <p className="text-base font-semibold text-white">{standingSummary}</p>
                        </div>
                    </div>
                    <p className="mt-3 flex items-start gap-2 text-xs text-slate-400">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        A one-day change only moves that day&apos;s schedule (when you&apos;re expected in, and when a
                        forgotten clock-out auto-closes). It never adds clock-ins or hours.
                    </p>
                </div>

                {/* Add a one-day change */}
                {canEdit && (
                    <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                            <CalendarClock className="h-4 w-4 text-orange-400" />
                            Change a day
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-400">Date</label>
                                <input
                                    type="date"
                                    min={today}
                                    value={form.data.date}
                                    onChange={(e) => form.setData('date', e.target.value)}
                                    className={inputClass}
                                    required
                                />
                                {form.errors.date && <p className="mt-1 text-xs text-red-400">{form.errors.date}</p>}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-400">Start time</label>
                                <input
                                    type="time"
                                    value={form.data.shift_start_time}
                                    onChange={(e) => form.setData('shift_start_time', e.target.value)}
                                    className={inputClass}
                                />
                                {form.errors.shift_start_time && (
                                    <p className="mt-1 text-xs text-red-400">{form.errors.shift_start_time}</p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-400">Length (hours)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="16"
                                    step="0.5"
                                    placeholder={standingShift.hours ?? 'e.g. 8'}
                                    value={form.data.shift_hours}
                                    onChange={(e) => form.setData('shift_hours', e.target.value)}
                                    className={inputClass}
                                />
                                {form.errors.shift_hours && (
                                    <p className="mt-1 text-xs text-red-400">{form.errors.shift_hours}</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="mb-1.5 block text-xs font-medium text-slate-400">Reason (optional)</label>
                            <input
                                type="text"
                                maxLength={255}
                                placeholder="e.g. Off Saturday, covering Friday early"
                                value={form.data.reason}
                                onChange={(e) => form.setData('reason', e.target.value)}
                                className={inputClass}
                            />
                        </div>

                        <div className="mt-4 flex items-center justify-end">
                            <button
                                type="submit"
                                disabled={form.processing}
                                className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-orange-400 hover:to-amber-400 disabled:opacity-60"
                            >
                                {form.processing ? 'Saving…' : 'Save change'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Upcoming changes */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <h2 className="mb-4 text-sm font-bold text-white">Upcoming changes</h2>

                    {overrides.length === 0 ? (
                        <p className="text-sm text-slate-500">No upcoming shift changes. Your standing shift applies.</p>
                    ) : (
                        <ul className="space-y-2">
                            {overrides.map((o) => (
                                <li
                                    key={o.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white">{o.date_label}</p>
                                        <p className="text-xs text-slate-400">
                                            {prettyTime(o.shift_start_time) || prettyTime(standingShift.start_time) || '—'}
                                            {o.shift_hours ? ` · ${prettyHours(o.shift_hours)}` : standingShift.hours ? ` · ${prettyHours(standingShift.hours)}` : ''}
                                            {o.reason ? ` — ${o.reason}` : ''}
                                        </p>
                                    </div>
                                    {canEdit && (
                                        <button
                                            type="button"
                                            onClick={() => remove(o.id)}
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                                            title="Remove"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </PageShell>
        </AuthenticatedLayout>
    );
}
