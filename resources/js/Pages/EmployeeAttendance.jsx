import React, { useEffect, useMemo, useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    Activity,
    CalendarDays,
    ChevronDown,
    ChevronUp,
    Clock,
    Coffee,
    Download,
    List,
    PauseCircle,
    PlayCircle,
    RotateCcw,
    Search,
    Square,
    Timer,
    Users,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { showError, showExportSuccess, showLoading } from '@/Utils/notifications';
import { formatHours } from '@/Utils/timeUtils';

const TABS = [
    { id: 'summary', label: 'Summary', icon: Activity },
    { id: 'detailed', label: 'Activity', icon: List },
    { id: 'timeline', label: 'Timeline', icon: Timer },
];

const STATUS_OPTIONS = ['all', 'Working', 'On Break', 'Clocked Out', 'Not Started'];

const statusStyle = (status) => {
    if (status === 'Working') return 'bg-emerald-50 text-emerald-800';
    if (status === 'On Break') return 'bg-amber-50 text-amber-800';
    if (status === 'Clocked Out') return 'bg-rose-50 text-rose-800';
    return 'bg-slate-100 text-slate-700';
};

const actionMeta = (actionType) => {
    if (actionType === 'clock_in') return { label: 'Clocked In', icon: PlayCircle, className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    if (actionType === 'clock_out') return { label: 'Clocked Out', icon: Square, className: 'bg-rose-50 text-rose-800 border-rose-200' };
    if (actionType === 'break_start') return { label: 'Break Started', icon: PauseCircle, className: 'bg-amber-50 text-amber-800 border-amber-200' };
    if (actionType === 'break_end') return { label: 'Break Ended', icon: RotateCcw, className: 'bg-blue-50 text-blue-800 border-blue-200' };
    return { label: actionType, icon: Clock, className: 'bg-slate-50 text-slate-800 border-slate-200' };
};

const EmployeeIdentity = ({ employee, size = 'small' }) => {
    const [imageFailed, setImageFailed] = useState(false);
    const avatarSize = size === 'large' ? 'h-11 w-11' : 'h-9 w-9';

    useEffect(() => {
        setImageFailed(false);
    }, [employee.avatar]);

    return (
        <div className="flex min-w-0 items-center gap-3">
            {employee.avatar && !imageFailed ? (
                <img
                    src={employee.avatar}
                    alt=""
                    className={`${avatarSize} shrink-0 rounded-full object-cover`}
                    onError={() => setImageFailed(true)}
                />
            ) : (
                <span className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700`}>
                    {employee.user_name.charAt(0).toUpperCase()}
                </span>
            )}
            <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{employee.user_name}</div>
                <div className="truncate text-xs text-slate-500">{employee.designation || 'Member'}</div>
            </div>
        </div>
    );
};

export default function EmployeeAttendance({ auth, serverDate }) {
    const canExport = auth.user?.is_super_admin || auth.user?.permissions?.includes('attendance.export');
    const [activeTab, setActiveTab] = useState('summary');
    const [employeesData, setEmployeesData] = useState([]);
    const [detailedActivityData, setDetailedActivityData] = useState([]);
    const [timelineData, setTimelineData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState(serverDate || new Date().toISOString().split('T')[0]);
    const [filterStatus, setFilterStatus] = useState('all');
    const [expandedEmployees, setExpandedEmployees] = useState({});
    const [lastRefreshTime, setLastRefreshTime] = useState(null);

    const fetchAttendanceData = async () => {
        setLoading(true);

        try {
            const endpoint = activeTab === 'summary'
                ? '/employee-attendance/summary'
                : activeTab === 'detailed'
                    ? '/employee-attendance/detailed'
                    : '/employee-attendance/timeline';
            const response = await axios.get(endpoint, { params: { date: selectedDate } });

            if (activeTab === 'summary') setEmployeesData(response.data.employees || []);
            if (activeTab === 'detailed') setDetailedActivityData(response.data.activities || []);
            if (activeTab === 'timeline') setTimelineData(response.data.timelines || []);
            setLastRefreshTime(new Date());
        } catch (error) {
            console.error('Attendance load failed:', error);
            showError('Unable to load attendance data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendanceData();
    }, [selectedDate, activeTab]);

    const downloadCSV = async () => {
        const loadingToast = showLoading('Preparing attendance report...');

        try {
            const response = await axios.get('/employee-attendance/export', {
                params: { date: selectedDate },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `employee-attendance-${selectedDate}.csv`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
            toast.dismiss(loadingToast);
            showExportSuccess();
        } catch (error) {
            console.error('Attendance export failed:', error);
            toast.dismiss(loadingToast);
            showError('Failed to export attendance report.');
        }
    };

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const matchesSearch = (item) => {
        if (!normalizedSearch) return true;
        return item.user_name?.toLowerCase().includes(normalizedSearch)
            || item.designation?.toLowerCase().includes(normalizedSearch);
    };

    const filteredEmployees = employeesData.filter((employee) =>
        matchesSearch(employee) && (filterStatus === 'all' || employee.current_status === filterStatus)
    );
    const filteredActivities = detailedActivityData.filter(matchesSearch);
    const filteredTimelines = timelineData.filter(matchesSearch);

    const summaryMetrics = useMemo(() => {
        const working = employeesData.filter((employee) => employee.current_status === 'Working').length;
        const onBreak = employeesData.filter((employee) => employee.current_status === 'On Break').length;
        const clockedOut = employeesData.filter((employee) => employee.current_status === 'Clocked Out').length;
        const workHours = employeesData.reduce((sum, employee) => sum + Number(employee.total_work_hours || 0), 0);
        return [
            { label: 'Active', value: working, icon: PlayCircle, color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'On Break', value: onBreak, icon: Coffee, color: 'text-amber-700', bg: 'bg-amber-50' },
            { label: 'Clocked Out', value: clockedOut, icon: Square, color: 'text-rose-700', bg: 'bg-rose-50' },
            { label: 'Team Hours', value: formatHours(workHours), icon: Timer, color: 'text-blue-700', bg: 'bg-blue-50' },
        ];
    }, [employeesData]);

    const toggleEmployee = (employeeId) => {
        setExpandedEmployees((current) => ({ ...current, [employeeId]: !current[employeeId] }));
    };

    const setAllExpanded = (items, expanded) => {
        if (!expanded) {
            setExpandedEmployees({});
            return;
        }

        setExpandedEmployees(Object.fromEntries(items.map((item) => [item.user_id, true])));
    };

    const renderEmpty = (title, description) => (
        <div className="px-5 py-14 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
    );

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Attendance" />

            <div className="min-h-screen bg-slate-100">
                <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                    <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-blue-700">Team operations</p>
                            <h1 className="mt-1 text-2xl font-bold text-slate-950">Attendance</h1>
                            <p className="mt-1 text-sm text-slate-600">Monitor current status, work time, breaks, and daily activity.</p>
                            {lastRefreshTime && (
                                <p className="mt-1 text-xs text-slate-500">Updated {lastRefreshTime.toLocaleTimeString()}</p>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <label className="relative">
                                <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(event) => setSelectedDate(event.target.value)}
                                    className="rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                />
                            </label>
                            {canExport && (
                                <button
                                    type="button"
                                    onClick={downloadCSV}
                                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                                >
                                    <Download className="h-4 w-4" />
                                    Export CSV
                                </button>
                            )}
                        </div>
                    </section>

                    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {summaryMetrics.map((metric) => {
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
                        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="inline-flex w-full rounded-lg bg-slate-100 p-1 lg:w-auto">
                                {TABS.map((tab) => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition lg:flex-none ${
                                                activeTab === tab.id
                                                    ? 'bg-white text-slate-950 shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-950'
                                            }`}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                                <label className="relative min-w-64 flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                        placeholder="Search employee or shift"
                                        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                    />
                                </label>

                                {activeTab === 'summary' && (
                                    <select
                                        value={filterStatus}
                                        onChange={(event) => setFilterStatus(event.target.value)}
                                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                    >
                                        {STATUS_OPTIONS.map((status) => (
                                            <option key={status} value={status}>
                                                {status === 'all' ? 'All statuses' : status}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center gap-3 px-5 py-16 text-sm font-medium text-slate-600">
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                                Loading attendance data...
                            </div>
                        ) : (
                            <>
                                {activeTab === 'summary' && (
                                    filteredEmployees.length === 0
                                        ? renderEmpty('No attendance records', 'No employees match the selected date and filters.')
                                        : (
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-slate-200">
                                                    <thead className="bg-slate-900">
                                                        <tr>
                                                            {['Employee', 'Status', 'Work Hours', 'Break', 'First In', 'Last Activity', 'Actions'].map((heading) => (
                                                                <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase text-white">{heading}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200">
                                                        {filteredEmployees.map((employee) => (
                                                            <tr key={employee.user_id} className="hover:bg-slate-50">
                                                                <td className="px-4 py-3"><EmployeeIdentity employee={employee} /></td>
                                                                <td className="whitespace-nowrap px-4 py-3">
                                                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(employee.current_status)}`}>
                                                                        {employee.current_status}
                                                                    </span>
                                                                </td>
                                                                <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-900">{formatHours(employee.total_work_hours)}</td>
                                                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatHours(employee.total_break_hours)}</td>
                                                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{employee.first_clock_in || '-'}</td>
                                                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{employee.last_action_time || '-'}</td>
                                                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{employee.total_entries}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )
                                )}

                                {activeTab === 'detailed' && (
                                    filteredActivities.length === 0
                                        ? renderEmpty('No activity records', 'No activity matches the selected date and search.')
                                        : (
                                            <AccordionList
                                                items={filteredActivities}
                                                expandedEmployees={expandedEmployees}
                                                toggleEmployee={toggleEmployee}
                                                setAllExpanded={setAllExpanded}
                                                renderContent={(activity) => (
                                                    <div className="space-y-2">
                                                        {activity.entries.map((entry) => {
                                                            const meta = actionMeta(entry.action_type);
                                                            const Icon = meta.icon;
                                                            return (
                                                                <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                                                                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${meta.className}`}>
                                                                        <Icon className="h-4 w-4" />
                                                                    </span>
                                                                    <div className="flex-1">
                                                                        <div className="text-sm font-semibold text-slate-900">{meta.label}</div>
                                                                        <div className="text-xs text-slate-500">{entry.formatted_time}</div>
                                                                    </div>
                                                                    {entry.notes && <div className="text-sm text-slate-600">{entry.notes}</div>}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            />
                                        )
                                )}

                                {activeTab === 'timeline' && (
                                    filteredTimelines.length === 0
                                        ? renderEmpty('No timeline records', 'No sessions match the selected date and search.')
                                        : (
                                            <AccordionList
                                                items={filteredTimelines}
                                                expandedEmployees={expandedEmployees}
                                                toggleEmployee={toggleEmployee}
                                                setAllExpanded={setAllExpanded}
                                                renderContent={(timeline) => (
                                                    <div className="space-y-2">
                                                        {timeline.sessions.map((session, index) => (
                                                            <div key={`${timeline.user_id}-${index}`} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                                                                        session.type === 'work' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                                                    }`}>
                                                                        {session.type === 'work' ? <Timer className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
                                                                    </span>
                                                                    <div>
                                                                        <div className="text-sm font-semibold text-slate-900">
                                                                            {session.type === 'work' ? 'Work Session' : 'Break'}
                                                                        </div>
                                                                        <div className="text-xs text-slate-500">
                                                                            {session.start_time} to {session.end_time || 'Ongoing'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-sm font-bold text-slate-900">{session.duration}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            />
                                        )
                                )}
                            </>
                        )}
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function AccordionList({ items, expandedEmployees, toggleEmployee, setAllExpanded, renderContent }) {
    return (
        <div>
            <div className="flex justify-end gap-2 border-b border-slate-200 px-4 py-3">
                <button
                    type="button"
                    onClick={() => setAllExpanded(items, true)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                    Expand all
                </button>
                <button
                    type="button"
                    onClick={() => setAllExpanded(items, false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                    Collapse all
                </button>
            </div>

            <div className="divide-y divide-slate-200">
                {items.map((item) => {
                    const expanded = Boolean(expandedEmployees[item.user_id]);
                    return (
                        <div key={item.user_id}>
                            <button
                                type="button"
                                onClick={() => toggleEmployee(item.user_id)}
                                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50"
                            >
                                <EmployeeIdentity employee={item} size="large" />
                                <div className="flex items-center gap-3">
                                    {item.entries && <span className="text-sm font-semibold text-slate-600">{item.entries.length} actions</span>}
                                    {item.sessions && (
                                        <span className="hidden text-sm text-slate-600 sm:inline">
                                            {formatHours(item.total_work_hours)} work, {formatHours(item.total_break_hours)} break
                                        </span>
                                    )}
                                    {expanded ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
                                </div>
                            </button>
                            {expanded && <div className="border-t border-slate-100 bg-slate-50 p-4">{renderContent(item)}</div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
