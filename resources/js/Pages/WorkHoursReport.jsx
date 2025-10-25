import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import AnimatedBackground from '../Components/AnimatedBackground';
import { TraditionalPagination } from '../Components/Pagination';
import { Head, Link, router } from '@inertiajs/react';
import { timeFormat } from '../helpers';

// Toast Notification Component
function Toast({ message, type = 'success', onClose }) {
    if (!message) return null;
    
    const bgClass = type === 'error' 
        ? 'bg-gradient-to-r from-red-500 to-red-600' 
        : 'bg-gradient-to-r from-emerald-500 to-teal-500';

    return (
        <div className={`fixed top-5 right-5 z-50 ${bgClass} text-white px-6 py-3 rounded-xl shadow-2xl flex items-center`}>
            <span className="font-medium">{message}</span>
            <button onClick={onClose} className="ml-4 text-white hover:text-gray-200 font-bold text-lg">&times;</button>
        </div>
    );
}

// Helper Functions
const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDateRange = (filter) => {
    const today = new Date();
    let start, end;
    
    if (filter === 'today') {
        start = end = formatDateLocal(today);
    } else if (filter === 'week') {
        const dayOfWeek = today.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(today);
        monday.setDate(monday.getDate() - daysFromMonday);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        start = formatDateLocal(monday);
        end = formatDateLocal(sunday);
    } else if (filter === 'month') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        start = formatDateLocal(firstDay);
        end = formatDateLocal(lastDay);
    }
    
    return { start, end };
};

const formatWorkType = (workType) => {
    const types = {
        'tracker': 'Tracker',
        'manual': 'Manual Time',
        'test_task': 'Test Task',
        'fixed': 'Fixed Project',
        'office_work': 'Office Work',
        'outside_of_upwork': 'Outside of Upwork'
    };
    return types[workType] || workType;
};

