import React, { useEffect, useMemo, useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import {
    Activity,
    CalendarDays,
    Coffee,
    Download,
    PauseCircle,
    PlayCircle,
    RotateCcw,
    Square,
    Timer,
    UserRound,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
    showActionBlocked,
    showError,
    showExportSuccess,
    showLoading,
    showTimeActionSuccess,
} from '@/Utils/notifications';
import { formatHours, getTimeBasedGreeting } from '@/Utils/timeUtils';

const ACTIONS = [
    { type: 'clock_in', label: 'Clock In', description: 'Start work', icon: PlayCircle, activeClass: 'bg-emerald-600 text-white hover:bg-emerald-700' },
    { type: 'clock_out', label: 'Clock Out', description: 'End work', icon: Square, activeClass: 'bg-rose-600 text-white hover:bg-rose-700' },
    { type: 'break_start', label: 'Start Break', description: 'Pause work', icon: PauseCircle, activeClass: 'bg-amber-500 text-slate-950 hover:bg-amber-600' },
    { type: 'break_end', label: 'End Break', description: 'Resume work', icon: RotateCcw, activeClass: 'bg-blue-600 text-white hover:bg-blue-700' },
];

const actionLabel = (type) => ACTIONS.find((action) => action.type === type)?.label || 'Not Started';

const statusFromAction = (lastAction) => {
    if (!lastAction) return { label: 'Not Started', className: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' };
    if (lastAction === 'break_start') return { label: 'On Break', className: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' };
    if (lastAction === 'clock_out') return { label: 'Clocked Out', className: 'bg-rose-50 text-rose-800', dot: 'bg-rose-500' };
    return { label: 'Working', className: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' };
};

const calculateStats = (entries) => {
    if (!entries.length) {
        return { totalHours: 0, totalBreakTime: 0, sessionsCount: 0, lastAction: null };
    }

    const sorted = [...entries].sort((a, b) => new Date(a.action_timestamp) - new Date(b.action_timestamp));
    let totalMinutes = 0;
    let breakMinutes = 0;
    let sessionsCount = 0;
    let sessionStart = null;
    let breakStart = null;

    sorted.forEach((entry) => {
        const timestamp = new Date(entry.action_timestamp);

        if (entry.action_type === 'clock_in') {
            sessionStart = timestamp;
            sessionsCount += 1;
        } else if (entry.action_type === 'clock_out' && sessionStart) {
            totalMinutes += (timestamp - sessionStart) / 60000;
            sessionStart = null;
        } else if (entry.action_type === 'break_start') {
            breakStart = timestamp;
        } else if (entry.action_type === 'break_end' && breakStart) {
            breakMinutes += (timestamp - breakStart) / 60000;
            breakStart = null;
        }
    });

    if (sessionStart) totalMinutes += (Date.now() - sessionStart.getTime()) / 60000;
    if (breakStart) breakMinutes += (Date.now() - breakStart.getTime()) / 60000;

    return {
        totalHours: Math.max(0, (totalMinutes - breakMinutes) / 60),
        totalBreakTime: Math.max(0, breakMinutes / 60),
        sessionsCount,
        lastAction: entries[0]?.action_type || null,
    };
};

// Falls back to initials when the avatar file 404s (deploys can prune
// storage files), instead of showing the browser's broken-image icon.
function EmployeeAvatar({ src, name }) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [src]);

    if (src && !failed) {
        return <img src={src} alt="" onError={() => setFailed(true)} className="h-9 w-9 rounded-full object-cover" />;
    }

    return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">
            {name.charAt(0).toUpperCase()}
        </span>
    );
}

export default function Dashboard({ auth }) {
    const can = (permission) => auth.user?.is_super_admin || auth.user?.permissions?.includes(permission);
    const canViewTeam = can('dashboard.view_team') || can('attendance.view');
    const [entries, setEntries] = useState([]);
    const [employeesData, setEmployeesData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [todayStats, setTodayStats] = useState(calculateStats([]));

    useEffect(() => {
        const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const [entriesResponse, summaryResponse] = await Promise.all([
                    axios.get('/time-entries/today'),
                    axios.get('/time-entries/today-summary'),
                ]);
                const nextEntries = entriesResponse.data.entries || [];
                setEntries(nextEntries);
                setTodayStats(calculateStats(nextEntries));
                setEmployeesData(summaryResponse.data.employees || []);
            } catch (error) {
                console.error('Dashboard load failed:', error);
                showError('Unable to load dashboard data.');
            }
        };

        loadDashboard();
    }, []);

    const currentStatus = useMemo(() => statusFromAction(todayStats.lastAction), [todayStats.lastAction]);

    const isActionDisabled = (actionType) => {
        if (loading) return true;
        if (!todayStats.lastAction) return actionType !== 'clock_in';
        if (todayStats.lastAction === 'clock_in') return actionType === 'clock_in' || actionType === 'break_end';
        if (todayStats.lastAction === 'clock_out') return actionType !== 'clock_in';
        if (todayStats.lastAction === 'break_start') return actionType !== 'break_end';
        if (todayStats.lastAction === 'break_end') return actionType === 'clock_in' || actionType === 'break_end';
        return false;
    };

    const blockedReason = (actionType) => {
        if (actionType === 'clock_in') return 'Finish the current work session before clocking in again.';
        if (actionType === 'clock_out' && todayStats.lastAction === 'break_start') return 'End the break before clocking out.';
        if (actionType === 'break_end') return 'Start a break before ending it.';
        return 'This action is not available for your current status.';
    };

    const addEntry = async (actionType) => {
        if (isActionDisabled(actionType)) {
            showActionBlocked(actionType, blockedReason(actionType));
            return;
        }

        const loadingToast = showLoading('Recording time entry...');
        setLoading(true);

        try {
            const response = await axios.post('/time-entries', { action_type: actionType });
            const nextEntries = [response.data.entry, ...entries];
            setEntries(nextEntries);
            setTodayStats(calculateStats(nextEntries));
            const summaryResponse = await axios.get('/time-entries/today-summary');
            setEmployeesData(summaryResponse.data.employees || []);
            toast.dismiss(loadingToast);
            showTimeActionSuccess(actionType);
        } catch (error) {
            console.error('Time entry failed:', error);
            toast.dismiss(loadingToast);
            showError(error.response?.data?.message || 'Failed to record time entry.');
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = async () => {
        const loadingToast = showLoading('Preparing time report...');

        try {
            const response = await axios.get('/time-entries/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `sparking-asia-timesheet-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
            toast.dismiss(loadingToast);
            showExportSuccess();
        } catch (error) {
            console.error('Export failed:', error);
            toast.dismiss(loadingToast);
            showError('Failed to export the timesheet.');
        }
    };

    const metrics = [
        { label: 'Worked Today', value: formatHours(todayStats.totalHours), icon: Timer, color: 'text-emerald-700', bg: 'bg-emerald-50' },
        { label: 'Break Time', value: formatHours(todayStats.totalBreakTime), icon: Coffee, color: 'text-amber-700', bg: 'bg-amber-50' },
        { label: 'Sessions', value: todayStats.sessionsCount, icon: Activity, color: 'text-blue-700', bg: 'bg-blue-50' },
        { label: 'Actions', value: entries.length, icon: CalendarDays, color: 'text-violet-700', bg: 'bg-violet-50' },
    ];

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Dashboard" />

            <div className="min-h-screen bg-slate-100">
                <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                    <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-blue-700">{getTimeBasedGreeting()}</p>
                            <h1 className="mt-1 text-2xl font-bold text-slate-950">{auth.user.name}</h1>
                            <p className="mt-1 text-sm text-slate-600">Track today&apos;s work and review current team activity.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${currentStatus.className}`}>
                                <span className={`h-2 w-2 rounded-full ${currentStatus.dot}`} />
                                {currentStatus.label}
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-right shadow-sm">
                                <div className="text-lg font-bold text-slate-950">
                                    {currentTime.toLocaleTimeString('en-US', {
                                        timeZone: 'Asia/Karachi',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                    })}
                                </div>
                                <div className="text-xs font-medium text-slate-500">Pakistan Time</div>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {metrics.map((metric) => {
                            const Icon = metric.icon;
                            return (
                                <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${metric.bg}`}>
                                            <Icon className={`h-5 w-5 ${metric.color}`} />
                                        </span>
                                        <div>
                                            <div className="text-xl font-bold text-slate-950">{metric.value}</div>
                                            <div className="text-sm text-slate-600">{metric.label}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-bold text-slate-950">Time Tracking</h2>
                                <p className="text-sm text-slate-600">Last action: {actionLabel(todayStats.lastAction)}</p>
                            </div>
                            <div className="text-sm text-slate-600">Available actions follow your current status.</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
                            {ACTIONS.map((action) => {
                                const Icon = action.icon;
                                const disabled = isActionDisabled(action.type);
                                return (
                                    <button
                                        key={action.type}
                                        type="button"
                                        onClick={() => addEntry(action.type)}
                                        disabled={disabled}
                                        className={`flex min-h-20 items-center gap-3 rounded-lg px-4 py-3 text-left transition ${
                                            disabled
                                                ? 'cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400'
                                                : action.activeClass
                                        }`}
                                    >
                                        <Icon className="h-6 w-6 shrink-0" />
                                        <span>
                                            <span className="block text-sm font-bold">{action.label}</span>
                                            <span className={`block text-xs ${disabled ? 'text-slate-400' : 'opacity-80'}`}>{action.description}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-bold text-slate-950">
                                    {canViewTeam ? 'Team Activity Today' : 'Your Activity Today'}
                                </h2>
                                <p className="text-sm text-slate-600">Work, break, and attendance status.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {can('attendance.view') && (
                                    <Link
                                        href={route('employee-attendance.index')}
                                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                    >
                                        Open Attendance
                                    </Link>
                                )}
                                {employeesData.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={downloadCSV}
                                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                                    >
                                        <Download className="h-4 w-4" />
                                        Export
                                    </button>
                                )}
                            </div>
                        </div>

                        {employeesData.length === 0 ? (
                            <div className="px-5 py-12 text-center">
                                <UserRound className="mx-auto h-10 w-10 text-slate-400" />
                                <h3 className="mt-3 font-semibold text-slate-900">No activity recorded today</h3>
                                <p className="mt-1 text-sm text-slate-500">Time tracking activity will appear here.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-900">
                                        <tr>
                                            {['Employee', 'Status', 'Today', 'Break', 'Week', 'Month', 'Actions'].map((heading) => (
                                                <th key={heading} className="px-4 py-3 text-left text-xs font-bold uppercase text-white">{heading}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {employeesData.map((employee) => {
                                            const status = statusFromAction(
                                                employee.current_status === 'On Break'
                                                    ? 'break_start'
                                                    : employee.current_status === 'Clocked Out'
                                                        ? 'clock_out'
                                                        : 'clock_in'
                                            );
                                            return (
                                                <tr key={employee.user_id} className="hover:bg-slate-50">
                                                    <td className="whitespace-nowrap px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <EmployeeAvatar src={employee.avatar} name={employee.user_name} />
                                                            <div>
                                                                <div className="text-sm font-semibold text-slate-900">{employee.user_name}</div>
                                                                <div className="text-xs text-slate-500">{employee.designation}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-3">
                                                        <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                                                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                                                            {employee.current_status}
                                                        </span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-900">{formatHours(employee.total_work_hours)}</td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatHours(employee.total_break_hours)}</td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatHours(employee.weekly_work_hours || 0)}</td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatHours(employee.monthly_work_hours || 0)}</td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{employee.total_entries}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
