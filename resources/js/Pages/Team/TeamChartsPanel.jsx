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

    // Ranked-bar builders for the "many categories" charts (members / clients /
    // apps). A donut caps at 8 slices + a useless "Others" — no good for 58
    // people — so the bar variant shows a tall ranked list (the default), and
    // donut/pie stay as a compact high-level alternate.
    const rankedBuild = (items, barCap) => (type) => {
        if (type === 'bar') {
            const s = toShareData(items, { cap: barCap });
            return toTrendData(s.labels, [{ label: 'Hours', data: s.datasets[0].data }], 'bar');
        }
        return toShareData(items);
    };
    const rankedOpts = (type) => getChartOptions({
        type,
        showLegend: type !== 'bar',
        valueFormat: hours,
        indexAxis: type === 'bar' ? 'y' : 'x',
    });
    const barHeight = (n) => Math.min(900, Math.max(280, n * 22));

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
                    <div className="lg:col-span-2">
                        <SwitchableChartCard
                            title="Hours by member"
                            subtitle="Every member, ranked"
                            chartKey="team_composition_v2"
                            allowedTypes={['bar']}
                            defaultType="bar"
                            isEmpty={composition.every((c) => c.value <= 0)}
                            buildData={rankedBuild(composition, composition.length || 8)}
                            buildOptions={rankedOpts}
                            height={barHeight(composition.filter((c) => c.value > 0).length)}
                        />
                    </div>
                    <SwitchableChartCard
                        title="Top clients & work"
                        subtitle="Client work + non-billable categories (office work, bidding, test tasks)"
                        chartKey="team_top_clients_v2"
                        allowedTypes={['bar', 'doughnut', 'pie']}
                        defaultType="bar"
                        isEmpty={!(charts.top_clients || []).length}
                        buildData={rankedBuild(charts.top_clients, 25)}
                        buildOptions={rankedOpts}
                        height={barHeight((charts.top_clients || []).length)}
                    />
                    <SwitchableChartCard
                        title="Top apps"
                        chartKey="team_top_apps_v2"
                        allowedTypes={['bar', 'doughnut', 'pie']}
                        defaultType="bar"
                        isEmpty={!(charts.top_apps || []).length}
                        buildData={rankedBuild(charts.top_apps, 25)}
                        buildOptions={rankedOpts}
                        height={barHeight((charts.top_apps || []).length)}
                    />
                </div>
            )}
        </div>
    );
}