export default function WorkHoursReport({ auth, workHours, users = [], flash }) {
    const [toast, setToast] = useState(flash?.success || flash?.error || '');
    const [toastType, setToastType] = useState(flash?.success ? 'success' : 'error');
    const [dateFilter, setDateFilter] = useState('week');
    const [customStartDate, setCustomStartDate] = useState(null);
    const [customEndDate, setCustomEndDate] = useState(null);
    const [selectedUser, setSelectedUser] = useState('all');
    const [selectedWorkType, setSelectedWorkType] = useState('all');
    const [selectedClient, setSelectedClient] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        if (flash?.success || flash?.error) {
            setToast(flash.success || flash.error);
            setToastType(flash.success ? 'success' : 'error');
        }
    }, [flash]);

    // Get unique values for filters
    const uniqueClients = [...new Set(workHours?.data?.map(entry => entry.client?.name).filter(Boolean))] || [];
    const uniqueWorkTypes = [...new Set(workHours?.data?.map(entry => entry.work_type).filter(Boolean))] || [];

    // Apply filters
    const applyFilters = () => {
        const params = {
            user: selectedUser,
            workType: selectedWorkType,
            client: selectedClient,
            filter: dateFilter,
        };

        if (dateFilter === 'custom' && customStartDate && customEndDate) {
            params.startDate = formatDateLocal(customStartDate);
            params.endDate = formatDateLocal(customEndDate);
        } else if (dateFilter !== 'all' && dateFilter !== 'custom') {
            const range = getDateRange(dateFilter);
            params.startDate = range.start;
            params.endDate = range.end;
        }

        router.get(route('work-hours-report.index'), params, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const clearFilters = () => {
        setDateFilter('all');
        setCustomStartDate(null);
        setCustomEndDate(null);
        setSelectedUser('all');
        setSelectedWorkType('all');
        setSelectedClient('all');
        setSearchTerm('');
        
        router.get(route('work-hours-report.index'));
    };

    const exportToExcel = () => {
        setIsExporting(true);
        try {
            const data = filteredData.map(entry => ({
                'Date': entry.date,
                'User': entry.user?.name || 'N/A',
                'Client': entry.client?.name || 'No Client',
                'Work Type': formatWorkType(entry.work_type),
                'Tracker': entry.tracker,
                'Hours': timeFormat(entry.hours),
                'Description': entry.description || ''
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Work Hours Report');
            XLSX.writeFile(wb, `work-hours-report-${new Date().toISOString().split('T')[0]}.xlsx`);
            
            setToast('Report exported successfully!');
            setToastType('success');
        } catch (error) {
            setToast('Export failed');
            setToastType('error');
        } finally {
            setIsExporting(false);
        }
    };

    // Filter data based on search
    const filteredData = workHours?.data?.filter(entry => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            entry.user?.name?.toLowerCase().includes(search) ||
            entry.client?.name?.toLowerCase().includes(search) ||
            entry.description?.toLowerCase().includes(search) ||
            entry.tracker?.toLowerCase().includes(search)
        );
    }) || [];

    // Calculate statistics
    const totalHours = filteredData.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
    const totalEntries = filteredData.length;
    const uniqueUsers = new Set(filteredData.map(entry => entry.user?.name).filter(Boolean)).size;
    const uniqueClientsCount = new Set(filteredData.map(entry => entry.client?.name).filter(Boolean)).size;

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Work Hours Report" />
            
            {toast && <Toast message={toast} type={toastType} onClose={() => setToast('')} />}
            
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-blue-50/30">
                <AnimatedBackground />
            </div>

            {/* Main Content */}
            <div className="py-12 min-h-screen relative z-10">
                <div className="max-w-full mx-auto px-6 lg:px-12 xl:px-16">
                    
                    {/* Header Card */}
                    <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 mb-8 border border-slate-100">
                        <div className="flex items-start gap-6">
                            <div className="flex-shrink-0">
                                <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl shadow-lg">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="flex-1">
                                <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">Work Hours Report</h1>
                                <p className="text-slate-600 text-base lg:text-lg">View and analyze team work hours with detailed reports</p>
                            </div>
                        </div>
                    </div>

                    {/* Filters & Actions Card */}
                    <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-slate-100">
                        <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`inline-flex items-center px-4 py-2 ${showFilters ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'} hover:bg-emerald-600 hover:text-white rounded-xl font-medium transition-all shadow-md`}
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                    </svg>
                                    {showFilters ? 'Hide Filters' : 'Show Filters'}
                                </button>

                                <button
                                    onClick={exportToExcel}
                                    disabled={isExporting}
                                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 text-white rounded-xl font-medium transition-all shadow-lg"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    {isExporting ? 'Exporting...' : 'Export Report'}
                                </button>

                                {(selectedUser !== 'all' || selectedWorkType !== 'all' || selectedClient !== 'all' || dateFilter !== 'all') && (
                                    <button
                                        onClick={clearFilters}
                                        className="inline-flex items-center px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-medium transition-all"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        Clear Filters
                                    </button>
                                )}
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>

                        {/* Filters Panel */}
                        {showFilters && (
                            <div className="pt-4 border-t border-slate-200 space-y-4">
                                {/* Date Range */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Date Range</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['all', 'today', 'week', 'month', 'custom'].map(filter => (
                                            <button
                                                key={filter}
                                                onClick={() => {
                                                    setDateFilter(filter);
                                                    if (filter !== 'custom') {
                                                        setTimeout(applyFilters, 100);
                                                    }
                                                }}
                                                className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                                                    dateFilter === filter
                                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                {filter === 'all' ? 'All Dates' : filter === 'week' ? 'This Week' : filter === 'month' ? 'This Month' : filter}
                                            </button>
                                        ))}
                                    </div>

                                    {dateFilter === 'custom' && (
                                        <div className="flex flex-wrap gap-4 mt-4">
                                            <div>
                                                <label className="block text-sm text-slate-600 mb-1">Start Date</label>
                                                <DatePicker
                                                    selected={customStartDate}
                                                    onChange={(date) => setCustomStartDate(date)}
                                                    maxDate={customEndDate || new Date()}
                                                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                                    dateFormat="yyyy-MM-dd"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-600 mb-1">End Date</label>
                                                <DatePicker
                                                    selected={customEndDate}
                                                    onChange={(date) => setCustomEndDate(date)}
                                                    minDate={customStartDate}
                                                    maxDate={new Date()}
                                                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                                    dateFormat="yyyy-MM-dd"
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <button
                                                    onClick={applyFilters}
                                                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-all"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Other Filters */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* User Filter */}
                                    {auth.user.role === 'admin' && users.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">User</label>
                                            <select
                                                value={selectedUser}
                                                onChange={(e) => {
                                                    setSelectedUser(e.target.value);
                                                    setTimeout(applyFilters, 100);
                                                }}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                            >
                                                <option value="all">All Users</option>
                                                {users.map(user => (
                                                    <option key={user.id} value={user.id}>{user.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Work Type Filter */}
                                    {uniqueWorkTypes.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Work Type</label>
                                            <select
                                                value={selectedWorkType}
                                                onChange={(e) => {
                                                    setSelectedWorkType(e.target.value);
                                                    setTimeout(applyFilters, 100);
                                                }}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                            >
                                                <option value="all">All Types</option>
                                                {uniqueWorkTypes.map(type => (
                                                    <option key={type} value={type}>{formatWorkType(type)}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Client Filter */}
                                    {uniqueClients.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Client</label>
                                            <select
                                                value={selectedClient}
                                                onChange={(e) => {
                                                    setSelectedClient(e.target.value);
                                                    setTimeout(applyFilters, 100);
                                                }}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                            >
                                                <option value="all">All Clients</option>
                                                {uniqueClients.map(client => (
                                                    <option key={client} value={client}>{client}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Data Table */}
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-gradient-to-r from-emerald-500 to-teal-500">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">User</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Client</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Work Type</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Tracker</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Hours</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredData.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center">
                                                    <svg className="w-12 h-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                    </svg>
                                                    <h3 className="text-lg font-medium text-slate-900 mb-2">No data found</h3>
                                                    <p className="text-slate-600">Try adjusting your filters</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredData.map((entry, index) => (
                                            <tr key={entry.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-emerald-50 transition-colors`}>
                                                <td className="px-4 py-3 text-sm text-slate-900 font-medium">{entry.date}</td>
                                                <td className="px-4 py-3 text-sm text-slate-900">{entry.user?.name || 'N/A'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-900">{entry.client?.name || 'No Client'}</td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                                        {formatWorkType(entry.work_type)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-teal-100 text-teal-700 rounded-full capitalize">
                                                        {entry.tracker}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-green-600">{timeFormat(entry.hours)}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    <div className="max-w-xs truncate" title={entry.description}>
                                                        {entry.description || '-'}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {filteredData.length > 0 && (
                                    <tfoot className="bg-gradient-to-r from-emerald-50 to-teal-50">
                                        <tr>
                                            <td colSpan="5" className="px-4 py-3 text-right font-bold text-slate-900">Total:</td>
                                            <td className="px-4 py-3 font-bold text-green-600 text-lg">{timeFormat(totalHours.toFixed(2))}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Pagination */}
                        {workHours?.data && workHours.data.length > 0 && (
                            <div className="p-6 border-t border-slate-200">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="text-slate-700 text-sm font-medium">
                                        Showing {workHours.from || 0} to {workHours.to || 0} of {workHours.total || 0} entries
                                    </div>
                                </div>
                                <TraditionalPagination 
                                    pagination={workHours}
                                    preserveState={true}
                                    preserveScroll={false}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
