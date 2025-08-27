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
            
            {/* Animated Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" style={{background: '#282a2a'}}>
                <AnimatedBackground />
            </div>
            
            <div className="py-12 min-h-screen relative z-10">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl overflow-hidden shadow-2xl rounded-2xl border border-white/10">
                        <div className="p-8 text-white">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h1 className="text-4xl font-bold text-white mb-2">Upwork Profiles</h1>
                                    <p className="text-white/70 text-lg">Manage your Upwork profile names for time tracking</p>
                                </div>
                                <Link
                                    href={route('upwork-profiles.create')}
                                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Add New Profile
                                </Link>
                            </div>

                            {profiles.length === 0 ? (
                                <div className="text-center py-16">
                                    <svg className="w-24 h-24 mx-auto text-white/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <h3 className="text-xl font-medium text-white mb-2">No profiles found</h3>
                                    <p className="text-white/70 mb-6">Get started by creating your first Upwork profile.</p>
                                    <Link
                                        href={route('upwork-profiles.create')}
                                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all"
                                    >
                                        Add Your First Profile
                                    </Link>
                                </div>
                            ) : (
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {profiles.map((profile) => (
                                        <div
                                            key={profile.id}
                                            className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all group"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1">
                                                    <h3 className="text-xl font-semibold text-white mb-2">{profile.name}</h3>
                                                    {profile.email && (
                                                        <p className="text-white/70 text-sm mb-2">{profile.email}</p>
                                                    )}
                                                    {profile.description && (
                                                        <p className="text-white/60 text-sm line-clamp-2">{profile.description}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        profile.is_active 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {profile.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                                <div className="text-white/60 text-sm">
                                                    Created {new Date(profile.created_at).toLocaleDateString()}
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Link
                                                        href={route('upwork-profiles.edit', profile.id)}
                                                        className="inline-flex items-center px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 rounded-lg text-sm font-medium transition-all"
                                                    >
                                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                        Edit
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(profile)}
                                                        className="inline-flex items-center px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-sm font-medium transition-all"
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
            </div>
        </AuthenticatedLayout>
    );
}
