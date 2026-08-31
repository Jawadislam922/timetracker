import React, { useState, useRef } from 'react';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { TraditionalPagination } from '../Components/Pagination';
import PageHeader from '../Components/Layout/PageHeader';
import PageShell from '../Components/Layout/PageShell';
import ClientFormModal from '../Components/ClientFormModal';

function Toast({ message, onClose, type = 'success' }) {
    if (!message) return null;
    
    const bgColor = type === 'error' 
        ? 'from-red-500/90 to-orange-500/90' 
        : 'from-green-500/90 to-blue-500/90';
    
    return (
        <div className={`fixed top-5 right-5 z-50 bg-gradient-to-r ${bgColor} backdrop-blur-xl text-white px-6 py-3 rounded-xl shadow-2xl flex items-center border border-slate-200`}>
            <span className="font-medium">{message}</span>
            <button onClick={onClose} className="ml-4 text-white hover:text-gray-300 font-bold text-lg">&times;</button>
        </div>
    );
}

export default function ClientsList({ auth, clients, flash, filters = {}, filterOptions = {}, workTypes = {}, preferredContacts = {}, profileOptions = [], allClients = null }) {
    const canManage = auth.user?.is_super_admin || auth.user?.permissions?.includes('clients.manage');
    const canImportExport = auth.user?.is_super_admin || auth.user?.permissions?.includes('clients.import_export');
    const canViewReports = auth.user?.is_super_admin || auth.user?.permissions?.includes('reports.view');
    const [deleteId, setDeleteId] = useState(null);
    // null = closed; 'new' = add; object = edit. Opening also lazy-loads the
    // full client-name list used for live duplicate matching (partial reload:
    // the normal page visit never ships ~1,100 names).
    const [modalClient, setModalClient] = useState(null);
    const openClientModal = (subject) => {
        setModalClient(subject);
        if (allClients === null) {
            router.reload({ only: ['allClients'] });
        }
    };
    const [toast, setToast] = useState(flash?.success || flash?.error || '');
    const [toastType, setToastType] = useState(flash?.success ? 'success' : 'error');
    const [selectedPerPage, setSelectedPerPage] = useState(Number(filters.perPage || clients?.per_page || 10));
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'active');
    const [selectedClients, setSelectedClients] = useState(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const [selectAllMatching, setSelectAllMatching] = useState(false);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const searchTimeoutRef = useRef(null);

    const statusOptions = filterOptions.status || [
        { value: 'all', label: 'All' },
        { value: 'active', label: 'Active' },
        { value: 'archived', label: 'Archived' },
    ];

    const totalMatching = clients?.total ?? (clients?.data?.length || 0);

    const currentListUrl = () => (
        typeof window === 'undefined'
            ? route('clients.index')
            : `${window.location.pathname}${window.location.search}`
    );

    const confirmDelete = (id) => setDeleteId(id);
    const handleDelete = () => {
        if (!deleteId) return;
        router.delete(route('clients.destroy', deleteId), {
            data: { return_to: currentListUrl() },
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setToast('Client deleted.');
                setToastType('success');
                setDeleteId(null);
            },
            onError: () => {
                setToast('Failed to delete client.');
                setToastType('error');
                setDeleteId(null);
            },
        });
    };
    const closeToast = () => setToast('');

    const handlePerPageChange = (newPerPage) => {
        setSelectedPerPage(newPerPage);
        router.get(route('clients.index'), {
            perPage: newPerPage,
            search: searchTerm,
            status: statusFilter,
        });
    };

    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchTerm(value);

        // Debounce search - only search after user stops typing for 300ms
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            router.get(route('clients.index'), {
                search: value,
                perPage: selectedPerPage,
                status: statusFilter,
            }, {
                preserveState: true,
                preserveScroll: true,
            });
        }, 300);
    };

    const clearSearch = () => {
        setSearchTerm('');
        router.get(route('clients.index'), {
            perPage: selectedPerPage,
            status: statusFilter,
        });
    };

    const handleStatusChange = (value) => {
        setStatusFilter(value);
        clearAllSelections();
        router.get(route('clients.index'), {
            search: searchTerm,
            perPage: selectedPerPage,
            status: value,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    // Export clients to CSV
    const exportClients = () => {
        try {
            // Direct download link for CSV export
            window.location.href = route('clients.export');
            setToast('Export started...');
            setToastType('success');
        } catch (error) {
            setToast('Failed to export clients.');
            setToastType('error');
        }
    };

    // Handle file import
    const handleImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        router.post(route('clients.import'), formData, {
            onSuccess: () => {
                setToast('Clients imported successfully!');
                setToastType('success');
                event.target.value = ''; // Reset file input
            },
            onError: (errors) => {
                const errorMessage = errors.file ? errors.file : 'Failed to import clients.';
                setToast(errorMessage);
                setToastType('error');
                event.target.value = ''; // Reset file input
            }
        });
    };

    // Download sample CSV template
    const downloadSample = () => {
        const sampleData = [
            ['Name', 'Work Type', 'Upwork Profile', 'Tags'],
            ['Example Client 1', 'Tracker/Manual Time', 'John Doe Profile', 'web development, react'],
            ['Example Client 2', 'Fixed Client', 'Jane Smith Profile', 'mobile app, flutter'],
            ['Example Client 3', 'Outside of Upwork', '', 'consulting, strategy']
        ];

        const csvContent = sampleData.map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'client_import_sample.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        setToast('Sample CSV downloaded!');
        setToastType('success');
    };

    // Handle individual client selection
    const handleClientSelect = (clientId) => {
        // When "select all matching" is active, selectedClients is empty even
        // though every checkbox reads as checked. Materialize the real page
        // selection first so toggling one row removes only that row instead of
        // collapsing the selection down to it.
        const newSelected = selectAllMatching
            ? new Set(clients?.data?.map(client => client.id) || [])
            : new Set(selectedClients);
        if (newSelected.has(clientId)) {
            newSelected.delete(clientId);
        } else {
            newSelected.add(clientId);
        }
        setSelectedClients(newSelected);
        setSelectAllMatching(false);

        // Update select all state based on current page selection
        const currentPageIds = clients?.data?.map(client => client.id) || [];
        const allCurrentPageSelected = currentPageIds.every(id => newSelected.has(id));
        setSelectAll(allCurrentPageSelected && currentPageIds.length > 0);
    };

    // Handle select all for current page
    const handleSelectAll = () => {
        const currentPageIds = clients?.data?.map(client => client.id) || [];
        const newSelected = new Set(selectedClients);
        
        if (selectAll) {
            // Deselect all current page items
            currentPageIds.forEach(id => newSelected.delete(id));
        } else {
            // Select all current page items
            currentPageIds.forEach(id => newSelected.add(id));
        }
        
        setSelectedClients(newSelected);
        setSelectAll(!selectAll);
        setSelectAllMatching(false);
    };

    // Clear all selections
    const clearAllSelections = () => {
        setSelectedClients(new Set());
        setSelectAll(false);
        setSelectAllMatching(false);
    };

    // Select every row matching the current filters across all pages
    const handleSelectAllMatching = () => {
        setSelectAllMatching(true);
    };

    // Bulk archive/restore wired to clients.bulk-status
    const handleBulkStatus = (isActive) => {
        if (!selectAllMatching && selectedClients.size === 0) return;

        const data = {
            is_active: isActive,
            return_to: currentListUrl(),
        };

        if (selectAllMatching) {
            data.all_matching = true;
            data.search = searchTerm;
            data.status = statusFilter;
        } else {
            data.ids = Array.from(selectedClients);
        }

        router.post(route('clients.bulk-status'), data, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setToast(isActive ? 'Selected clients restored.' : 'Selected clients archived.');
                setToastType('success');
                clearAllSelections();
            },
            onError: () => {
                setToast('Failed to update selected clients.');
                setToastType('error');
            },
        });
    };

    // Per-row archive/restore wired to clients.set-status
    const handleSetStatus = (client) => {
        const newStatus = !client.is_active;
        router.patch(route('clients.set-status', client.id), {
            is_active: newStatus,
            return_to: currentListUrl(),
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setToast(newStatus ? 'Client restored.' : 'Client archived.');
                setToastType('success');
            },
            onError: () => {
                setToast('Failed to update client.');
                setToastType('error');
            },
        });
    };

    // Handle bulk delete
    const handleBulkDelete = () => {
        if (selectedClients.size === 0) return;
        setShowBulkDeleteModal(true);
    };

    const confirmBulkDelete = () => {
        const clientIds = Array.from(selectedClients);
        
        router.delete(route('clients.bulk-destroy'), {
            data: { client_ids: clientIds, return_to: currentListUrl() },
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setToast(`${clientIds.length} client(s) deleted successfully.`);
                setToastType('success');
                clearAllSelections();
                setShowBulkDeleteModal(false);
            },
            onError: () => {
                setToast('Failed to delete selected clients.');
                setToastType('error');
                setShowBulkDeleteModal(false);
            },
        });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Clients" />
            <PageShell>
                    <PageHeader
                        title="Clients"
                        description="Manage client records, work types, profiles, and tags."
                        actions={canManage && (
                            <button type="button" onClick={() => openClientModal('new')} className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                                Add Client
                            </button>
                        )}
                    />
                    
                    {/* Main Content Card */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900 shadow-sm">
                        <div className="p-3">
                            {/* Actions Bar */}
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Bulk Actions */}
                                    {canManage && (selectedClients.size > 0 || selectAllMatching) && (
                                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2">
                                            <span className="text-orange-300 text-sm font-medium">
                                                {selectAllMatching
                                                    ? `All ${totalMatching} matching selected`
                                                    : `${selectedClients.size} selected`}
                                            </span>
                                            <button
                                                onClick={() => handleBulkStatus(false)}
                                                className="inline-flex items-center rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-600"
                                            >
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8M10 12h4" />
                                                </svg>
                                                Archive
                                            </button>
                                            <button
                                                onClick={() => handleBulkStatus(true)}
                                                className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                                            >
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                Restore
                                            </button>
                                            <button
                                                onClick={handleBulkDelete}
                                                className="inline-flex items-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                                            >
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Delete
                                            </button>
                                            <button
                                                onClick={clearAllSelections}
                                                className="inline-flex items-center px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition-all text-sm"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    )}

                                    {/* Export/Import Buttons */}
                                    {canImportExport && <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={exportClients}
                                            className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Export
                                        </button>
                                        <label className="inline-flex cursor-pointer items-center rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-600">
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                            </svg>
                                            Import
                                            <input
                                                type="file"
                                                accept=".csv,.txt"
                                                onChange={handleImport}
                                                className="hidden"
                                            />
                                        </label>
                                        <button
                                            onClick={downloadSample}
                                            className="inline-flex items-center rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                            title="Download sample CSV template"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                            </svg>
                                            Sample
                                        </button>
                                    </div>}
                                    
                                </div>
                                
                                <div className="relative min-w-0 flex-1">
                                    <input
                                        type="text"
                                        placeholder="Search clients by name or tag..."
                                        className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-10 pr-10 text-sm text-slate-200 placeholder-slate-500 focus:border-orange-500 focus:ring-orange-500"
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                    <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    {searchTerm && (
                                        <button
                                            type="button"
                                            onClick={clearSearch}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                            title="Clear search"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                        <label htmlFor="clients-status" className="text-xs font-semibold uppercase text-slate-500">Status</label>
                                        <select
                                            id="clients-status"
                                            value={statusFilter}
                                            onChange={(e) => handleStatusChange(e.target.value)}
                                            className="rounded-lg border border-slate-700 bg-slate-900 py-2 pl-3 pr-8 text-sm font-medium text-slate-200 [color-scheme:dark] focus:border-orange-500 focus:ring-orange-500"
                                        >
                                            {statusOptions.map((opt) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                        <label htmlFor="clients-per-page" className="text-xs font-semibold uppercase text-slate-500">Rows</label>
                                        <select 
                                            id="clients-per-page"
                                            value={selectedPerPage} 
                                            onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
                                            className="w-20 rounded-lg border border-slate-700 bg-slate-900 py-2 pl-3 pr-8 text-sm font-medium text-slate-200 [color-scheme:dark] focus:border-orange-500 focus:ring-orange-500"
                                        >
                                            <option value={10}>10</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                </div>
                            </div>
                            
                            {/* Select all N matching banner */}
                            {canManage && selectAll && !selectAllMatching && totalMatching > (clients?.data?.length || 0) && (
                                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-200">
                                    <span>All {clients?.data?.length || 0} clients on this page are selected.</span>
                                    <button
                                        onClick={handleSelectAllMatching}
                                        className="font-semibold text-orange-300 underline hover:text-orange-200"
                                    >
                                        Select all {totalMatching} matching
                                    </button>
                                </div>
                            )}

                            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
                                <table className="min-w-full divide-y divide-slate-800 table-fixed">
                                    <thead className="bg-slate-950/60">
                                        <tr>
                                            {canManage && <th className="w-12 px-6 py-4 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={selectAll}
                                                    onChange={handleSelectAll}
                                                    className="w-4 h-4 text-purple-600 bg-white/20 border-white/30 rounded focus:ring-purple-500 focus:ring-2"
                                                />
                                            </th>}
                                            <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Name</th>
                                            <th className="w-56 px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Contact</th>
                                            <th className="w-32 px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Work Type</th>
                                            <th className="w-40 px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Upwork Profile</th>
                                            <th className="w-48 px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Tags</th>
                                            <th className="w-40 px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Weekly Hours Worked</th>
                                            {canManage && <th className="w-40 px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider sticky right-0 bg-slate-950 border-l border-slate-800">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {clients?.data?.map((client, index) => (
                                            <tr key={client.id} className={`${index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/40'} hover:bg-slate-800/50 transition-all duration-200`}>
                                                {canManage && <td className="px-6 py-4 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectAllMatching || selectedClients.has(client.id)}
                                                        onChange={() => handleClientSelect(client.id)}
                                                        className="w-4 h-4 text-orange-500 bg-slate-800 border-slate-600 rounded focus:ring-orange-500 focus:ring-2"
                                                    />
                                                </td>}
                                                <td className="px-6 py-4 text-sm text-slate-100 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        {canViewReports ? (
                                                            <Link
                                                                href={route('work-hours.report', { clients: [client.id] })}
                                                                className="hover:text-orange-400 hover:underline"
                                                                title={`View ${client.name}'s report`}
                                                            >
                                                                {client.name}
                                                            </Link>
                                                        ) : (
                                                            client.name
                                                        )}
                                                        {!client.is_active && (
                                                            <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-slate-700/60 text-slate-300 rounded border border-slate-600">
                                                                Archived
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <div className="space-y-0.5">
                                                        {client.email && <div className="text-slate-200">{client.email}</div>}
                                                        {client.phone && <div className="text-slate-400 text-xs">{client.phone}</div>}
                                                        {client.preferred_contact && (
                                                            <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-sky-500/15 text-sky-300 rounded border border-sky-500/25"
                                                                title={client.contact_notes || undefined}>
                                                                {preferredContacts[client.preferred_contact] || client.preferred_contact}
                                                            </span>
                                                        )}
                                                        {!client.email && !client.phone && !client.preferred_contact && (
                                                            <span className="text-slate-500 text-xs">&mdash;</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    {client.work_type && (
                                                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-orange-500/15 text-orange-300 rounded-lg border border-orange-500/20">
                                                            {workTypes?.[client.work_type] || client.work_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                        </span>
                                                    )}
                                                    {!client.work_type && (
                                                        <span className="text-slate-400 text-xs">Not set</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-100">
                                                    {/* Display multiple profiles */}
                                                    {client.upwork_profiles && client.upwork_profiles.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {client.upwork_profiles.map((profile, index) => (
                                                                <span key={profile.id} className="inline-flex px-2 py-1 text-xs font-medium bg-purple-500/15 text-purple-300 rounded-lg border border-purple-500/20">
                                                                    {profile.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* Fallback to single profile for backward compatibility */}
                                                    {(!client.upwork_profiles || client.upwork_profiles.length === 0) && client.upwork_profile && (
                                                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-purple-500/15 text-purple-300 rounded-lg border border-purple-500/20">
                                                            {client.upwork_profile.name}
                                                        </span>
                                                    )}
                                                    {/* No profiles at all */}
                                                    {(!client.upwork_profiles || client.upwork_profiles.length === 0) && !client.upwork_profile && (
                                                        <span className="text-slate-400 text-xs">Not set</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-100">
                                                    <div className="flex flex-wrap gap-1">
                                                        {client.tags && client.tags.length > 0 ? (
                                                            client.tags.map((tag, tagIndex) => (
                                                                <span
                                                                    key={tagIndex}
                                                                    className="inline-flex px-2 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-300 rounded-lg border border-emerald-500/20"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">No tags</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                                                    <div className="flex items-center">
                                                        <span className="inline-flex px-3 py-1 text-xs font-medium bg-purple-500/15 text-purple-300 rounded-full border border-purple-500/20 font-mono">
                                                            {client.weekly_hours_worked || '00:00'}
                                                        </span>
                                                    </div>
                                                </td>
                                                {canManage && <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 bg-inherit border-l border-slate-800">
                                                    <div className="flex space-x-2">
                                                        <button type="button" onClick={() => openClientModal(client)} className="inline-flex items-center px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-all shadow-md">
                                                            Edit
                                                        </button>
                                                        {client.is_active ? (
                                                            <button onClick={() => handleSetStatus(client)} className="inline-flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-all shadow-md">
                                                                Archive
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => handleSetStatus(client)} className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all shadow-md">
                                                                Restore
                                                            </button>
                                                        )}
                                                        <button onClick={() => confirmDelete(client.id)} className="inline-flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-all shadow-md">
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>}
                                            </tr>
                                        ))}
                                        {(!clients?.data || clients.data.length === 0) && (
                                            <tr>
                                                <td colSpan={canManage ? 8 : 6} className="px-0 py-12 text-center">
                                                    <div className="sticky left-0 flex w-[calc(100vw-4rem)] flex-col items-center px-4 sm:w-auto">
                                                        <svg className="w-12 h-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                        </svg>
                                                        <h3 className="text-lg font-medium text-slate-100 mb-2">No clients found</h3>
                                                        <p className="text-slate-300 mb-4">Get started by adding your first client.</p>
                                                        {canManage && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openClientModal('new')}
                                                                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-700"
                                                            >
                                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                                </svg>
                                                                Add First Client
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Pagination Controls */}
                            {clients?.data && clients.data.length > 0 && (
                                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                                    <TraditionalPagination 
                                        pagination={clients}
                                        className="justify-between items-center"
                                        preserveState={true}
                                        preserveScroll={false}
                                        dark
                                    />
                                </div>
                            )}
                        </div>
                    </div>
            </PageShell>
            
            <Toast message={toast} onClose={closeToast} type={toastType} />
            
            {/* Single Delete Modal */}
            {deleteId && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md">
                    <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-100">Confirm Delete</h2>
                        <p className="mb-6 text-slate-300">Are you sure you want to delete this client?</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteId(null)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition-all border border-slate-700">Cancel</button>
                            <button onClick={handleDelete} className="rounded-lg bg-red-600 px-5 py-2 text-white font-semibold hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Delete Modal */}
            {showBulkDeleteModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md">
                    <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-100">Confirm Bulk Delete</h2>
                        <p className="mb-6 text-slate-300">
                            Are you sure you want to delete {selectedClients.size} selected client(s)? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowBulkDeleteModal(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition-all border border-slate-700">Cancel</button>
                            <button onClick={confirmBulkDelete} className="rounded-lg bg-red-600 px-5 py-2 text-white font-semibold hover:bg-red-700">Delete {selectedClients.size} Client(s)</button>
                        </div>
                    </div>
                </div>
            )}
            <ClientFormModal
                open={modalClient !== null}
                onClose={() => setModalClient(null)}
                client={modalClient === 'new' ? null : modalClient}
                workTypes={workTypes}
                preferredContacts={preferredContacts}
                profileOptions={profileOptions}
                allClients={allClients}
                onEditExisting={(c) => openClientModal(clients?.data?.find((row) => row.id === c.id) || c)}
            />
        </AuthenticatedLayout>
    );
}
