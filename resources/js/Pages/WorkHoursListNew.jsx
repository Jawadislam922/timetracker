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

export default function WorkHoursList({ auth, workHours, flash }) {
    const [deleteId, setDeleteId] = useState(null);
    const [toast, setToast] = useState(flash?.success || flash?.error || '');
    const [toastType, setToastType] = useState(flash?.success ? 'success' : 'error');
    const [selectedEntries, setSelectedEntries] = useState(new Set());
    const [isExporting, setIsExporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState(null);

    useEffect(() => {
        if (flash?.success || flash?.error) {
            setToast(flash.success || flash.error);
            setToastType(flash.success ? 'success' : 'error');
        }
    }, [flash]);

    const handleDelete = (id) => setDeleteId(id);

    const confirmDelete = () => {
        if (!deleteId) return;
        router.delete(route('work-hours.destroy', deleteId), {
            onSuccess: () => {
                setToast('Work entry deleted successfully');
                setToastType('success');
                setDeleteId(null);
            },
            onError: () => {
                setToast('Failed to delete work entry');
                setToastType('error');
                setDeleteId(null);
            },
        });
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedEntries);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedEntries(newSelected);
    };

    const selectAllPage = () => {
        const pageIds = workHours?.data?.map(entry => entry.id) || [];
        setSelectedEntries(new Set(pageIds));
    };

    const clearSelection = () => setSelectedEntries(new Set());

    const handleBulkDelete = () => {
        if (selectedEntries.size === 0) return;
        
        const entryIds = Array.from(selectedEntries);
        router.delete(route('work-hours.bulk-destroy'), {
            data: { entry_ids: entryIds },
            onSuccess: () => {
                setToast(`${entryIds.length} entries deleted successfully`);
                setToastType('success');
                clearSelection();
            },
            onError: () => {
                setToast('Failed to delete entries');
                setToastType('error');
            },
        });
    };

    const exportToCSV = async () => {
        setIsExporting(true);
        try {
            const data = workHours?.data || [];
            const csvData = data.map(entry => ({
                'ID': entry.id,
                'Date': entry.date,
                'Client': entry.client?.name || 'No Client',
                'Work Type': formatWorkType(entry.work_type),
                'Tracker': entry.tracker,
                'Hours': timeFormat(entry.hours),
                'Description': entry.description || ''
            }));

            const ws = XLSX.utils.json_to_sheet(csvData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Work Hours');
            XLSX.writeFile(wb, `work-hours-${new Date().toISOString().split('T')[0]}.xlsx`);
            
            setToast('Export successful!');
            setToastType('success');
        } catch (error) {
            setToast('Export failed');
            setToastType('error');
        } finally {
            setIsExporting(false);
        }
    };

    const filteredData = workHours?.data?.filter(entry => {
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return (
                entry.client?.name?.toLowerCase().includes(search) ||
                entry.description?.toLowerCase().includes(search) ||
                entry.tracker?.toLowerCase().includes(search)
            );
        }
        return true;
    }) || [];

    const totalHours = filteredData.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Work Hours" />
            
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
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="flex-1">
                                <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">My Work Hours</h1>
                                <p className="text-slate-600 text-base lg:text-lg">View and manage your personal work diary</p>
                            </div>
                        </div>
                    </div>

                    {/* Actions Card */}
                    <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-slate-100">
                        <div className="flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex flex-wrap gap-3">
                                <Link 
                                    href={route('work-hours.create')}
                                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Entry
                                </Link>

                                <button
                                    onClick={exportToCSV}
                                    disabled={isExporting}
                                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-medium transition-all shadow-lg"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    {isExporting ? 'Exporting...' : 'Export CSV'}
                                </button>

                                {selectedEntries.size > 0 && (
                                    <>
                                        <button
                                            onClick={handleBulkDelete}
                                            className="inline-flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all shadow-lg"
                                        >
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Delete ({selectedEntries.size})
                                        </button>
                                        <button
                                            onClick={clearSelection}
                                            className="inline-flex items-center px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-medium transition-all"
                                        >
                                            Clear Selection
                                        </button>
                                    </>
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

                        {/* Bulk Actions */}
                        {workHours?.data && workHours.data.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap gap-2">
                                <button
                                    onClick={selectAllPage}
                                    className="inline-flex items-center px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-all"
                                >
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Select Page ({workHours.data.length})
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Table Card */}
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-gradient-to-r from-emerald-500 to-teal-500">
                                    <tr>
                                        <th className="w-12 px-4 py-3 text-left">
                                            <input
                                                type="checkbox"
                                                checked={selectedEntries.size === filteredData.length && filteredData.length > 0}
                                                onChange={selectAllPage}
                                                className="w-4 h-4 text-emerald-600 bg-white border-emerald-300 rounded focus:ring-emerald-500"
                                            />
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">ID</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Client</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Work Type</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Tracker</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Hours</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Description</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredData.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center">
                                                    <svg className="w-12 h-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <h3 className="text-lg font-medium text-slate-900 mb-2">No work hours found</h3>
                                                    <p className="text-slate-600 mb-4">Start tracking your work hours</p>
                                                    <Link 
                                                        href={route('work-hours.create')}
                                                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-medium"
                                                    >
                                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                        </svg>
                                                        Add First Entry
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredData.map((entry, index) => (
                                            <tr 
                                                key={entry.id} 
                                                className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-emerald-50 transition-colors ${selectedEntries.has(entry.id) ? 'ring-2 ring-emerald-400 bg-emerald-50' : ''}`}
                                            >
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEntries.has(entry.id)}
                                                        onChange={() => toggleSelection(entry.id)}
                                                        className="w-4 h-4 text-emerald-600 bg-white border-slate-300 rounded focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{entry.id}</td>
                                                <td className="px-4 py-3 text-sm text-slate-900 font-medium">{entry.date}</td>
                                                <td className="px-4 py-3 text-sm text-slate-900">{entry.client?.name || 'No Client'}</td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                                                        {formatWorkType(entry.work_type)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-teal-100 text-teal-700 rounded-full border border-teal-200 capitalize">
                                                        {entry.tracker}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-green-600">{timeFormat(entry.hours)}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    <div className="max-w-xs truncate" title={entry.description}>
                                                        {entry.description || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <div className="flex gap-2">
                                                        <Link 
                                                            href={route('work-hours.edit', entry.id)}
                                                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-all"
                                                        >
                                                            Edit
                                                        </Link>
                                                        <button 
                                                            onClick={() => handleDelete(entry.id)}
                                                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-all"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {filteredData.length > 0 && (
                                    <tfoot className="bg-gradient-to-r from-emerald-50 to-teal-50">
                                        <tr>
                                            <td colSpan="6" className="px-4 py-3 text-right font-bold text-slate-900">Total:</td>
                                            <td className="px-4 py-3 font-bold text-green-600 text-lg">{timeFormat(totalHours.toFixed(2))}</td>
                                            <td colSpan="2"></td>
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

            {/* Delete Modal */}
            {deleteId && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Confirm Delete</h3>
                        <p className="text-slate-600 mb-6">Are you sure you want to delete this work entry? This action cannot be undone.</p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
