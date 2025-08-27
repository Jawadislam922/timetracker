import React, { useState } from 'react';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import AnimatedBackground from '../Components/AnimatedBackground';
import { Head, useForm, Link } from '@inertiajs/react';

export default function UserEdit({ auth, user }) {
    const [avatarPreview, setAvatarPreview] = useState(
        user.avatar ? `/storage/${user.avatar}` : null
    );
    
    const editForm = useForm({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role || 'employee',
        designation: user.designation || '',
        avatar: null,
        _method: 'PUT'
    });

    const handleEdit = (e) => {
        e.preventDefault();
        
        editForm.post(route('users.update', user.id), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                router.visit(route('users.index'));
            },
            onError: (errors) => {
                // Handle validation errors
            }
        });
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            editForm.setData('avatar', file);
            const reader = new FileReader();
            reader.onload = () => {
                setAvatarPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-slate-100 leading-tight">Edit User</h2>}
        >
            <Head title="Edit User" />
            
            {/* Animated Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" style={{background: '#282a2a'}}>
                <AnimatedBackground />
            </div>
            
            <div className="py-12 min-h-screen relative z-10">
                <div className="max-w-4xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl overflow-hidden shadow-2xl rounded-2xl border border-white/10">
                        <div className="p-8">
                            <div className="mb-8">
                                <h1 className="text-4xl font-bold text-white mb-2">
                                    Edit User
                                </h1>
                                <p className="text-white/70 text-lg">Update user information, role and avatar</p>
                            </div>
                            
                            <form onSubmit={handleEdit} className="space-y-8">
                                {/* Avatar Upload Section */}
                                <div className="flex flex-col items-center p-8 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-xl rounded-2xl border border-white/20">
                                    <div className="mb-6">
                                        {avatarPreview ? (
                                            <div className="relative">
                                                <img 
                                                    src={avatarPreview} 
                                                    alt="Avatar preview" 
                                                    className="w-32 h-32 rounded-full object-cover border-4 border-white/30 shadow-2xl backdrop-blur-xl"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        editForm.setData('avatar', null);
                                                        setAvatarPreview(user.avatar ? `/storage/${user.avatar}` : null);
                                                    }}
                                                    className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm transition-all shadow-lg backdrop-blur-xl"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-2xl">
                                                {user.name ? user.name.charAt(0).toUpperCase() : (
                                                    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <label className="cursor-pointer">
                                        <span className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            Change Avatar
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarChange}
                                            className="hidden"
                                        />
                                    </label>
                                    {editForm.errors.avatar && (
                                        <div className="text-red-400 text-sm mt-3">{editForm.errors.avatar}</div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Name */}
                                    <div>
                                        <label className="block text-sm font-semibold text-white/90 mb-3">
                                            Full Name <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Enter full name..."
                                            value={editForm.data.name}
                                            onChange={e => editForm.setData('name', e.target.value)}
                                            className="w-full px-4 py-3 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all text-white placeholder-white/50"
                                            required
                                        />
                                        {editForm.errors.name && (
                                            <div className="text-red-400 text-sm mt-2">{editForm.errors.name}</div>
                                        )}
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="block text-sm font-semibold text-white/90 mb-3">
                                            Email Address <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="Enter email address..."
                                            value={editForm.data.email}
                                            onChange={e => editForm.setData('email', e.target.value)}
                                            className="w-full px-4 py-3 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all text-white placeholder-white/50"
                                            required
                                        />
                                        {editForm.errors.email && (
                                            <div className="text-red-400 text-sm mt-2">{editForm.errors.email}</div>
                                        )}
                                    </div>

                                    {/* Password */}
                                    <div>
                                        <label className="block text-sm font-semibold text-white/90 mb-3">
                                            New Password
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="Leave blank to keep current password..."
                                            value={editForm.data.password}
                                            onChange={e => editForm.setData('password', e.target.value)}
                                            className="w-full px-4 py-3 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all text-white placeholder-white/50"
                                        />
                                        {editForm.errors.password && (
                                            <div className="text-red-400 text-sm mt-2">{editForm.errors.password}</div>
                                        )}
                                        <p className="text-xs text-white/60 mt-2">Leave empty to keep current password</p>
                                    </div>

                                    {/* Designation */}
                                    <div>
                                        <label className="block text-sm font-semibold text-white/90 mb-3">
                                            Designation
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Enter job title/designation..."
                                            value={editForm.data.designation}
                                            onChange={e => editForm.setData('designation', e.target.value)}
                                            className="w-full px-4 py-3 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all text-white placeholder-white/50"
                                        />
                                        {editForm.errors.designation && (
                                            <div className="text-red-400 text-sm mt-2">{editForm.errors.designation}</div>
                                        )}
                                    </div>
                                </div>

                                {/* Role Selection */}
                                <div>
                                    <label className="block text-sm font-semibold text-white/90 mb-4">
                                        User Role <span className="text-red-400">*</span>
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <button
                                            type="button"
                                            onClick={() => editForm.setData('role', 'employee')}
                                            className={`p-6 rounded-xl border-2 transition-all backdrop-blur-xl ${
                                                editForm.data.role === 'employee'
                                                    ? 'border-green-400 bg-green-500/20 text-green-300'
                                                    : 'border-white/20 bg-white/10 text-white hover:border-green-400/50 hover:bg-green-500/10'
                                            }`}
                                        >
                                            <div className="flex items-center justify-center mb-3">
                                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <div className="font-semibold text-lg">Employee</div>
                                            <div className="text-sm opacity-70 mt-1">Standard user access</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => editForm.setData('role', 'admin')}
                                            className={`p-6 rounded-xl border-2 transition-all backdrop-blur-xl ${
                                                editForm.data.role === 'admin'
                                                    ? 'border-purple-400 bg-purple-500/20 text-purple-300'
                                                    : 'border-white/20 bg-white/10 text-white hover:border-purple-400/50 hover:bg-purple-500/10'
                                            }`}
                                        >
                                            <div className="flex items-center justify-center mb-3">
                                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                </svg>
                                            </div>
                                            <div className="font-semibold text-lg">Admin</div>
                                            <div className="text-sm opacity-70 mt-1">Full system access</div>
                                        </button>
                                    </div>
                                    {editForm.errors.role && (
                                        <div className="text-red-400 text-sm mt-3">{editForm.errors.role}</div>
                                    )}
                                </div>

                                {/* Current User Info Display */}
                                <div className="p-6 bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-xl rounded-xl border border-white/20">
                                    <div className="flex items-center">
                                        <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold mr-4">
                                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm text-white/70">Editing User:</p>
                                            <p className="font-semibold text-white text-lg">{user.name} ({user.email})</p>
                                            <p className="text-sm text-white/60">Current Role: {user.role}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Buttons */}
                                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                                    <button
                                        type="submit"
                                        disabled={editForm.processing}
                                        className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl disabled:opacity-50 backdrop-blur-xl"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {editForm.processing ? 'Updating User...' : 'Update User'}
                                    </button>
                                    <Link
                                        href={route('users.index')}
                                        className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        Back to Users
                                    </Link>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
