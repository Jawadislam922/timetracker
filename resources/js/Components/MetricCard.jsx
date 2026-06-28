/**
 * Compact KPI tile for the dashboard / analytics headers. Matches the dark Ember
 * card style: muted label, large value, optional icon and a +/- delta vs a prior
 * period. Keep values pre-formatted (e.g. "152h", "48%") by the caller.
 */
export default function MetricCard({ label, value, icon: Icon, delta = null, tone = 'default', className = '' }) {
    const toneRing = {
        default: 'text-slate-300',
        danger: 'text-rose-400',
        warning: 'text-amber-400',
        success: 'text-emerald-400',
    }[tone] || 'text-slate-300';

    const deltaTone = delta == null ? '' : delta >= 0 ? 'text-emerald-400' : 'text-rose-400';
    const deltaText = delta == null ? null : `${delta >= 0 ? '+' : ''}${delta}%`;

    return (
        <div className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 ${className}`}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{label}</span>
                {Icon && <Icon className={`h-4 w-4 ${toneRing}`} aria-hidden="true" />}
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${tone === 'default' ? 'text-white' : toneRing}`}>{value}</span>
                {deltaText && <span className={`text-xs font-semibold ${deltaTone}`}>{deltaText}</span>}
            </div>
        </div>
    );
}
