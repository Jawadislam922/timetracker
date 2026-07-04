import { useMemo } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PageShell from '@/Components/Layout/PageShell';
import PageHeader from '@/Components/Layout/PageHeader';
import Avatar from '@/Components/Avatar';
import MetricCard from '@/Components/MetricCard';
import SwitchableChartCard from '@/Components/Charts/SwitchableChartCard';
import { getChartOptions, toTrendData, toShareData } from '@/lib/chartConfig';
import { ArrowLeft, Clock, Activity, Film } from 'lucide-react';

const PRESETS = [
    ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'],
    ['7d', 'Last 7 days'], ['month', 'This month'],
];
const hours = (v) => `${Math.round(v * 10) / 10}h`;
const pct = (v) => `${Math.round(v)}%`;
const fmtHm = (secs) => {
    const s = Math.max(0, Math.floor(secs || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

export default function TeamMember({ auth, member, start, end, range, charts, totals, canViewTimeline }) {
    const display = usePage().props.display || { timezone: 'Asia/Karachi' };

    const dayLabels = useMemo(
        () => (charts?.labels || []).map((d) => {
            try {
                return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
                    timeZone: display.timezone, month: 'short', day: 'numeric',
                });
            } catch {
                return d;
            }
        }),
        [charts?.labels, display.timezone],
    );

    const go = (params) => router.get(route('team.member', member.id), params, { preserveScroll: true });

    const avgActivity = useMemo(() => {
        const days = (charts?.activity_per_day || []).filter((_, i) => (charts.tracked_hours[i] || 0) > 0);
        if (!days.length) return null;
        return Math.round(days.reduce((a, b) => a + b, 0) / days.length);
    }, [charts]);

    const hasTrend = (charts?.tracked_hours || []).some((v) => v > 0) || (charts?.in_office_hours || []).some((v) => v > 0);

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title={`${member.name} — Analytics`} />
            <PageShell width="max-w-none">
                <Link href={route('team.index', range === 'custom' ? { start, end } : { range })}
                    className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
                    <ArrowLeft className="h-4 w-4" /> Back to Team Performance
                </Link>

                <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar user={member} size="lg" />
                        <div>
                            <h1 className="text-2xl font-bold text-white">{member.name}</h1>
                            <p className="text-sm text-slate-400">{member.designation || 'Employee'}</p>
                        </div>
                    </div>
                    {canViewTimeline && (
                        <Link href={route('timeline.index', { user_id: member.id })}
                            className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">
                            <Film className="h-4 w-4" /> Open Timeline
                        </Link>
                    )}
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                    {PRESETS.map(([key, label]) => (
                        <button key={key} type="button" onClick={() => go({ range: key })}
                            className={`rounded-md px-3 py-1 text-xs font-medium ${range === key ? 'bg-orange-500 text-slate-950' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
                            {label}
                        </button>
                    ))}
                    <span className="ml-1 self-center text-xs text-slate-500">{start} → {end}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MetricCard label="Tracked" value={fmtHm(totals.tracked_seconds)} icon={Clock} />
                    <MetricCard label="In office" value={fmtHm(totals.in_office_seconds)} icon={Clock} />
                    <MetricCard label="Avg activity" value={avgActivity == null ? '—' : `${avgActivity}%`} icon={Activity} />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <SwitchableChartCard
                        title="Hours per day"
                        subtitle="In-office vs tracked — the gap is present-but-not-tracking"
                        chartKey="person_hours_per_day"
                        allowedTypes={['bar', 'line']}
                        defaultType="bar"
                        isEmpty={!hasTrend}
                        buildData={(type) => toTrendData(dayLabels, [
                            { label: 'In office', data: charts.in_office_hours, color: '#38bdf8' },
                            { label: 'Tracked', data: charts.tracked_hours, color: '#f59e0b' },
                        ], type)}
                        buildOptions={(type) => getChartOptions({ type, showLegend: true, valueFormat: hours })}
                    />
                    <SwitchableChartCard
                        title="Activity per day"
                        chartKey="person_activity"
                        allowedTypes={['line', 'bar']}
                        defaultType="line"
                        isEmpty={!hasTrend}
                        buildData={(type) => toTrendData(dayLabels, [{ label: 'Activity', data: charts.activity_per_day, color: '#34d399' }], type)}
                        buildOptions={(type) => getChartOptions({ type, valueFormat: pct, overrides: { scales: { x: {}, y: { max: 100 } } } })}
                    />
                    <SwitchableChartCard
                        title="Top apps"
                        chartKey="person_top_apps"
                        allowedTypes={['doughnut', 'pie', 'bar']}
                        defaultType="doughnut"
                        isEmpty={!(charts.top_apps || []).length}
                        buildData={(type) => (type === 'bar'
                            ? toTrendData(toShareData(charts.top_apps).labels, [{ label: 'Hours', data: toShareData(charts.top_apps).datasets[0].data }], 'bar')
                            : toShareData(charts.top_apps, { cap: 24 }))}
                        buildOptions={(type) => getChartOptions({ type, showLegend: type !== 'bar', valueFormat: hours, indexAxis: type === 'bar' ? 'y' : 'x' })}
                        height={260}
                    />
                    <SwitchableChartCard
                        title="Top clients"
                        chartKey="person_top_clients"
                        allowedTypes={['doughnut', 'pie', 'bar']}
                        defaultType="doughnut"
                        isEmpty={!(charts.top_clients || []).length}
                        buildData={(type) => (type === 'bar'
                            ? toTrendData(toShareData(charts.top_clients).labels, [{ label: 'Hours', data: toShareData(charts.top_clients).datasets[0].data }], 'bar')
                            : toShareData(charts.top_clients, { cap: 24 }))}
                        buildOptions={(type) => getChartOptions({ type, showLegend: type !== 'bar', valueFormat: hours, indexAxis: type === 'bar' ? 'y' : 'x' })}
                        height={260}
                    />
                </div>
            </PageShell>
        </AuthenticatedLayout>
    );
}
