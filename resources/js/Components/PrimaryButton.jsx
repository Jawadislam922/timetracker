export default function PrimaryButton({ className = '', disabled, children, ...props }) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 border border-transparent rounded-md font-semibold text-xs text-white uppercase tracking-widest hover:from-orange-600 hover:to-amber-600 focus:from-orange-600 focus:to-amber-600 active:from-orange-700 active:to-amber-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition ease-in-out duration-150 ${
                    disabled && 'opacity-25'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
