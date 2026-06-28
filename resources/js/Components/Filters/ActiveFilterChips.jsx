import React from 'react';

export default function ActiveFilterChips({ chips = [], onClearAll }) {
    if (!chips.length) {
        return null;
    }

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
            {chips.map((chip) => (
                <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onRemove}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-700 hover:text-white"
                    title={`Remove ${chip.label}`}
                >
                    <span>{chip.label}</span>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                </button>
            ))}

            {onClearAll && (
                <button
                    type="button"
                    onClick={onClearAll}
                    className="rounded-md px-2.5 py-1 text-xs font-semibold text-orange-400 transition hover:bg-orange-500/10 hover:text-orange-300"
                >
                    Clear all
                </button>
            )}
        </div>
    );
}
