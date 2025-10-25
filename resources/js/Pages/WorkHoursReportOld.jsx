import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { timeFormat } from '../helpers';
import AnimatedBackground from '../Components/AnimatedBackground';
import { TraditionalPagination } from '../Components/Pagination';

function Toast({ message, onClose }) {
    if (!message) return null;
    return (
        <div className="fixed top-5 right-5 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-900 px-6 py-3 rounded-xl shadow-2xl flex items-center backdrop-blur-xl border border-slate-300">
            <span className="font-medium">{message}</span>
            <button onClick={onClose} className="ml-4 text-slate-900 hover:text-blue-200 font-bold text-lg transition-colors">&times;</button>
        </div>
    );
}

function FilterPagination({ currentPage, totalPages, onPageChange }) {
    if (totalPages <= 1) return null;
    
    return (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
            <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs bg-white/10 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 rounded transition-colors"
            >
                ← Prev
            </button>
            <span className="text-xs text-slate-600">
                Page {currentPage} of {totalPages}
            </span>
            <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs bg-white/10 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 rounded transition-colors"
            >
                Next →
            </button>
        </div>
    );
}

// Helper function to format date in local timezone as YYYY-MM-DD
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
        // Get Monday as the first day of the current week
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, Monday was 6 days ago
        
        // Calculate Monday of current week using local date methods
        const monday = new Date(today);
        monday.setDate(monday.getDate() - daysFromMonday);
        
        // Calculate Sunday of current week (6 days after Monday)
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        
        start = formatDateLocal(monday);
        end = formatDateLocal(sunday);
    } else if (filter === 'month') {
        // First day of current month
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        // Last day of current month
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        start = formatDateLocal(firstDay);
        end = formatDateLocal(lastDay);
    }
    return { start, end };
};

