import { Chart } from 'react-chartjs-2';
import '@/lib/chartConfig';

/**
 * A single chart that can render as bar, line, doughnut or pie via the generic
 * Chart.js component (no remount on type change). Renders only the requested
 * `type` if it's in `allowedTypes`; otherwise falls back to the first allowed
 * type, so a stale preference or a bad caller can never draw a nonsensical chart
 * (e.g. a doughnut for a 20-point time trend).
 */
export default function MultiTypeChart({ type, allowedTypes = ['bar'], data, options = {}, height = 280 }) {
    const safeType = allowedTypes.includes(type) ? type : allowedTypes[0];

    return (
        <div style={{ position: 'relative', height }}>
            <Chart type={safeType} data={data} options={options} />
        </div>
    );
}
