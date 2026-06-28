import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    DoughnutController,
    PieController,
    ArcElement,
    Filler,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

// Register every element AND controller the switchable <Chart type=...> can use,
// ONCE for the whole app. The generic Chart component (unlike the typed <Bar>/
// <Line>/<Doughnut> wrappers) does NOT auto-register controllers, so they must
// be registered explicitly or Chart.js throws "X is not a registered controller".
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    DoughnutController,
    PieController,
    ArcElement,
    Filler,
    Title,
    Tooltip,
    Legend,
);

// Canvas can't read CSS variables, so chart colours are hardcoded hex tuned for
// the dark "Ember" theme. Series identity follows the entity, never its rank.
export const SERIES = [
    '#f59e0b', // amber-500  (primary / tracked)
    '#38bdf8', // sky-400    (secondary / in-office)
    '#34d399', // emerald-400
    '#a78bfa', // violet-400
    '#fb7185', // rose-400
    '#facc15', // yellow-400
    '#22d3ee', // cyan-400
    '#f472b6', // pink-400
];

// Activity thresholds match the existing dashboard badge logic (rose<30, amber<60, else emerald).
export const activityColor = (pct) => (pct < 30 ? '#fb7185' : pct < 60 ? '#f59e0b' : '#34d399');

const ink = 'rgba(226, 232, 240, 0.75)';   // slate-200 @ 75%
const grid = 'rgba(148, 163, 184, 0.15)';  // slate-400 @ 15%
const font = { family: 'Inter, sans-serif' };

/**
 * Shared chart options for the dark Ember theme. One source of truth so the
 * three legacy wrappers' duplicated styling never drifts again.
 *
 * @param {object} opts
 * @param {('bar'|'line'|'doughnut'|'pie')} opts.type
 * @param {boolean} [opts.showLegend]
 * @param {(v:number)=>string} [opts.valueFormat]  axis/tooltip value formatter
 * @param {object} [opts.overrides]                deep-ish merge of extra options
 */
export function getChartOptions({ type = 'bar', showLegend = false, valueFormat, overrides = {} } = {}) {
    const fmt = valueFormat || ((v) => v);
    const isArc = type === 'doughnut' || type === 'pie';

    const base = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: isArc ? 'nearest' : 'index' },
        plugins: {
            legend: {
                display: showLegend,
                position: isArc ? 'bottom' : 'top',
                labels: { color: ink, font, usePointStyle: true, pointStyle: 'circle', padding: 16 },
            },
            tooltip: {
                backgroundColor: 'rgba(2, 6, 23, 0.92)',
                titleColor: '#f8fafc',
                bodyColor: '#e2e8f0',
                borderColor: 'rgba(148, 163, 184, 0.2)',
                borderWidth: 1,
                cornerRadius: 8,
                padding: 10,
                titleFont: { ...font, size: 13, weight: 'bold' },
                bodyFont: { ...font, size: 12 },
                callbacks: {
                    label: (c) => {
                        const label = c.dataset?.label ? `${c.dataset.label}: ` : '';
                        const val = isArc ? c.parsed : c.parsed.y;
                        return label + fmt(val);
                    },
                },
            },
        },
        ...(isArc
            ? { cutout: type === 'doughnut' ? '62%' : 0 }
            : {
                scales: {
                    x: { grid: { color: grid, drawBorder: false }, ticks: { color: ink, font: { ...font, size: 11 } } },
                    y: {
                        beginAtZero: true,
                        grid: { color: grid, drawBorder: false },
                        ticks: { color: ink, font: { ...font, size: 11 }, callback: (v) => fmt(v) },
                    },
                },
            }),
    };

    return { ...base, ...overrides, plugins: { ...base.plugins, ...(overrides.plugins || {}) } };
}

/**
 * Trend dataset (bar/line) from parallel arrays. Each series picks its colour by
 * index from SERIES (identity-stable, never re-coloured on filter).
 */
export function toTrendData(labels, series, type = 'bar') {
    return {
        labels,
        datasets: series.map((s, i) => {
            const color = s.color || SERIES[i % SERIES.length];
            return {
                label: s.label,
                data: s.data,
                backgroundColor: type === 'line' ? `${color}22` : color,
                borderColor: color,
                borderWidth: type === 'line' ? 2 : 0,
                borderRadius: type === 'bar' ? 4 : 0,
                maxBarThickness: 26,
                fill: type === 'line' ? !!s.fill : false,
                tension: 0.3,
                pointRadius: type === 'line' ? 0 : undefined,
                pointHoverRadius: type === 'line' ? 4 : undefined,
            };
        }),
    };
}

/**
 * Share dataset (doughnut/pie/bar) from {label,value} items. Caps to `cap`
 * slices and folds the tail into "Others" so a disc never explodes into noise.
 * Sorted by value desc then label asc (deterministic — fixes tie ordering).
 */
export function toShareData(items, { cap = 8 } = {}) {
    const sorted = [...items]
        .filter((it) => (it.value ?? 0) > 0)
        .sort((a, b) => (b.value - a.value) || String(a.label).localeCompare(String(b.label)));

    let kept = sorted;
    if (sorted.length > cap) {
        const head = sorted.slice(0, cap - 1);
        const tail = sorted.slice(cap - 1);
        const othersValue = tail.reduce((sum, it) => sum + it.value, 0);
        kept = [...head, { label: 'Others', value: othersValue }];
    }

    return {
        labels: kept.map((it) => it.label),
        datasets: [
            {
                data: kept.map((it) => Math.round(it.value * 10) / 10),
                backgroundColor: kept.map((it, i) => it.color || SERIES[i % SERIES.length]),
                borderColor: 'rgba(2, 6, 23, 0.6)',
                borderWidth: 2,
            },
        ],
    };
}