export default function WorkHoursList({ auth, workHours, users = [], flash, filter = 'all', startDate = '', endDate = '', workType = 'all', userId = 'all', designation = 'all', tracker = 'all', client = 'all', perPage = 15, availableDesignations = [], availableTrackers = [], availableClients = [] }) {
    const [deleteId, setDeleteId] = useState(null);
    const [toast, setToast] = useState(flash?.success || '');
    const [activeFilter, setActiveFilter] = useState(filter);
    const [activeWorkType, setActiveWorkType] = useState(workType);
    const [activeUser, setActiveUser] = useState(userId);
    const [activeDesignation, setActiveDesignation] = useState(designation);
    const [activeTracker, setActiveTracker] = useState(tracker);
    const [activeClient, setActiveClient] = useState(client);
    const [customStartDate, setCustomStartDate] = useState(startDate ? new Date(startDate) : null);
    const [customEndDate, setCustomEndDate] = useState(endDate ? new Date(endDate) : null);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [designationSearch, setDesignationSearch] = useState('');
    const [trackerSearch, setTrackerSearch] = useState('');
    const [clientSearch, setClientSearch] = useState('');
    const [selectedPerPage, setSelectedPerPage] = useState(perPage);
    const [isExporting, setIsExporting] = useState(false);
    
    // Bulk selection states
    const [selectedEntries, setSelectedEntries] = useState(new Set());
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Pagination states for filters
    const [userPage, setUserPage] = useState(1);
    const [clientPage, setClientPage] = useState(1);
    const itemsPerPage = 10;

    // Helper to format work type for display
    const formatWorkType = (workType) => {
        const workTypeMap = {
            'tracker': 'Tracker',
            'manual': 'Manual Time',
            'test_task': 'Test Task',
            'fixed': 'Fixed Project',
            'office_work': 'Office Work',
            'outside_of_upwork': 'Outside of Upwork'
        };
        return workTypeMap[workType] || workType;
    };

    // Helper to get unique values for filters
    // Use backend-provided filter options for all pages
    const getUniqueDesignations = () => {
        return availableDesignations;
    };

    const getUniqueTrackers = () => {
        return availableTrackers;
    };

    const getUniqueClients = () => {
        return availableClients;
    };

    // Helper to convert decimal hours to HH:mm:ss
    const decimalToDuration = (decimal) => {
        if (!decimal && decimal !== 0) return '';
        const totalSeconds = Math.round(Number(decimal) * 3600);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds]
            .map(v => String(v).padStart(2, '0'))
            .join(':');
    };

    const exportToCSV = async () => {
        if (isExporting) return; // Prevent multiple exports
        
        setIsExporting(true);
        setToast('Preparing export data...');
        
        try {
            // Build the same filter parameters as current filters
            const params = { filter: activeFilter };
            
            if (activeFilter === 'custom') {
                if (customStartDate && customEndDate) {
                    params.startDate = customStartDate.toISOString().slice(0, 10);
                    params.endDate = customEndDate.toISOString().slice(0, 10);
                }
            } else if (activeFilter !== 'all') {
                const { start, end } = getDateRange(activeFilter);
                params.startDate = start;
                params.endDate = end;
            }
            
            // Apply all active filters
            if (activeWorkType && activeWorkType !== 'all') {
                params.workType = activeWorkType;
            }
            if (activeUser && activeUser !== 'all') {
                params.userId = activeUser;
            }
            if (activeDesignation && activeDesignation !== 'all') {
                params.designation = activeDesignation;
            }
            if (activeTracker && activeTracker !== 'all') {
                params.tracker = activeTracker;
            }
            if (activeClient && activeClient !== 'all') {
                params.client = activeClient;
            }
            
            // Build query string
            const queryString = new URLSearchParams(params).toString();
            const url = `${route('work-hours.export')}?${queryString}`;
            
            // Fetch all filtered data from dedicated export endpoint
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch export data');
            }
            
            const result = await response.json();
            const allWorkHours = result.data;
            
            // Transform data for export
            const data = allWorkHours.map(entry => ({
                User: entry.user.name,
                Designation: entry.user.designation || 'N/A',
                'Work Type': formatWorkType(entry.work_type),
                Tracker: entry.tracker,
                Date: entry.date,
                Client: entry.client?.name || 'No Client',
                Hours: decimalToDuration(entry.hours),
                Description: entry.description,
            }));
            
            // Create and download CSV
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'WorkHours');
            XLSX.writeFile(workbook, 'work_hours_report.csv', { bookType: 'csv' });
            
            setToast(`Successfully exported ${data.length} entries to CSV`);
        } catch (error) {
            console.error('Export error:', error);
            setToast('Failed to export data. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleDelete = (id) => {
        setDeleteId(id);
    };

    const confirmDelete = () => {
        if (!deleteId) return;
        router.delete(route('work-hours.destroy', deleteId), {
            onSuccess: () => {
                setToast('Entry deleted successfully.');
                setDeleteId(null);
            },
            onError: () => {
                setToast('Failed to delete entry.');
                setDeleteId(null);
            },
        });
    };

    const closeToast = () => setToast('');

    const handleUserFilter = (id) => {
        setActiveUser(id);
        setUserSearchTerm('');
        handleFilter(activeFilter, activeWorkType, id);
    };

    // Filter users based on search term
    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(userSearchTerm.toLowerCase())
    );

    // Pagination helpers
    const paginateItems = (items, page, perPage) => {
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        return items.slice(startIndex, endIndex);
    };

    const getTotalPages = (totalItems, perPage) => {
        return Math.ceil(totalItems / perPage);
    };

    // Bulk selection helper functions
    const toggleSelectEntry = (entryId) => {
        const newSelected = new Set(selectedEntries);
        if (newSelected.has(entryId)) {
            newSelected.delete(entryId);
        } else {
            newSelected.add(entryId);
        }
        setSelectedEntries(newSelected);
    };

    const selectCurrentPage = () => {
        const currentPageIds = new Set(workHours?.data?.map(entry => entry.id) || []);
        setSelectedEntries(currentPageIds);
    };

    const selectAllEntries = async () => {
        try {
            // Build the same filter parameters as current filters for getting all entry IDs
            const params = { filter: activeFilter, idsOnly: true };
            
            if (activeFilter === 'custom') {
                if (customStartDate && customEndDate) {
                    params.startDate = customStartDate.toISOString().slice(0, 10);
                    params.endDate = customEndDate.toISOString().slice(0, 10);
                }
            } else if (activeFilter !== 'all') {
                const { start, end } = getDateRange(activeFilter);
                params.startDate = start;
                params.endDate = end;
            }
            
            // Apply all active filters
            if (activeWorkType && activeWorkType !== 'all') {
                params.workType = activeWorkType;
            }
            if (activeUser && activeUser !== 'all') {
                params.userId = activeUser;
            }
            if (activeDesignation && activeDesignation !== 'all') {
                params.designation = activeDesignation;
            }
            if (activeTracker && activeTracker !== 'all') {
                params.tracker = activeTracker;
            }
            if (activeClient && activeClient !== 'all') {
                params.client = activeClient;
            }
            
            // Fetch all IDs with current filters
            const queryString = new URLSearchParams(params).toString();
            const url = `${route('work-hours.export')}?${queryString}`;
            
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch all entries');
            }
            
            const result = await response.json();
            const allIds = new Set(result.data.map(entry => entry.id));
            setSelectedEntries(allIds);
            setToast(`Selected ${allIds.size} entries across all pages`);
        } catch (error) {
            console.error('Error selecting all entries:', error);
            setToast('Failed to select all entries. Please try again.');
        }
    };

    const clearSelection = () => {
        setSelectedEntries(new Set());
    };

    const handleBulkDelete = async () => {
        if (selectedEntries.size === 0) return;
        
        setIsDeleting(true);
        
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            
            const response = await fetch(route('work-hours.bulk-delete'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    ids: Array.from(selectedEntries)
                })
            });

            if (!response.ok) {
                throw new Error('Failed to delete entries');
            }

            const result = await response.json();
            
            // Refresh the page data
            router.reload({
                only: ['workHours', 'flash'],
                onSuccess: () => {
                    setSelectedEntries(new Set());
                    setShowBulkConfirm(false);
                    setToast(`Successfully deleted ${result.deleted_count} entries`);
                }
            });
        } catch (error) {
            console.error('Bulk delete error:', error);
            setToast('Failed to delete entries. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Paginated filter data
    const paginatedUsers = paginateItems(filteredUsers, userPage, itemsPerPage);
    const totalUserPages = getTotalPages(filteredUsers.length, itemsPerPage);

    const filteredClients = getUniqueClients().filter(client => 
        client.toLowerCase().includes(clientSearch.toLowerCase())
    );
    const paginatedClients = paginateItems(filteredClients, clientPage, itemsPerPage);
    const totalClientPages = getTotalPages(filteredClients.length, itemsPerPage);

    const handleFilter = (filter, workTypeFilter = activeWorkType, userFilter = activeUser, designationFilter = activeDesignation, trackerFilter = activeTracker, clientFilter = activeClient) => {
        setActiveFilter(filter);
        const params = { filter, perPage: selectedPerPage };
        if (filter === 'custom') {
            if (customStartDate && customEndDate) {
                params.startDate = customStartDate.toISOString().slice(0, 10);
                params.endDate = customEndDate.toISOString().slice(0, 10);
            }
        } else if (filter !== 'all') {
            const { start, end } = getDateRange(filter);
            params.startDate = start;
            params.endDate = end;
        }
        if (workTypeFilter && workTypeFilter !== 'all') {
            params.workType = workTypeFilter;
        }
        if (userFilter && userFilter !== 'all') {
            params.userId = userFilter;
        }
        if (designationFilter && designationFilter !== 'all') {
            params.designation = designationFilter;
        }
        if (trackerFilter && trackerFilter !== 'all') {
            params.tracker = trackerFilter;
        }
        if (clientFilter && clientFilter !== 'all') {
            params.client = clientFilter;
        }
        router.get(route('work-hours.report'), params, {
            preserveState: true,
            preserveScroll: true,
            only: ['workHours', 'flash']
        });
    };

    const handleWorkTypeFilter = (type) => {
        setActiveWorkType(type);
        handleFilter(activeFilter, type);
    };

    const handleDesignationFilter = (designation) => {
        setActiveDesignation(designation);
        setDesignationSearch('');
        handleFilter(activeFilter, activeWorkType, activeUser, designation);
    };

    const handleTrackerFilter = (tracker) => {
        setActiveTracker(tracker);
        setTrackerSearch('');
        handleFilter(activeFilter, activeWorkType, activeUser, activeDesignation, tracker);
    };

    const handleClientFilter = (client) => {
        setActiveClient(client);
        setClientSearch('');
        handleFilter(activeFilter, activeWorkType, activeUser, activeDesignation, activeTracker, client);
    };

    const handlePerPageChange = (newPerPage) => {
        setSelectedPerPage(newPerPage);
        const params = {
            filter: activeFilter,
            perPage: newPerPage
        };
        
        // Preserve all current filter parameters
        if (activeFilter === 'custom' && customStartDate && customEndDate) {
            params.startDate = customStartDate.toISOString().slice(0, 10);
            params.endDate = customEndDate.toISOString().slice(0, 10);
        } else if (activeFilter !== 'all') {
            const { start, end } = getDateRange(activeFilter);
            params.startDate = start;
            params.endDate = end;
        }
        
        if (activeWorkType !== 'all') params.workType = activeWorkType;
        if (activeUser !== 'all') params.userId = activeUser;
        if (activeDesignation !== 'all') params.designation = activeDesignation;
        if (activeTracker !== 'all') params.tracker = activeTracker;
        if (activeClient !== 'all') params.client = activeClient;
        
        router.get(route('work-hours.report'), params, {
            preserveState: true,
            preserveScroll: true,
            only: ['workHours', 'flash']
        });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Work Hours Report" />
            <AnimatedBackground />
            
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen">
                <div className="px-6 lg:px-12 xl:px-16 py-8">
                    {/* Header Card */}
                    <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 mb-8 border border-slate-100">
                        <div className="flex items-start gap-6">
                            {/* Gradient Icon */}
                            <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl shadow-lg">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            {/* Title and Description */}
                            <div className="flex-1">
                                <h1 className="text-3xl font-bold text-slate-900 mb-2">Work Hours Report</h1>
                                <p className="text-slate-600">Comprehensive analysis of work hours and productivity</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Main Content Card */}
                    <div className="bg-white shadow-2xl sm:rounded-2xl border border-slate-300">
                        <div className="p-4 sm:p-6 lg:p-8 text-slate-900">
                            {/* Two-row header for stable layout */}
                            <div className="space-y-4 mb-8">
                                {/* First row: Title and description */}
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                                    <div className="flex-1">
                                        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                                            Work Hours Report
                                        </h1>
                                        <p className="text-slate-600 mt-2 text-sm sm:text-base">Comprehensive analysis of work hours and productivity</p>
                                    </div>
                                </div>
                                
                                {/* Second row: Actions */}
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                    {/* Bulk Actions Panel - Only show when items are selected */}
                                    {selectedEntries.size > 0 && (
                                        <div className="flex flex-wrap items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                                            <span className="text-emerald-700 font-medium text-sm">
                                                {selectedEntries.size} selected
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={selectCurrentPage}
                                                    className="px-3 py-1 bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 rounded-lg transition-all text-sm font-medium"
                                                >
                                                    Select Page
                                                </button>
                                                <button
                                                    onClick={selectAllEntries}
                                                    className="px-3 py-1 bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 rounded-lg transition-all text-sm font-medium"
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    onClick={clearSelection}
                                                    className="px-3 py-1 bg-gray-500/30 hover:bg-gray-500/50 text-slate-600 rounded-lg transition-all text-sm font-medium"
                                                >
                                                    Clear
                                                </button>
                                                <button
                                                    onClick={() => setShowBulkConfirm(true)}
                                                    className="px-3 py-1 bg-red-500/30 hover:bg-red-500/50 text-red-200 rounded-lg transition-all text-sm font-medium"
                                                >
                                                    Delete Selected
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Primary Actions */}
                                    <div className="flex flex-col sm:flex-row sm:ml-auto gap-3">
                                        {/* Per Page Selector */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-slate-600 text-sm font-medium whitespace-nowrap">Show:</label>
                                            <select 
                                                value={selectedPerPage} 
                                                onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
                                                className="px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-slate-900 text-sm min-w-0"
                                            >
                                                <option value={15} className="bg-slate-800 text-slate-900">15</option>
                                                <option value={25} className="bg-slate-800 text-slate-900">25</option>
                                                <option value={50} className="bg-slate-800 text-slate-900">50</option>
                                                <option value={100} className="bg-slate-800 text-slate-900">100</option>
                                            </select>
                                            <span className="text-slate-600 text-sm whitespace-nowrap">entries</span>
                                        </div>
                                        
                                        <button
                                            onClick={exportToCSV}
                                            disabled={isExporting}
                                            className="inline-flex items-center px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-slate-900 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl backdrop-blur-xl text-sm sm:text-base whitespace-nowrap"
                                        >
                                            {isExporting ? (
                                                <>
                                                    <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                    <span className="hidden sm:inline">Exporting...</span>
                                                    <span className="sm:hidden">Export...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <span className="hidden sm:inline">Export to CSV</span>
                                                    <span className="sm:hidden">Export</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="mb-6 space-y-4">
                                {/* Main Filters Row - Side by Side Layout */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    {/* Date Range Filter - Takes up 2/3 of the space */}
                                    <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-300">
                                        <h3 className="text-sm font-semibold text-slate-900 mb-3">Filter by Date Range</h3>
                                        <div className="flex gap-2 flex-wrap">
                                            <button onClick={() => handleFilter('all')} className={`px-4 py-2 rounded-xl font-medium transition-all ${activeFilter === 'all' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-lg' : 'bg-white/10 text-slate-900 border border-slate-300 hover:bg-slate-100 backdrop-blur-xl'}`}>All Dates</button>
                                            <button onClick={() => handleFilter('today')} className={`px-4 py-2 rounded-xl font-medium transition-all ${activeFilter === 'today' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-lg' : 'bg-white/10 text-slate-900 border border-slate-300 hover:bg-slate-100 backdrop-blur-xl'}`}>Today</button>
                                            <button onClick={() => handleFilter('week')} className={`px-4 py-2 rounded-xl font-medium transition-all ${activeFilter === 'week' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-lg' : 'bg-white/10 text-slate-900 border border-slate-300 hover:bg-slate-100 backdrop-blur-xl'}`}>This Week</button>
                                            <button onClick={() => handleFilter('month')} className={`px-4 py-2 rounded-xl font-medium transition-all ${activeFilter === 'month' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-lg' : 'bg-white/10 text-slate-900 border border-slate-300 hover:bg-slate-100 backdrop-blur-xl'}`}>This Month</button>
                                            <button onClick={() => handleFilter('custom')} className={`px-4 py-2 rounded-xl font-medium transition-all ${activeFilter === 'custom' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-lg' : 'bg-white/10 text-slate-900 border border-slate-300 hover:bg-slate-100 backdrop-blur-xl'}`}>Custom Range</button>
                                        </div>
                                        {activeFilter === 'custom' && (
                                            <div className="flex gap-3 items-center mt-4 p-3 bg-white rounded-xl border border-slate-300">
                                                <span className="text-slate-900 font-medium">From:</span>
                                                <DatePicker
                                                    selected={customStartDate}
                                                    onChange={date => setCustomStartDate(date)}
                                                    dateFormat="yyyy-MM-dd"
                                                    maxDate={customEndDate || new Date()}
                                                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-slate-900 placeholder-gray-300"
                                                    calendarClassName="bg-slate-800 border border-slate-300 rounded-xl shadow-2xl"
                                                    dayClassName={(date) => "text-slate-900 hover:bg-blue-500/50 hover:text-slate-900 rounded-lg transition-colors"}
                                                    weekDayClassName={(date) => "text-slate-600 text-sm font-medium"}
                                                    monthClassName={(date) => "text-slate-900 hover:bg-blue-500/50 rounded-lg transition-colors"}
                                                    timeClassName={(date) => "text-white"}
                                                    popperClassName="z-50"
                                                    popperPlacement="bottom-start"
                                                    showPopperArrow={false}
                                                    placeholderText="Select start date"
                                                    isClearable
                                                    withPortal
                                                    portalId="date-picker-portal"
                                                />
                                                <span className="text-slate-900 font-medium">To:</span>
                                                <DatePicker
                                                    selected={customEndDate}
                                                    onChange={date => setCustomEndDate(date)}
                                                    dateFormat="yyyy-MM-dd"
                                                    minDate={customStartDate || undefined}
                                                    maxDate={new Date()}
                                                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-slate-900 placeholder-gray-300"
                                                    calendarClassName="bg-slate-800 border border-slate-300 rounded-xl shadow-2xl"
                                                    dayClassName={(date) => "text-slate-900 hover:bg-blue-500/50 hover:text-slate-900 rounded-lg transition-colors"}
                                                    weekDayClassName={(date) => "text-slate-600 text-sm font-medium"}
                                                    monthClassName={(date) => "text-slate-900 hover:bg-blue-500/50 rounded-lg transition-colors"}
                                                    timeClassName={(date) => "text-white"}
                                                    popperClassName="z-50"
                                                    popperPlacement="bottom-start"
                                                    showPopperArrow={false}
                                                    placeholderText="Select end date"
                                                    isClearable
                                                    withPortal
                                                    portalId="date-picker-portal"
                                                />
                                                <button
                                                    onClick={() => handleFilter('custom')}
                                                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 rounded-xl font-medium hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50"
                                                    disabled={!customStartDate || !customEndDate}
                                                >Apply</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Active Filters Summary - Takes up 1/3 of the space */}
                                    {(activeFilter !== 'all' || activeWorkType !== 'all' || activeUser !== 'all' || activeDesignation !== 'all' || activeTracker !== 'all' || activeClient !== 'all') && (
                                        <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-300">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-sm font-semibold text-slate-900">Active Filters</h3>
                                                <button 
                                                    onClick={() => {
                                                        setActiveFilter('all');
                                                        setActiveWorkType('all');
                                                        setActiveUser('all');
                                                        setActiveDesignation('all');
                                                        setActiveTracker('all');
                                                        setActiveClient('all');
                                                        setCustomStartDate(null);
                                                        setCustomEndDate(null);
                                                        router.get(route('work-hours.report'), { perPage: selectedPerPage }, {
                                                            preserveState: true,
                                                            preserveScroll: true,
                                                            only: ['workHours', 'flash']
                                                        });
                                                    }}
                                                    className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-red-500/80 to-red-600/80 hover:from-red-600 hover:to-red-700 text-slate-900 rounded-lg font-medium transition-all text-xs backdrop-blur-xl"
                                                    title="Clear all filters"
                                                >
                                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    Clear All
                                                </button>
                                            </div>
                                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                                {activeFilter !== 'all' && (
                                                    <div className="inline-flex items-center px-2 py-1 bg-blue-500/20 text-emerald-700 rounded-lg backdrop-blur-xl border border-blue-400/20 text-xs">
                                                        <span className="font-medium mr-1">Date:</span>
                                                        <span>{activeFilter === 'custom' ? `${customStartDate?.toLocaleDateString()} - ${customEndDate?.toLocaleDateString()}` : activeFilter}</span>
                                                    </div>
                                                )}
                                                {activeWorkType !== 'all' && (
                                                    <div className="inline-flex items-center px-2 py-1 bg-purple-500/20 text-purple-600 rounded-lg backdrop-blur-xl border border-purple-400/20 text-xs">
                                                        <span className="font-medium mr-1">Type:</span>
                                                        <span>{formatWorkType(activeWorkType)}</span>
                                                    </div>
                                                )}
                                                {activeUser !== 'all' && (
                                                    <div className="inline-flex items-center px-2 py-1 bg-green-500/20 text-green-300 rounded-lg backdrop-blur-xl border border-green-400/20 text-xs">
                                                        <span className="font-medium mr-1">User:</span>
                                                        <span>{users.find(u => u.id == activeUser)?.name || 'Unknown'}</span>
                                                    </div>
                                                )}
                                                {activeDesignation !== 'all' && (
                                                    <div className="inline-flex items-center px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg backdrop-blur-xl border border-indigo-400/20 text-xs">
                                                        <span className="font-medium mr-1">Role:</span>
                                                        <span>{activeDesignation}</span>
                                                    </div>
                                                )}
                                                {activeTracker !== 'all' && (
                                                    <div className="inline-flex items-center px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-lg backdrop-blur-xl border border-yellow-400/20 text-xs">
                                                        <span className="font-medium mr-1">Tracker:</span>
                                                        <span>{activeTracker}</span>
                                                    </div>
                                                )}
                                                {activeClient !== 'all' && (
                                                    <div className="inline-flex items-center px-2 py-1 bg-teal-500/20 text-teal-300 rounded-lg backdrop-blur-xl border border-teal-400/20 text-xs">
                                                        <span className="font-medium mr-1">Client:</span>
                                                        <span title={activeClient}>{activeClient.length > 12 ? `${activeClient.substring(0, 12)}...` : activeClient}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Advanced Filters Toggle */}
                                <div className="flex justify-center">
                                    <button
                                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-slate-900 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl backdrop-blur-xl"
                                    >
                                        <svg className={`w-5 h-5 mr-2 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                        {showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
                                    </button>
                                </div>

                                {/* Advanced Filters Section */}
                                {showAdvancedFilters && (
                                    <div className="space-y-4">
                                        {/* Work Type Filter */}
                                        <div className="bg-white p-4 rounded-xl border border-slate-300">
                                            <h3 className="text-sm font-semibold text-slate-900 mb-3">Filter by Work Type</h3>
                                            <div className="flex gap-2 flex-wrap">
                                                <button onClick={() => handleWorkTypeFilter('all')} className={`px-4 py-2 rounded-xl font-medium transition-all ${activeWorkType === 'all' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-lg' : 'bg-white/10 text-slate-900 border border-slate-300 hover:bg-slate-100 backdrop-blur-xl'}`}>All Types</button>
                                                <button onClick={() => handleWorkTypeFilter('tracker')} className={`px-4 py-2 rounded-xl font-medium transition-all ${activeWorkType === 'tracker' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-lg' : 'bg-white/10 text-slate-900 border border-slate-300 hover:bg-slate-100 backdrop-blur-xl'}`}>Tracker</button>
                                                <button onClick={() => handleWorkTypeFilter('manual')} className={`px-4 py-2 rounded-xl font-medium transition-all ${activeWorkType === 'manual' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-lg' : 'bg-white/10 text-slate-900 border border-slate-300 hover:bg-slate-100 backdrop-blur-xl'}`}>Manual Time</button>
                                                <button onClick={() => handleWorkTypeFilter('test_task')} className={`px-4 py-2 rounded-xl font-medium transition-all ${activeWorkType === 'test_task' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-lg' : 'bg-white/10 text-slate-900 border border-slate-300 hover:bg-slate-100 backdrop-blur-xl'}`}>Test Task</button>
                                                <button onClick={() => handleWorkTypeFilter('fixed')} className={`px-4 py-2 rounded-xl font-medium transition-all ${activeWorkType === 'fixed' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-lg' : 'bg-white/10 text-slate-900 border border-slate-300 hover:bg-slate-100 backdrop-blur-xl'}`}>Fixed Project</button>
                                                <button onClick={() => handleWorkTypeFilter('office_work')} className={`px-4 py-2 rounded-xl font-medium transition-all ${activeWorkType === 'office_work' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-lg' : 'bg-white/10 text-slate-900 border border-slate-300 hover:bg-slate-100 backdrop-blur-xl'}`}>Office Work</button>
                                                <button onClick={() => handleWorkTypeFilter('outside_of_upwork')} className={`px-4 py-2 rounded-xl font-medium transition-all ${activeWorkType === 'outside_of_upwork' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-lg' : 'bg-white/10 text-slate-900 border border-slate-300 hover:bg-slate-100 backdrop-blur-xl'}`}>Outside of Upwork</button>
                                            </div>
                                        </div>

                                        {/* Secondary Filters Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {/* User Filter */}
                                            <div className="bg-white p-4 rounded-xl border border-slate-300">
                                                <h3 className="text-sm font-semibold text-slate-900 mb-3">Filter by User</h3>
                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="Search users..."
                                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-slate-900 placeholder-gray-300"
                                                            value={userSearchTerm}
                                                            onChange={(e) => {
                                                                setUserSearchTerm(e.target.value);
                                                                setUserPage(1); // Reset to first page when searching
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                                        <button 
                                                            onClick={() => handleUserFilter('all')} 
                                                            className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${activeUser === 'all' ? 'bg-white/20 text-emerald-700 font-medium' : 'hover:bg-white/10 text-slate-900'}`}
                                                        >
                                                            All Users
                                                        </button>
                                                        {paginatedUsers.map(user => (
                                                            <button 
                                                                key={user.id} 
                                                                onClick={() => handleUserFilter(user.id)} 
                                                                className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${activeUser == user.id ? 'bg-white/20 text-emerald-700 font-medium' : 'hover:bg-white/10 text-slate-900'}`}
                                                                title={user.name}
                                                            >
                                                                {user.name}
                                                            </button>
                                                        ))}
                                                        {filteredUsers.length === 0 && userSearchTerm && (
                                                            <div className="px-3 py-2 text-gray-400 text-sm">No users found</div>
                                                        )}
                                                    </div>
                                                    <FilterPagination 
                                                        currentPage={userPage}
                                                        totalPages={totalUserPages}
                                                        onPageChange={setUserPage}
                                                    />
                                                </div>
                                            </div>

                                            {/* Shift Filter */}
                                            <div className="bg-white p-4 rounded-xl border border-slate-300">
                                                <h3 className="text-sm font-semibold text-slate-900 mb-3">Filter by Shift</h3>
                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="Search shifts..."
                                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-slate-900 placeholder-gray-300"
                                                            value={designationSearch}
                                                            onChange={(e) => setDesignationSearch(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                                        <button 
                                                            onClick={() => handleDesignationFilter('all')} 
                                                            className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${activeDesignation === 'all' ? 'bg-white/20 text-emerald-700 font-medium' : 'hover:bg-white/10 text-slate-900'}`}
                                                        >
                                                            All Shifts
                                                        </button>
                                                        {getUniqueDesignations()
                                                            .filter(designation => designation.toLowerCase().includes(designationSearch.toLowerCase()))
                                                            .map(designation => (
                                                            <button 
                                                                key={designation} 
                                                                onClick={() => handleDesignationFilter(designation)} 
                                                                className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${activeDesignation === designation ? 'bg-white/20 text-emerald-700 font-medium' : 'hover:bg-white/10 text-slate-900'}`}
                                                                title={designation}
                                                            >
                                                                {designation}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Tracker Filter */}
                                            <div className="bg-white p-4 rounded-xl border border-slate-300">
                                                <h3 className="text-sm font-semibold text-slate-900 mb-3">Filter by Tracker</h3>
                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="Search trackers..."
                                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-slate-900 placeholder-gray-300"
                                                            value={trackerSearch}
                                                            onChange={(e) => setTrackerSearch(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                                        <button 
                                                            onClick={() => handleTrackerFilter('all')} 
                                                            className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${activeTracker === 'all' ? 'bg-white/20 text-emerald-700 font-medium' : 'hover:bg-white/10 text-slate-900'}`}
                                                        >
                                                            All Trackers
                                                        </button>
                                                        {getUniqueTrackers()
                                                            .filter(tracker => tracker.toLowerCase().includes(trackerSearch.toLowerCase()))
                                                            .map(tracker => (
                                                            <button 
                                                                key={tracker} 
                                                                onClick={() => handleTrackerFilter(tracker)} 
                                                                className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm capitalize ${activeTracker === tracker ? 'bg-white/20 text-emerald-700 font-medium' : 'hover:bg-white/10 text-slate-900'}`}
                                                                title={tracker}
                                                            >
                                                                {tracker}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Client Filter */}
                                            <div className="bg-white p-4 rounded-xl border border-slate-300">
                                                <h3 className="text-sm font-semibold text-slate-900 mb-3">Filter by Client</h3>
                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="Search clients..."
                                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-slate-900 placeholder-gray-300"
                                                            value={clientSearch}
                                                            onChange={(e) => {
                                                                setClientSearch(e.target.value);
                                                                setClientPage(1); // Reset to first page when searching
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                                        <button 
                                                            onClick={() => handleClientFilter('all')} 
                                                            className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${activeClient === 'all' ? 'bg-white/20 text-emerald-700 font-medium' : 'hover:bg-white/10 text-slate-900'}`}
                                                        >
                                                            All Clients
                                                        </button>
                                                        {paginatedClients.map(client => (
                                                            <button 
                                                                key={client} 
                                                                onClick={() => handleClientFilter(client)} 
                                                                className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${activeClient === client ? 'bg-white/20 text-emerald-700 font-medium' : 'hover:bg-white/10 text-slate-900'}`}
                                                                title={client}
                                                            >
                                                                {client}
                                                            </button>
                                                        ))}
                                                        {filteredClients.length === 0 && clientSearch && (
                                                            <div className="px-3 py-2 text-gray-400 text-sm">No clients found</div>
                                                        )}
                                                    </div>
                                                    <FilterPagination 
                                                        currentPage={clientPage}
                                                        totalPages={totalClientPages}
                                                        onPageChange={setClientPage}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="overflow-x-auto shadow-2xl ring-1 ring-white/20 rounded-2xl">
                                <table className="min-w-full divide-y divide-white/20 table-fixed">
                                    <thead className="bg-gradient-to-r from-blue-600/80 to-purple-600/80 backdrop-blur-xl">
                                        <tr>
                                            <th className="w-12 px-4 py-3 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={workHours?.data?.length > 0 && workHours.data.every(entry => selectedEntries.has(entry.id))}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            selectCurrentPage();
                                                        } else {
                                                            clearSelection();
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-emerald-700 bg-white/10 border-white/30 rounded focus:ring-blue-500 focus:ring-2"
                                                />
                                            </th>
                                            <th className="w-32 px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">User</th>
                                            <th className="w-28 px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">Shift</th>
                                            <th className="w-28 px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">Work Type</th>
                                            <th className="w-24 px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">Tracker</th>
                                            <th className="w-28 px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">Date</th>
                                            <th className="w-32 px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">Client</th>
                                            <th className="w-20 px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">Hours</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">Description</th>
                                            <th className="w-32 px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider sticky right-0 bg-gradient-to-r from-blue-600/80 to-purple-600/80 backdrop-blur-xl border-l border-slate-200">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-slate-50 divide-y divide-white/10 backdrop-blur-xl">
                                        {workHours?.data?.length ? workHours.data.map((entry, index) => (
                                            <tr key={entry.id} className={`${index % 2 === 0 ? 'bg-slate-50' : 'bg-white/10'} hover:bg-slate-100 transition-colors backdrop-blur-xl ${selectedEntries.has(entry.id) ? 'ring-2 ring-blue-400/50' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEntries.has(entry.id)}
                                                        onChange={() => toggleSelectEntry(entry.id)}
                                                        className="w-4 h-4 text-emerald-700 bg-white/10 border-white/30 rounded focus:ring-blue-500 focus:ring-2"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-900 truncate font-medium">{entry.user.name}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 truncate">{entry.user.designation || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-900 truncate">
                                                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-500/20 text-emerald-700 rounded-lg backdrop-blur-xl border border-blue-400/20">
                                                        {formatWorkType(entry.work_type)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-900 capitalize truncate font-medium">{entry.tracker}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900 font-medium">{entry.date}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 truncate" title={entry.client?.name || 'No Client'}>{entry.client?.name || 'No Client'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-emerald-700">{timeFormat(entry.hours)}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 relative group">
                                                    <div className="max-w-xs truncate">
                                                        {entry.description && entry.description.length > 50 ? (
                                                            <>
                                                                <span className="truncate block">{entry.description.substring(0, 50)}...</span>
                                                                <button
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(entry.description);
                                                                        setToast('Description copied to clipboard!');
                                                                    }}
                                                                    className="mt-1 text-xs bg-white/10 hover:bg-slate-100 text-white/80 px-2 py-1 rounded transition-all"
                                                                    title="Copy full description"
                                                                >
                                                                    Copy Full Text
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <span className="block">{entry.description}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium sticky right-0 bg-gradient-to-r from-slate-800/95 to-slate-900/95 backdrop-blur-xl border-l border-slate-200 shadow-lg">
                                                    <div className="flex space-x-2">
                                                        <Link 
                                                            href={route('work-hours.edit', entry.id)} 
                                                            className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-900 text-xs font-medium rounded-lg transition-all backdrop-blur-xl"
                                                        >
                                                            Edit
                                                        </Link>
                                                        <button 
                                                            onClick={() => handleDelete(entry.id)} 
                                                            className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-slate-900 text-xs font-medium rounded-lg transition-all backdrop-blur-xl"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                                                    <div className="flex flex-col items-center">
                                                        <svg className="w-12 h-12 text-white/40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                        <p className="text-lg font-medium mb-1">No work hour entries found</p>
                                                        <p className="text-sm">Try adjusting your filters or date range</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                <tfoot className="bg-gradient-to-r from-slate-800/95 to-slate-900/95 backdrop-blur-xl border-t border-slate-300">
                                    <tr>
                                        <td className="px-4 py-3"></td>
                                        <td colSpan={6} className="px-4 py-3"></td>
                                        <td className="px-4 py-3 font-bold text-right text-emerald-700 text-lg">
                                            Total: {timeFormat(workHours?.data?.reduce((sum, entry) => sum + Number(entry.hours || 0), 0).toFixed(2) || 0)}
                                        </td>
                                        <td className="px-4 py-3"></td>
                                        <td className="w-32 px-4 py-3 sticky right-0 bg-gradient-to-r from-slate-800/95 to-slate-900/95 backdrop-blur-xl border-l border-slate-200"></td>
                                    </tr>
                                </tfoot>
                                </table>
                            </div>
                            
                            {/* Pagination Controls */}
                            {workHours?.data?.length > 0 && (
                                <div className="mt-6 p-4 bg-white rounded-xl border border-slate-300">
                                    <TraditionalPagination 
                                        pagination={workHours}
                                        className="flex flex-col sm:flex-row justify-between items-center gap-4"
                                        preserveState={true}
                                        preserveScroll={false}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Portal container for DatePicker */}
            <div id="date-picker-portal"></div>
            
            <Toast message={toast} onClose={closeToast} />
            
            {/* Single Delete Confirmation Modal */}
            {deleteId && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md border border-slate-300">
                        <h2 className="text-xl font-bold mb-4 text-slate-900">Confirm Delete</h2>
                        <p className="mb-6 text-slate-600">Are you sure you want to delete this entry?</p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setDeleteId(null)} 
                                className="px-6 py-2 bg-white hover:bg-slate-50 text-slate-900 rounded-lg font-semibold transition-all border border-slate-200"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDelete} 
                                className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-semibold transition-all shadow-lg"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Delete Confirmation Modal */}
            {showBulkConfirm && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md">
                    <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md border border-slate-300">
                        <h2 className="text-xl font-bold mb-4 text-slate-900">Confirm Bulk Delete</h2>
                        <p className="mb-6 text-slate-600">
                            Are you sure you want to delete <span className="font-semibold text-red-600">{selectedEntries.size}</span> selected entries? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setShowBulkConfirm(false)} 
                                disabled={isDeleting}
                                className="px-6 py-2 bg-white hover:bg-slate-50 text-slate-900 rounded-lg font-semibold transition-all border border-slate-200 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleBulkDelete}
                                disabled={isDeleting}
                                className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-500 disabled:to-gray-600 text-white rounded-lg font-semibold transition-all shadow-lg disabled:cursor-not-allowed flex items-center"
                            >
                                {isDeleting ? (
                                    <>
                                        <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete All'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}


