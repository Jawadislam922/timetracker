/**
 * Horizontal activity-% bar with the same thresholds as the dashboard badge:
 * rose < 30, amber < 60, else emerald. Renders "—" when activity is unknown
 * (null/undefined), so a zero-tracked person reads as "no data", not "0% bad".
 */
export default function ActivityPercentBar({ percent, width = 80, showLabel = true }) {
    const known = percent !== null && percent !== undefined && !Number.isNaN(percent);
    const pct = known ? Math.max(0, Math.min(100, Math.round(percent))) : 0;
    const color = !known ? 'bg-slate-700' : pct < 30 ? 'bg-rose-500' : pct < 60 ? 'bg-amber-500' : 'bg-emerald-500';
    const textColor = !known ? 'text-slate-500' : pct < 30 ? 'text-rose-300' : pct < 60 ? 'text-amber-300' : 'text-emerald-300';

    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800" style={{ width }}>
                <div className={`h-full rounded-full ${color}`} style={{ width: known ? `${pct}%` : '100%' }} />
            </div>
            {showLabel && (
                <span className={`text-xs font-medium tabular-nums ${textColor}`}>{known ? `${pct}%` : '—'}</span>
            )}
        </div>
    );
}
