import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import AuthenticatedLayout from "../Layouts/AuthenticatedLayout";
import AnimatedBackground from "../Components/AnimatedBackground";
import { Head, Link, router } from "@inertiajs/react";
import Avatar from "../Components/Avatar";
import { TraditionalPagination } from '../Components/Pagination';

function Toast({ message, onClose }) {
    if (!message) return null;
    return (
        <div className="fixed top-5 right-5 z-50 bg-gradient-to-r from-blue-500/90 to-purple-600/90 backdrop-blur-xl text-slate-900 px-6 py-3 rounded-xl shadow-2xl flex items-center border border-slate-300">
            <span className="font-medium">{message}</span>
            <button onClick={onClose} className="ml-4 text-slate-900 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>
    );
}

export default function UsersList({ auth, users, flash, filters = {}, filterOptions = {} }) {
    const [deleteId, setDeleteId] = useState(null);
    const [toast, setToast] = useState(flash?.success || "");
    const [selectedPerPage, setSelectedPerPage] = useState(users?.per_page || 10);
    
    // Filter states - initialized from backend filters
    const [searchTerm, setSearchTerm] = useState(filters.search || "");
    const [selectedDesignation, setSelectedDesignation] = useState(filters.designation || "all");
    const [selectedRole, setSelectedRole] = useState(filters.role || "all");
    const [designationDropdownOpen, setDesignationDropdownOpen] = useState(false);
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
    const [designationDropdownPosition, setDesignationDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const [roleDropdownPosition, setRoleDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const designationDropdownRef = useRef(null);
    const roleDropdownRef = useRef(null);
    const designationButtonRef = useRef(null);
    const roleButtonRef = useRef(null);

    // Debounce search to avoid too many API calls
    const [searchDebounce, setSearchDebounce] = useState(null);

    // Function to apply filters by navigating to backend
    const applyFilters = (newFilters = {}) => {
        const params = {
            search: newFilters.search !== undefined ? newFilters.search : searchTerm,
            designation: newFilters.designation !== undefined ? newFilters.designation : selectedDesignation,
            role: newFilters.role !== undefined ? newFilters.role : selectedRole,
            perPage: newFilters.perPage !== undefined ? newFilters.perPage : selectedPerPage,
        };

        // Remove empty or default values
        Object.keys(params).forEach(key => {
            if (params[key] === '' || params[key] === 'all') {
                delete params[key];
            }
        });

        // Always keep perPage if it's not the default
        if (params.perPage && params.perPage !== 10) {
            // Keep perPage
        } else if (params.perPage === 10) {
            delete params.perPage; // Remove default perPage
        }

        router.get(route('users.index'), params, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    // Handle search with debouncing
    const handleSearchChange = (value) => {
        setSearchTerm(value);
        
        if (searchDebounce) {
            clearTimeout(searchDebounce);
        }
        
        const timeout = setTimeout(() => {
            applyFilters({ search: value });
        }, 500); // 500ms debounce
        
        setSearchDebounce(timeout);
    };

    // Clean up debounce timeout
    useEffect(() => {
        return () => {
            if (searchDebounce) {
                clearTimeout(searchDebounce);
            }
        };
    }, [searchDebounce]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (designationDropdownRef.current && !designationDropdownRef.current.contains(event.target) &&
                designationButtonRef.current && !designationButtonRef.current.contains(event.target)) {
                setDesignationDropdownOpen(false);
            }
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target) &&
                roleButtonRef.current && !roleButtonRef.current.contains(event.target)) {
                setRoleDropdownOpen(false);
            }
        };

        const handleScroll = () => {
            if (designationDropdownOpen && designationButtonRef.current) {
                const rect = designationButtonRef.current.getBoundingClientRect();
                setDesignationDropdownPosition({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.left + window.scrollX,
                    width: rect.width
                });
            }
            if (roleDropdownOpen && roleButtonRef.current) {
                const rect = roleButtonRef.current.getBoundingClientRect();
                setRoleDropdownPosition({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.left + window.scrollX,
                    width: rect.width
                });
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleScroll);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
        };
    }, [designationDropdownOpen, roleDropdownOpen]);

    // Get unique shifts from backend filter options (stored as designations in DB)
    const getUniqueDesignations = () => {
        return filterOptions.designations || [];
    };

    // Get unique roles from backend filter options
    const getUniqueRoles = () => {
        return filterOptions.roles || [];
    };

    // Handle shift dropdown toggle
    const handleDesignationDropdownToggle = () => {
        if (designationButtonRef.current) {
            const rect = designationButtonRef.current.getBoundingClientRect();
            setDesignationDropdownPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
        setDesignationDropdownOpen(!designationDropdownOpen);
        setRoleDropdownOpen(false); // Close other dropdown
    };

    // Handle role dropdown toggle
    const handleRoleDropdownToggle = () => {
        if (roleButtonRef.current) {
            const rect = roleButtonRef.current.getBoundingClientRect();
            setRoleDropdownPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
        setRoleDropdownOpen(!roleDropdownOpen);
        setDesignationDropdownOpen(false); // Close other dropdown
    };

    // Handle shift filter change
    const handleDesignationChange = (designation) => {
        setSelectedDesignation(designation);
        setDesignationDropdownOpen(false);
        applyFilters({ designation });
    };

    // Handle role filter change
    const handleRoleChange = (role) => {
        setSelectedRole(role);
        setRoleDropdownOpen(false);
        applyFilters({ role });
    };

    // Clear all filters
    const clearAllFilters = () => {
        setSearchTerm("");
        setSelectedDesignation("all");
        setSelectedRole("all");
        
        if (searchDebounce) {
            clearTimeout(searchDebounce);
        }
        
        const params = {};
        if (selectedPerPage !== 10) {
            params.perPage = selectedPerPage;
        }
        
        router.get(route('users.index'), params, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleDelete = (id) => {
        setDeleteId(id);
    };

    const confirmDelete = () => {
        if (!deleteId) return;
        router.delete(route("users.destroy", deleteId), {
            onSuccess: () => {
                setToast("User deleted successfully.");
                setDeleteId(null);
            },
            onError: () => {
                setToast("Failed to delete user.");
                setDeleteId(null);
            },
        });
    };

    const closeToast = () => setToast("");

    const handlePerPageChange = (newPerPage) => {
        setSelectedPerPage(newPerPage);
        applyFilters({ perPage: newPerPage });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Users List" />
            
            <Toast message={toast} onClose={closeToast} />
            
            {/* Delete Confirmation Modal */}
            {deleteId && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-200">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">
                            Confirm Delete
                        </h2>
                        <p className="mb-6 text-slate-600">
                            Are you sure you want to delete this user? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all duration-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium transition-all duration-300 shadow-lg"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30">
                <div className="px-6 lg:px-12 xl:px-16 py-8 space-y-8">
                    
                    {/* Header Card with Gradient Icon */}
                    <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 border border-slate-100">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-6">
                                {/* Gradient Icon */}
                                <div className="p-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl shadow-lg">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                </div>
                                {/* Title and Description */}
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Users Management</h1>
                                    <p className="text-slate-600">Manage user accounts and permissions</p>
                                </div>
                            </div>
                            {/* Add User Button */}
                            <Link
                                href={route("users.create")}
                                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add User
                            </Link>
                        </div>
                    </div>

                    {/* Filters and Search Card */}
                    <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 border border-slate-100">
                        <div className="space-y-6">
                            {/* Search Bar */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Search Users</label>
                                <div className="relative">
                                    <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search by name or email..."
                                        className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-slate-900 placeholder-slate-400 transition-all"
                                        value={searchTerm}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Filter Dropdowns and Per Page Selector */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Filter by Shift */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Shift</label>
                                    <div className="relative">
                                        <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <button
                                            ref={designationButtonRef}
                                            type="button"
                                            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-slate-900 text-left flex items-center justify-between hover:bg-slate-50 transition-all"
                                            onClick={handleDesignationDropdownToggle}
                                        >
                                            <span className="truncate text-sm">
                                                {selectedDesignation === "all" ? "All Shifts" : 
                                                 selectedDesignation === "no_designation" ? "No Shift" : 
                                                 selectedDesignation}
                                            </span>
                                            <svg 
                                                className={`w-4 h-4 transition-transform ${designationDropdownOpen ? 'rotate-180' : ''}`} 
                                                fill="none" 
                                                stroke="currentColor" 
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Filter by Role */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                                    <div className="relative">
                                        <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                        </svg>
                                        <button
                                            ref={roleButtonRef}
                                            type="button"
                                            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-slate-900 text-left flex items-center justify-between hover:bg-slate-50 transition-all"
                                            onClick={handleRoleDropdownToggle}
                                        >
                                            <span className="truncate capitalize text-sm">
                                                {selectedRole === "all" ? "All Roles" : selectedRole}
                                            </span>
                                            <svg 
                                                className={`w-4 h-4 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} 
                                                fill="none" 
                                                stroke="currentColor" 
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Per Page Selector */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Show</label>
                                    <select 
                                        value={selectedPerPage} 
                                        onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
                                        className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-slate-900 text-sm hover:bg-slate-50 transition-all"
                                    >
                                        <option value={10}>10 entries</option>
                                        <option value={25}>25 entries</option>
                                        <option value={50}>50 entries</option>
                                        <option value={100}>100 entries</option>
                                    </select>
                                </div>
                            </div>

                            {/* Results Summary and Clear Filters */}
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600">
                                    Showing {users?.data?.length || 0} of {users?.total || 0} users
                                    {searchTerm && ` matching "${searchTerm}"`}
                                    {selectedDesignation !== "all" && ` • ${selectedDesignation === "no_designation" ? "No Shift" : selectedDesignation}`}
                                    {selectedRole !== "all" && ` • ${selectedRole}`}
                                </span>
                                {(searchTerm || selectedDesignation !== "all" || selectedRole !== "all") && (
                                    <button
                                        onClick={clearAllFilters}
                                        className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all font-medium"
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Portal for Shift Dropdown */}
                                    {designationDropdownOpen && createPortal(
                                        <div 
                                            ref={designationDropdownRef}
                                            className="bg-white border border-slate-300 rounded-xl shadow-2xl max-h-60 overflow-hidden z-[9999]"
                                            style={{
                                                position: 'absolute',
                                                top: designationDropdownPosition.top,
                                                left: designationDropdownPosition.left,
                                                width: designationDropdownPosition.width,
                                                maxHeight: '240px'
                                            }}
                                        >
                                            <div className="max-h-48 overflow-y-auto">
                                                <div
                                                    className={`px-4 py-2 cursor-pointer hover:bg-slate-100 transition-colors flex items-center ${selectedDesignation === 'all' ? 'bg-green-500/20 text-green-300 font-medium' : 'text-slate-900'}`}
                                                    onClick={() => handleDesignationChange('all')}
                                                >
                                                    {selectedDesignation === 'all' && (
                                                        <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                    All Shifts
                                                </div>
                                                <div
                                                    className={`px-4 py-2 cursor-pointer hover:bg-slate-100 transition-colors flex items-center ${selectedDesignation === 'no_designation' ? 'bg-green-500/20 text-green-300 font-medium' : 'text-slate-900'}`}
                                                    onClick={() => handleDesignationChange('no_designation')}
                                                >
                                                    {selectedDesignation === 'no_designation' && (
                                                        <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                    No Shift
                                                </div>
                                                {getUniqueDesignations().map(designation => (
                                                    <div
                                                        key={designation}
                                                        className={`px-4 py-2 cursor-pointer hover:bg-slate-100 transition-colors flex items-center ${selectedDesignation === designation ? 'bg-green-500/20 text-green-300 font-medium' : 'text-slate-900'}`}
                                                        onClick={() => handleDesignationChange(designation)}
                                                    >
                                                        {selectedDesignation === designation && (
                                                            <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                        <span className="truncate">{designation}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>,
                                        document.body
                                    )}



                                    {/* Portal for Role Dropdown */}
                                    {roleDropdownOpen && createPortal(
                                        <div 
                                            ref={roleDropdownRef}
                                            className="bg-white border border-slate-300 rounded-xl shadow-2xl max-h-60 overflow-hidden z-[9999]"
                                            style={{
                                                position: 'absolute',
                                                top: roleDropdownPosition.top,
                                                left: roleDropdownPosition.left,
                                                width: roleDropdownPosition.width,
                                                maxHeight: '240px'
                                            }}
                                        >
                                            <div className="max-h-48 overflow-y-auto">
                                                <div
                                                    className={`px-4 py-2 cursor-pointer hover:bg-slate-100 transition-colors flex items-center ${selectedRole === 'all' ? 'bg-purple-500/20 text-purple-600 font-medium' : 'text-slate-900'}`}
                                                    onClick={() => handleRoleChange('all')}
                                                >
                                                    {selectedRole === 'all' && (
                                                        <svg className="w-4 h-4 mr-2 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                    All Roles
                                                </div>
                                                {getUniqueRoles().map(role => (
                                                    <div
                                                        key={role}
                                                        className={`px-4 py-2 cursor-pointer hover:bg-slate-100 transition-colors flex items-center ${selectedRole === role ? 'bg-purple-500/20 text-purple-600 font-medium' : 'text-slate-900'}`}
                                                        onClick={() => handleRoleChange(role)}
                                                    >
                                                        {selectedRole === role && (
                                                            <svg className="w-4 h-4 mr-2 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                        <span className="truncate capitalize">{role}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>,
                                        document.body
                                    )}

                    {/* Table Card */}
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-gradient-to-r from-blue-500 to-cyan-500">
                                    <tr>
                                        <th className="w-20 px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            ID
                                        </th>
                                        <th className="w-24 px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Avatar
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="w-40 px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Shift
                                        </th>
                                        <th className="w-32 px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Role
                                        </th>
                                        <th className="w-40 px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Weekly Hours
                                        </th>
                                        <th className="w-40 px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider sticky right-0 bg-gradient-to-r from-blue-500 to-cyan-500">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {(!users?.data || users.data.length === 0) ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center">
                                                <div className="text-slate-500">
                                                    <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                    </svg>
                                                    <h3 className="text-lg font-medium text-slate-900 mb-2">No users found</h3>
                                                    <p className="text-slate-600">
                                                        {searchTerm || selectedDesignation !== "all" || selectedRole !== "all" 
                                                            ? "Try adjusting your filters to see more results."
                                                            : "No users available in the system."
                                                        }
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        users.data.map((user) => (
                                        <tr key={user.id} className="hover:bg-slate-50 transition-colors duration-150">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                                                #{user.id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Avatar user={user} size="md" />
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-900 font-medium" title={user.name}>
                                                {user.name}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600" title={user.email}>
                                                {user.email}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className="inline-flex px-3 py-1 text-xs font-medium bg-rose-100 text-rose-700 rounded-full">
                                                    {user.designation || 'No Shift'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full capitalize ${
                                                    user.role === 'admin' 
                                                        ? 'bg-purple-100 text-purple-700' 
                                                        : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className="inline-flex px-3 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full font-mono">
                                                    {user.weekly_hours_worked || '00:00'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 bg-white">
                                                <div className="flex space-x-2">
                                                    <Link
                                                        href={route("users.edit", user.id)}
                                                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-all shadow-sm hover:shadow-md"
                                                    >
                                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                        Edit
                                                    </Link>
                                                    {user.id > 1 && (
                                                        <button
                                                            onClick={() => handleDelete(user.id)}
                                                            className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-all shadow-sm hover:shadow-md"
                                                        >
                                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Pagination */}
                        {users?.data && users.data.length > 0 && (
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                                <TraditionalPagination 
                                    pagination={users}
                                    className="justify-between items-center"
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

