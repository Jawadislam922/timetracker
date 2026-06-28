import { Link } from '@inertiajs/react';

export default function NavLink({ active = false, className = '', children, ...props }) {
    return (
        <Link
            {...props}
            className={
                'inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium leading-5 transition duration-150 ease-in-out focus:outline-none rounded-t-lg ' +
                (active
                    ? 'border-orange-500 text-orange-400 bg-orange-500/15 shadow-sm'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800 hover:border-slate-700 focus:text-slate-200 focus:bg-slate-800 ') +
                className
            }
        >
            {children}
        </Link>
    );
}
