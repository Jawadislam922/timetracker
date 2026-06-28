import { Link } from '@inertiajs/react';

export default function ResponsiveNavLink({ active = false, className = '', children, ...props }) {
    return (
        <Link
            {...props}
            className={`w-full flex items-start ps-3 pe-4 py-2 border-l-4 rounded-r-lg ${
                active
                    ? 'border-orange-500 text-orange-400 bg-orange-500/15 shadow-sm focus:text-orange-300 focus:bg-orange-500/20 focus:border-orange-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800 hover:border-slate-700 focus:text-slate-200 focus:bg-slate-800 focus:border-slate-700'
            } text-base font-medium focus:outline-none transition duration-150 ease-in-out ${className}`}
        >
            {children}
        </Link>
    );
}
