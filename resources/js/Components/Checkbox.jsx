export default function Checkbox({ className = '', ...props }) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'rounded border-slate-600 bg-slate-900 text-orange-500 shadow-sm focus:ring-orange-500 [color-scheme:dark] ' +
                className
            }
        />
    );
}
