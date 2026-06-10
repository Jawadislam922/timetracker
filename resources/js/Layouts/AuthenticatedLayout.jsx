import { useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import {
    Activity,
    BarChart3,
    Briefcase,
    CalendarDays,
    ChevronDown,
    Clock,
    Film,
    LayoutDashboard,
    LogOut,
    Menu,
    MonitorDown,
    Plus,
    Settings as SettingsIcon,
    UserCircle,
    Users,
    X,
} from 'lucide-react';
import ApplicationLogo from '@/Components/ApplicationLogo';
import Avatar from '@/Components/Avatar';
import Dropdown from '@/Components/Dropdown';

function isActiveRoute(names) {
    return names.some((name) => route().current(name));
}

function NavItem({ item, onClick }) {
    const Icon = item.icon;
    const active = isActiveRoute(item.active);

    return (
        <Link
            href={item.href}
            onClick={onClick}
            className={[
                'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition xl:px-3',
                active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
            ].join(' ')}
        >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
        </Link>
    );
}

export default function Authenticated({ user, header, children }) {
    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);
    const can = (permission) => user?.is_super_admin || user?.permissions?.includes(permission);
    const canCreateManualWorkHour = user?.can_create_manual_work_hour ?? true;

    const navItems = useMemo(() => {
        const items = [
            {
                label: 'Dashboard',
                href: route('dashboard'),
                icon: LayoutDashboard,
                active: ['dashboard'],
            },
            {
                label: 'Timeline',
                href: route('timeline.index'),
                icon: Film,
                active: ['timeline.index'],
            },
            {
                label: 'Desktop App',
                href: route('desktop-downloads.index'),
                icon: MonitorDown,
                active: ['desktop-downloads.index'],
            },
            {
                label: 'Work Diary',
                href: route('work-hours.index'),
                icon: Clock,
                active: ['work-hours.index', 'work-hours.create', 'work-hours.edit'],
            },
        ];

        const managementItems = [
            can('users.view') && {
                    label: 'Users',
                    href: route('users.index'),
                    icon: Users,
                    active: ['users.index', 'users.create', 'users.edit'],
                },
            can('clients.view') && {
                    label: 'Clients',
                    href: route('clients.index'),
                    icon: Briefcase,
                    active: ['clients.index', 'clients.create', 'clients.edit'],
                },
            can('profiles.view') && {
                    label: 'Profiles',
                    href: route('upwork-profiles.index'),
                    icon: UserCircle,
                    active: ['upwork-profiles.index', 'upwork-profiles.create', 'upwork-profiles.edit'],
                },
            can('attendance.view') && {
                    label: 'Attendance',
                    href: route('employee-attendance.index'),
                    icon: CalendarDays,
                    active: ['employee-attendance.index'],
                },
            can('reports.view') && {
                    label: 'Report',
                    href: route('work-hours.report'),
                    icon: BarChart3,
                    active: ['work-hours.report'],
                },
            can('timeline.view_others') && {
                    label: 'Team',
                    href: route('team.index'),
                    icon: Activity,
                    active: ['team.index'],
                },
            can('monitoring.settings') && {
                    label: 'Settings',
                    href: route('settings.index'),
                    icon: SettingsIcon,
                    active: ['settings.index'],
                },
        ].filter(Boolean);

        items.splice(1, 0, ...managementItems);

        return items;
    }, [user?.is_super_admin, user?.permissions]);

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900">
            <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3 xl:gap-5">
                            <Link href={route('dashboard')} className="flex shrink-0 items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
                                    <ApplicationLogo size="9" />
                                </span>
                                <span className="hidden leading-tight 2xl:block">
                                    <span className="block text-base font-bold text-slate-900">Sparking Asia</span>
                                    <span className="block text-xs font-medium text-slate-500">Time Tracker</span>
                                </span>
                            </Link>

                            <div className="hidden items-center gap-1 lg:flex">
                                {navItems.map((item) => (
                                    <NavItem key={item.label} item={item} />
                                ))}
                            </div>
                        </div>

                        <div className="hidden shrink-0 items-center gap-3 sm:flex">
                            {canCreateManualWorkHour && (
                                <Link
                                    href={route('work-hours.create')}
                                    className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Add Entry</span>
                                </Link>
                            )}

                            <Dropdown>
                                <Dropdown.Trigger>
                                    <button className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                                        <Avatar user={user} size="sm" />
                                        <span className="hidden max-w-40 truncate xl:block">{user?.name}</span>
                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                    </button>
                                </Dropdown.Trigger>
                                <Dropdown.Content>
                                    <Dropdown.Link href={route('profile.edit')}>
                                        <span className="flex items-center gap-2">
                                            <UserCircle className="h-4 w-4" />
                                            Profile
                                        </span>
                                    </Dropdown.Link>
                                    <Dropdown.Link href={route('logout')} method="post" as="button">
                                        <span className="flex items-center gap-2">
                                            <LogOut className="h-4 w-4" />
                                            Log Out
                                        </span>
                                    </Dropdown.Link>
                                </Dropdown.Content>
                            </Dropdown>
                        </div>

                        <button
                            onClick={() => setShowingNavigationDropdown((previousState) => !previousState)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 lg:hidden"
                            aria-label="Toggle navigation"
                        >
                            {showingNavigationDropdown ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>

                {showingNavigationDropdown && (
                    <div className="border-t border-slate-200 bg-white lg:hidden">
                        <div className="space-y-1 px-4 py-3">
                            {navItems.map((item) => (
                                <NavItem
                                    key={item.label}
                                    item={item}
                                    onClick={() => setShowingNavigationDropdown(false)}
                                />
                            ))}
                            <Link
                                href={route('work-hours.create')}
                                onClick={() => setShowingNavigationDropdown(false)}
                                className="mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                            >
                                <Plus className="h-4 w-4" />
                                Add Entry
                            </Link>
                        </div>

                        <div className="border-t border-slate-200 px-4 py-4">
                            <div className="mb-3 flex items-center gap-3">
                                <Avatar user={user} size="lg" />
                                <div className="min-w-0">
                                    <div className="truncate font-semibold text-slate-900">{user?.name ?? ''}</div>
                                    <div className="truncate text-sm text-slate-500">{user?.email ?? ''}</div>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Link
                                    href={route('profile.edit')}
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                >
                                    <UserCircle className="h-4 w-4" />
                                    Profile Settings
                                </Link>
                                <Link
                                    href={route('logout')}
                                    method="post"
                                    as="button"
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                >
                                    <LogOut className="h-4 w-4" />
                                    Log Out
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {header && (
                <header className="border-b border-slate-200 bg-white">
                    <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
                        <h1 className="text-xl font-semibold text-slate-900">
                            {typeof header === 'string' ? header : (header?.props?.children || 'Page')}
                        </h1>
                    </div>
                </header>
            )}

            <main>{children}</main>
        </div>
    );
}
