import React, { useState } from 'react';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import AnimatedBackground from '../Components/AnimatedBackground';
import { Head, useForm, Link } from '@inertiajs/react';

export default function UserCreate({ auth }) {
    const [avatarPreview, setAvatarPreview] = useState(null);
    
    const createForm = useForm({
        name: '',
        email: '',
        password: '',
        role: 'employee',
        designation: '',
        avatar: null,
    });

    const submitForm = (e) => {
        e.preventDefault();
        
        createForm.post(route('users.store'), {
            forceFormData: true,
            preserveScroll: true,
            onStart: () => {
                // Request started
            },
            onSuccess: (response) => {
                // Success response
                createForm.reset();
                setAvatarPreview(null);
            },
            onError: (errors) => {
                // Form errors
            },
            onFinish: () => {
                // Request finished
            }
        });
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        
        if (file) {
            createForm.setData('avatar', file);
            
            const reader = new FileReader();
            reader.onload = () => {
                setAvatarPreview(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            createForm.setData('avatar', null);
            setAvatarPreview(null);
        }
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Add User" />
            
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen">
                <div className="px-6 lg:px-12 xl:px-16 py-8 space-y-8">
                    {/* Header Card with Gradient Icon */}
                    <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 border border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl shadow-lg">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-slate-900">Add User</h2>
                                <p className="text-slate-600 mt-1">Create a new user account with role and avatar</p>
                            </div>
                        </div>
                    </div>

                    {/* Form Card */}
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="p-6 md:p-8">
                            
                            <form onSubmit={submitForm} className="space-y-6">
                                {/* Avatar Upload Section */}
                                <div className="flex flex-col items-center p-8 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border-2 border-slate-200">
                                    <div className="mb-6">
                                        {avatarPreview ? (
                                            <div className="relative">
                                                <img 
                                                    src={avatarPreview} 
                                                    alt="Avatar preview" 
                                                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-2xl"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        createForm.setData('avatar', null);
                                                        setAvatarPreview(null);
                                                    }}
                                                    className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xl font-bold transition-all shadow-lg"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-32 h-32 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-2xl">
                                                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <label className="cursor-pointer">
                                        <span className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            Upload Avatar
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarChange}
                                            className="hidden"
                                        />
                                    </label>
                                    {createForm.errors.avatar && (
                                        <div className="mt-3 text-sm text-red-600 flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            {createForm.errors.avatar}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Name */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-900 mb-2">
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Enter full name..."
                                                value={createForm.data.name}
                                                onChange={e => createForm.setData('name', e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900 placeholder-slate-400"
                                                required
                                            />
                                        </div>
                                        {createForm.errors.name && (
                                            <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                {createForm.errors.name}
                                            </div>
                                        )}
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-900 mb-2">
                                            Email Address <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <input
                                                type="email"
                                                placeholder="Enter email address..."
                                                value={createForm.data.email}
                                                onChange={e => createForm.setData('email', e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900 placeholder-slate-400"
                                                required
                                            />
                                        </div>
                                        {createForm.errors.email && (
                                            <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                {createForm.errors.email}
                                            </div>
                                        )}
                                    </div>

                                    {/* Password */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-900 mb-2">
                                            Password <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            </div>
                                            <input
                                                type="password"
                                                placeholder="Enter password..."
                                                value={createForm.data.password}
                                                onChange={e => createForm.setData('password', e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900 placeholder-slate-400"
                                                required
                                            />
                                        </div>
                                        {createForm.errors.password && (
                                            <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                {createForm.errors.password}
                                            </div>
                                        )}
                                    </div>

                                    {/* Shift */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-900 mb-2">
                                            Shift
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Enter shift (e.g., Morning, Evening, Night)..."
                                                value={createForm.data.designation}
                                                onChange={e => createForm.setData('designation', e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-900 placeholder-slate-400"
                                            />
                                        </div>
                                        {createForm.errors.designation && (
                                            <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                {createForm.errors.designation}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Role Selection */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-4">
                                        User Role <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <button
                                            type="button"
                                            onClick={() => createForm.setData('role', 'employee')}
                                            className={`p-6 rounded-xl border-2 transition-all ${
                                                createForm.data.role === 'employee'
                                                    ? 'border-emerald-500 bg-emerald-50 shadow-lg'
                                                    : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-center mb-3">
                                                <div className={`p-3 rounded-full ${createForm.data.role === 'employee' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                                    <svg className={`w-8 h-8 ${createForm.data.role === 'employee' ? 'text-emerald-600' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className={`font-bold text-lg ${createForm.data.role === 'employee' ? 'text-emerald-700' : 'text-slate-900'}`}>Employee</div>
                                            <div className="text-sm text-slate-600 mt-1">Standard user access</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => createForm.setData('role', 'admin')}
                                            className={`p-6 rounded-xl border-2 transition-all ${
                                                createForm.data.role === 'admin'
                                                    ? 'border-purple-500 bg-purple-50 shadow-lg'
                                                    : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-center mb-3">
                                                <div className={`p-3 rounded-full ${createForm.data.role === 'admin' ? 'bg-purple-100' : 'bg-slate-100'}`}>
                                                    <svg className={`w-8 h-8 ${createForm.data.role === 'admin' ? 'text-purple-600' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className={`font-bold text-lg ${createForm.data.role === 'admin' ? 'text-purple-700' : 'text-slate-900'}`}>Admin</div>
                                            <div className="text-sm text-slate-600 mt-1">Full system access</div>
                                        </button>
                                    </div>
                                    {createForm.errors.role && (
                                        <div className="mt-3 text-sm text-red-600 flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            {createForm.errors.role}
                                        </div>
                                    )}
                                </div>

                                {/* Submit Buttons */}
                                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t-2 border-slate-100">
                                    <Link
                                        href={route('users.index')}
                                        className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-all duration-200"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        Back to Users
                                    </Link>
                                    <button
                                        type="submit"
                                        disabled={createForm.processing}
                                        className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        {createForm.processing ? 'Creating User...' : 'Create User'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

