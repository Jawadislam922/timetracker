import { useMemo, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import SwitchableChartCard from '@/Components/Charts/SwitchableChartCard';
import { getChartOptions, toTrendData, toShareData } from '@/lib/chartConfig';

const hours = (v) => `${Math.round(v * 10) / 10}h`;
const pct = (v) => `${Math.round(v)}%`;

export default function TeamChartsPanel({ charts, rows }) {
    const display = usePage().props.display || { timezone: 'Asia/Karachi' };
    const [open, setOpen] = useState(true);

    // Pretty day labels (Y-m-d → "Jun 27") in the viewer's display timezone.
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

    // Composition is derived from the SAME row totals the table renders.
    const composition = useMemo(
        () => (rows || []).map((r) => ({ label: r.name, value: (r.total_seconds || 0) / 3600 })),
        [rows],
    );

    if (!charts) return null;

    const hasTrend = (charts.hours_per_day || []).some((v) => v > 0);

    return (
        <div className="border-b border-slate-800 bg-slate-950/40 px-4 py-3 sm:px-5">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-2 text-sm font-semibold text-slate-200"
                aria-expanded={open}
            >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <BarChart3 className="h-4 w-4 text-orange-400" />
                Charts
                <span className="ml-1 text-xs font-normal text-slate-500">visual view of the table below</span>
            </button>

            {open && (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <SwitchableChartCard
                        title="Team hours per day"
                        chartKey="team_hours_per_day"
                        allowedTypes={['bar', 'line']}
                        defaultType="bar"
                        isEmpty={!hasTrend}
                        buildData={(type) => toTrendData(dayLabels, [{ label: 'Hours', data: charts.hours_per_day }], type)}
                        buildOptions={(type) => getChartOptions({ type, valueFormat: hours })}
                    />
                    <SwitchableChartCard
                        title="Team activity per day"
                        subtitle="Manual hours count as 0% activity"
                        chartKey="team_activity_per_day"
                        allowedTypes={['line', 'bar']}
                        defaultType="line"
                        isEmpty={!hasTrend}
                        buildData={(type) => toTrendData(dayLabels, [{ label: 'Activity', data: charts.activity_per_day, color: '#34d399' }], type)}
                        buildOptions={(type) => getChartOptions({ type, valueFormat: pct, overrides: { scales: { x: {}, y: { max: 100 } } } })}
                    />
                    <SwitchableChartCard
                        title="Share of hours by member"
                        chartKey="team_composition"
                        allowedTypes={['doughnut', 'pie', 'bar']}
                        defaultType="doughnut"
                        isEmpty={composition.every((c) => c.value <= 0)}
                        buildData={(type) => (type === 'bar'
                            ? toTrendData(toShareData(composition).labels, [{ label: 'Hours', data: toShareData(composition).datasets[0].data }], 'bar')
                            : toShareData(composition))}
                        buildOptions={(type) => getChartOptions({ type, showLegend: type !== 'bar', valueFormat: hours })}
                        height={260}
                    />
                    <SwitchableChartCard
                        title="Top clients"
                        chartKey="team_top_clients"
                        allowedTypes={['doughnut', 'pie', 'bar']}
                        defaultType="doughnut"
                        isEmpty={!(charts.top_clients || []).length}
                        buildData={(type) => (type === 'bar'
                            ? toTrendData(toShareData(charts.top_clients).labels, [{ label: 'Hours', data: toShareData(charts.top_clients).datasets[0].data }], 'bar')
                            : toShareData(charts.top_clients))}
                        buildOptions={(type) => getChartOptions({ type, showLegend: type !== 'bar', valueFormat: hours })}
                        height={260}
                    />
                    <SwitchableChartCard
                        title="Top apps"
                        chartKey="team_top_apps"
                        allowedTypes={['doughnut', 'pie', 'bar']}
                        defaultType="doughnut"
                        isEmpty={!(charts.top_apps || []).length}
                        buildData={(type) => (type === 'bar'
                            ? toTrendData(toShareData(charts.top_apps).labels, [{ label: 'Hours', data: toShareData(charts.top_apps).datasets[0].data }], 'bar')
                            : toShareData(charts.top_apps))}
                        buildOptions={(type) => getChartOptions({ type, showLegend: type !== 'bar', valueFormat: hours })}
                        height={260}
                    />
                </div>
            )}
        </div>
    );
}
