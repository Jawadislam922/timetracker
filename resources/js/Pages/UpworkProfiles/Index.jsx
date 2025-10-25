import React, { useState } from 'react';
import AuthenticatedLayout from '../../Layouts/AuthenticatedLayout';
import AnimatedBackground from '../../Components/AnimatedBackground';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Index({ auth, profiles }) {
    const { delete: destroy } = useForm();
    const [deleteModalProfile, setDeleteModalProfile] = useState(null);

    const handleDelete = (profile) => {
        if (confirm(`Are you sure you want to delete the profile "${profile.name}"? This action cannot be undone.`)) {
            destroy(route('upwork-profiles.destroy', profile.id), {
                onSuccess: () => {
                    // Handle success
                },
                onError: (errors) => {
                    // Delete failed
                }
            });
        }
    };

    return (
        <AuthenticatedLayout 
            user={auth.user} 
            header={<h2 className="font-semibold text-xl text-slate-100 leading-tight">Upwork Profiles</h2>}
        >
            <Head title="Upwork Profiles" />
            
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-blue-50/30 -z-10"></div>
            
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30">
                <div className="px-6 lg:px-12 xl:px-16 py-8 space-y-8">
                    
                    {/* Header Card with Gradient Icon */}
                    <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 border border-slate-100">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-6">
                                {/* Gradient Icon */}
                                <div className="p-4 bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl shadow-lg">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                {/* Title and Description */}
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Upwork Profiles</h1>
                                    <p className="text-slate-600">Manage your Upwork profile names for time tracking</p>
                                </div>
                            </div>
                            {/* Add Button */}
                            <Link
                                href={route('upwork-profiles.create')}
                                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Add New Profile
                            </Link>
                        </div>
                    </div>

                    {/* Profiles Grid Card */}
                    <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 border border-slate-100">
                        {profiles.length === 0 ? (
                            <div className="text-center py-16">
                                <svg className="w-24 h-24 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <h3 className="text-xl font-medium text-slate-900 mb-2">No profiles found</h3>
                                <p className="text-slate-600 mb-6">Get started by creating your first Upwork profile.</p>
                                <Link
                                    href={route('upwork-profiles.create')}
                                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
                                >
                                    Add Your First Profile
                                </Link>
                            </div>
                        ) : (
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {profiles.map((profile) => (
                                    <div
                                        key={profile.id}
                                        className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border-2 border-slate-200 p-6 hover:border-green-300 hover:shadow-lg transition-all group"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <h3 className="text-xl font-semibold text-slate-900 mb-2">{profile.name}</h3>
                                                {profile.email && (
                                                    <p className="text-slate-600 text-sm mb-2 flex items-center">
                                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                        </svg>
                                                        {profile.email}
                                                    </p>
                                                )}
                                                {profile.description && (
                                                    <p className="text-slate-500 text-sm line-clamp-2">{profile.description}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 ml-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                                    profile.is_active 
                                                        ? 'bg-green-100 text-green-700' 
                                                        : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {profile.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                                            <div className="text-slate-500 text-sm flex items-center">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                {new Date(profile.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={route('upwork-profiles.edit', profile.id)}
                                                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
                                                >
                                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                    Edit
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(profile)}
                                                    className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
                                                >
                                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

