import React, { useMemo } from 'react';

// Dropdown time picker in 15-minute steps — friendlier than the native
// <input type="time"> spinner. Value/onChange use 'HH:MM' (24h) to match the
// work-hour windows payload; the labels shown are 12-hour.
const STEP_MINUTES = 15;

function to12(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const ap = h < 12 ? 'AM' : 'PM';
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:${String(m).padStart(2, '0')} ${ap}`;
}

export default function TimeSelect({ value, onChange, className = '', placeholder = 'Select time' }) {
    const options = useMemo(() => {
        const out = [];
        for (let m = 0; m < 24 * 60; m += STEP_MINUTES) {
            const hh = String(Math.floor(m / 60)).padStart(2, '0');
            const mm = String(m % 60).padStart(2, '0');
            out.push({ value: `${hh}:${mm}`, label: to12(`${hh}:${mm}`) });
        }
        return out;
    }, []);

    // A value off the 15-min grid (e.g. filled from a gap chip like 9:07) still
    // needs to display, so include it as its own option.
    const onGrid = value && options.some((o) => o.value === value);

    return (
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={className}
        >
            <option value="">{placeholder}</option>
            {value && !onGrid && <option value={value}>{to12(value)}</option>}
            {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}
