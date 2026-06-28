import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

// Severity → colour. Red = act now (forgotten clock-out), amber = look soon
// (low activity, late, long break), blue = informational (tracking w/o clock-in).
const SEVERITY = {
    red: { dot: 'bg-rose-400', text: 'text-rose-300', ring: 'ring-rose-500/20' },
    amber: { dot: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-500/20' },
    blue: { dot: 'bg-sky-400', text: 'text-sky-300', ring: 'ring-sky-500/20' },
};

function MiniAvatar({ src, name }) {
    const [failed, setFailed] = useState(false);
    if (src && !failed) {
        return <img src={src} alt="" onError={() => setFailed(true)} className="h-8 w-8 rounded-full object-cover" />;
    }
    return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">
            {(name || '?').charAt(0).toUpperCase()}
        </span>
    );
}

/**
 * The dashboard's actionable list: who needs a manager's attention right now and
 * why, most urgent first. Each item is a single signal (a person can appear
 * twice if they trip two rules). "Active only" narrows it to people currently
 * tracking, for a live-floor view. Rows link to the person's analytics when the
 * viewer may see it; otherwise they're plain (the signal still shows).
 */
export default function NeedsAttentionList({ items = [], canViewAnalytics = false }) {
    const [activeOnly, setActiveOnly] = useState(false);
    const shown = activeOnly ? items.filter((i) => i.is_live) : items;

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-slate-100">Needs attention</h3>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">{items.length}</span>
                </div>
                <button
                    type="button"
                    onClick={() => setActiveOnly((v) => !v)}
                    aria-pressed={activeOnly}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        activeOnly ? 'bg-orange-500/20 text-orange-300' : 'border border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                >
                    Active only
                </button>
            </div>

            {shown.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400/80" />
                    <p className="text-sm font-medium text-slate-200">All clear</p>
                    <p className="text-xs text-slate-500">
                        {activeOnly ? 'No active trackers need attention.' : 'Nobody needs attention right now.'}
                    </p>
                </div>
            ) : (
                <ul className="max-h-[22rem] divide-y divide-slate-800/70 overflow-y-auto">
                    {shown.map((item, idx) => {
                        const sev = SEVERITY[item.severity] || SEVERITY.amber;
                        const row = (
                            <div className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/5">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${sev.dot} ring-4 ${sev.ring}`} />
                                <MiniAvatar src={item.avatar} name={item.name} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-semibold text-slate-100">{item.name}</span>
                                        {item.is_live && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
                                            </span>
                                        )}
                                    </div>
                                    <p className={`truncate text-xs ${sev.text}`}>{item.message}</p>
                                </div>
                                {canViewAnalytics && <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />}
                            </div>
                        );
                        return (
                            <li key={`${item.user_id}-${item.type}-${idx}`}>
                                {canViewAnalytics ? (
                                    <Link href={route('team.member', { user: item.user_id, range: 'today' })} className="block">
                                        {row}
                                    </Link>
                                ) : (
                                    row
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
