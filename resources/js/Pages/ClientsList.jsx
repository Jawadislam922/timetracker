import React, { useState, useRef } from 'react';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import AnimatedBackground from '../Components/AnimatedBackground';
import { Head, Link, router } from '@inertiajs/react';
import { TraditionalPagination } from '../Components/Pagination';

function Toast({ message, onClose, type = 'success' }) {
    if (!message) return null;
    
    const bgColor = type === 'error' 
        ? 'from-red-500/90 to-orange-500/90' 
        : 'from-green-500/90 to-blue-500/90';
    
    return (
        <div className={`fixed top-5 right-5 z-50 bg-gradient-to-r ${bgColor} backdrop-blur-xl text-white px-6 py-3 rounded-xl shadow-2xl flex items-center border border-white/20`}>
            <span className="font-medium">{message}</span>
            <button onClick={onClose} className="ml-4 text-white hover:text-gray-300 font-bold text-lg">&times;</button>
        </div>
    );
}

export default function ClientsList({ auth, clients, flash, filters = {}, workTypes = {} }) {
    const [deleteId, setDeleteId] = useState(null);
    const [toast, setToast] = useState(flash?.success || flash?.error || '');
    const [toastType, setToastType] = useState(flash?.success ? 'success' : 'error');
    const [selectedPerPage, setSelectedPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [selectedClients, setSelectedClients] = useState(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

    const confirmDelete = (id) => setDeleteId(id);
    const handleDelete = () => {
        if (!deleteId) return;
        router.delete(route('clients.destroy', deleteId), {
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
            search: searchTerm 
        });
    };

    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        
        // Debounce search - only search after user stops typing for 300ms
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(() => {
            router.get(route('clients.index'), {
                search: value,
                perPage: selectedPerPage
            }, {
                preserveState: true,
                preserveScroll: true,
            });
        }, 300);
    };

    const clearSearch = () => {
        setSearchTerm('');
        router.get(route('clients.index'), {
            perPage: selectedPerPage
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
        const newSelected = new Set(selectedClients);
        if (newSelected.has(clientId)) {
            newSelected.delete(clientId);
        } else {
            newSelected.add(clientId);
        }
        setSelectedClients(newSelected);
        
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
    };

    // Clear all selections
    const clearAllSelections = () => {
        setSelectedClients(new Set());
        setSelectAll(false);
    };

    // Handle bulk delete
    const handleBulkDelete = () => {
        if (selectedClients.size === 0) return;
        setShowBulkDeleteModal(true);
    };

    const confirmBulkDelete = () => {
        const clientIds = Array.from(selectedClients);
        
        router.delete(route('clients.bulk-destroy'), {
            data: { client_ids: clientIds },
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
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-semibold text-xl text-slate-100 leading-tight">Clients</h2>}>
            <Head title="Clients" />
            
            {/* Animated Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" style={{background: '#282a2a'}}>
                <AnimatedBackground />
            </div>
            
            <Toast message={toast} onClose={closeToast} type={toastType} />
            
            {/* Single Delete Modal */}
            {deleteId && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/20">
                        <h2 className="text-xl font-bold mb-4 text-white">Confirm Delete</h2>
                        <p className="mb-6 text-white/70">Are you sure you want to delete this client?</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteId(null)} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all backdrop-blur-xl border border-white/20">Cancel</button>
                            <button onClick={handleDelete} className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium transition-all">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Delete Modal */}
            {showBulkDeleteModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/20">
                        <h2 className="text-xl font-bold mb-4 text-white">Confirm Bulk Delete</h2>
                        <p className="mb-6 text-white/70">
                            Are you sure you want to delete {selectedClients.size} selected client(s)? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowBulkDeleteModal(false)} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all backdrop-blur-xl border border-white/20">Cancel</button>
                            <button onClick={confirmBulkDelete} className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium transition-all">Delete {selectedClients.size} Client(s)</button>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="py-12 min-h-screen relative z-10">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl overflow-hidden shadow-2xl rounded-2xl border border-white/10">
                        <div className="p-8 text-white">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h1 className="text-4xl font-bold text-white mb-2">Clients</h1>
                                    <p className="text-white/70 text-lg">Manage your client relationships and contacts</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Bulk Actions */}
                                    {selectedClients.size > 0 && (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 backdrop-blur-xl rounded-xl border border-red-400/30">
                                            <span className="text-red-300 text-sm font-medium">
                                                {selectedClients.size} selected
                                            </span>
                                            <button
                                                onClick={handleBulkDelete}
                                                className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-md font-medium transition-all text-sm"
                                            >
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Delete
                                            </button>
                                            <button
                                                onClick={clearAllSelections}
                                                className="inline-flex items-center px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-md font-medium transition-all text-sm"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    )}

                                    {/* Export/Import Buttons */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={exportClients}
                                            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl text-sm"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Export
                                        </button>
                                        <label className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl cursor-pointer text-sm">
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                            </svg>
                                            Import
                                            <input
                                                type="file"
                                                accept=".csv,.xlsx,.xls"
                                                onChange={handleImport}
                                                className="hidden"
                                            />
                                        </label>
                                        <button
                                            onClick={downloadSample}
                                            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl text-sm"
                                            title="Download sample CSV template"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                            </svg>
                                            Sample
                                        </button>
                                    </div>
                                    
                                    {/* Per Page Selector */}
                                    <div className="flex items-center gap-2">
                                        <label className="text-white/70 text-sm font-medium">Show:</label>
                                        <select 
                                            value={selectedPerPage} 
                                            onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
                                            className="px-3 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-white text-sm"
                                        >
                                            <option value={10} className="bg-slate-800 text-white">10</option>
                                            <option value={25} className="bg-slate-800 text-white">25</option>
                                            <option value={50} className="bg-slate-800 text-white">50</option>
                                            <option value={100} className="bg-slate-800 text-white">100</option>
                                        </select>
                                        <span className="text-white/70 text-sm">entries</span>
                                    </div>
                                    
                                    <Link href={route('clients.create')} className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add Client
                                    </Link>
                                </div>
                            </div>
                            
                            {/* Search Section */}
                            <div className="mb-6">
                                <div className="bg-white/10 backdrop-blur-xl p-4 rounded-xl border border-white/20">
                                    <h3 className="text-sm font-semibold text-white mb-3">Search Clients</h3>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search by name or tags..."
                                            className="w-full px-4 py-3 pl-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-white placeholder-white/50 text-sm"
                                            value={searchTerm}
                                            onChange={handleSearch}
                                        />
                                        <svg className="w-5 h-5 text-blue-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        {searchTerm && (
                                            <button
                                                onClick={clearSearch}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    {searchTerm && (
                                        <div className="mt-2 text-sm text-white/70">
                                            Searching for: <span className="text-blue-300 font-medium">"{searchTerm}"</span>
                                            <button onClick={clearSearch} className="ml-2 text-red-300 hover:text-red-200 underline">
                                                Clear
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
                                <table className="min-w-full divide-y divide-white/10 table-fixed">
                                    <thead className="bg-gradient-to-r from-blue-500/30 to-purple-500/30 backdrop-blur-xl">
                                        <tr>
                                            <th className="w-12 px-6 py-4 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={selectAll}
                                                    onChange={handleSelectAll}
                                                    className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500 focus:ring-2"
                                                />
                                            </th>
                                            <th className="w-16 px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">ID</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Name</th>
                                            <th className="w-32 px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Work Type</th>
                                            <th className="w-40 px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Upwork Profile</th>
                                            <th className="w-48 px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Tags</th>
                                            <th className="w-40 px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Weekly Hours Worked</th>
                                            <th className="w-40 px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider sticky right-0 bg-gradient-to-r from-blue-500/30 to-purple-500/30 backdrop-blur-xl">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {clients?.data?.map((client, index) => (
                                            <tr key={client.id} className={`${index % 2 === 0 ? 'bg-white/5' : 'bg-white/10'} hover:bg-white/20 transition-all duration-200`}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedClients.has(client.id)}
                                                        onChange={() => handleClientSelect(client.id)}
                                                        className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500 focus:ring-2"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-400">{client.id}</td>
                                                <td className="px-6 py-4 text-sm text-white font-medium">{client.name}</td>
                                                <td className="px-6 py-4 text-sm text-white">
                                                    {client.work_type && (
                                                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-orange-500/20 text-orange-300 rounded-md backdrop-blur-xl border border-orange-400/30">
                                                            {workTypes?.[client.work_type] || client.work_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                        </span>
                                                    )}
                                                    {!client.work_type && (
                                                        <span className="text-white/50 text-xs">Not set</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-white">
                                                    {client.upwork_profile && (
                                                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-purple-500/20 text-purple-300 rounded-md backdrop-blur-xl border border-purple-400/30">
                                                            {client.upwork_profile.name}
                                                        </span>
                                                    )}
                                                    {!client.upwork_profile && (
                                                        <span className="text-white/50 text-xs">Not set</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-white">
                                                    <div className="flex flex-wrap gap-1">
                                                        {client.tags && client.tags.length > 0 ? (
                                                            client.tags.map((tag, tagIndex) => (
                                                                <span
                                                                    key={tagIndex}
                                                                    className="inline-flex px-2 py-1 text-xs font-medium bg-green-500/20 text-green-300 rounded-md backdrop-blur-xl border border-green-400/30"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-white/50 text-xs">No tags</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                                    <div className="flex items-center">
                                                        <span className="inline-flex px-3 py-1 text-xs font-medium bg-blue-500/20 text-blue-300 rounded-full backdrop-blur-xl border border-blue-400/30 font-mono">
                                                            {client.weekly_hours_worked || '00:00'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 bg-white/10 backdrop-blur-xl">
                                                    <div className="flex space-x-2">
                                                        <Link href={route('clients.edit', client.id)} className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-medium rounded-md transition-all">
                                                            Edit
                                                        </Link>
                                                        <button onClick={() => confirmDelete(client.id)} className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs font-medium rounded-md transition-all">
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!clients?.data || clients.data.length === 0) && (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <svg className="w-12 h-12 text-white/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                        </svg>
                                                        <h3 className="text-lg font-medium text-white mb-2">No clients found</h3>
                                                        <p className="text-white/60 mb-4">Get started by adding your first client.</p>
                                                        <Link 
                                                            href={route('clients.create')}
                                                            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all"
                                                        >
                                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                            </svg>
                                                            Add First Client
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Pagination Controls */}
                            {clients?.data && clients.data.length > 0 && (
                                <div className="mt-6 p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">
                                    <TraditionalPagination 
                                        pagination={clients}
                                        className="justify-between items-center"
                                        preserveState={true}
                                        preserveScroll={false}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
