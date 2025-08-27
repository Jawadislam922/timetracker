import React from 'react';
import AuthenticatedLayout from '../../Layouts/AuthenticatedLayout';
import AnimatedBackground from '../../Components/AnimatedBackground';
import { Head, useForm, Link } from '@inertiajs/react';

export default function Edit({ auth, profile }) {
    const { data, setData, put, processing, errors } = useForm({
        name: profile.name || '',
        email: profile.email || '',
        description: profile.description || '',
        is_active: profile.is_active || false,
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        put(route('upwork-profiles.update', profile.id));
    };

    return (
        <AuthenticatedLayout 
            user={auth.user} 
            header={<h2 className="font-semibold text-xl text-slate-100 leading-tight">Edit Upwork Profile</h2>}
        >
            <Head title="Edit Upwork Profile" />
            
            {/* Animated Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" style={{background: '#282a2a'}}>
                <AnimatedBackground />
            </div>
            
            <div className="py-12 min-h-screen relative z-10">
                <div className="max-w-4xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl overflow-hidden shadow-2xl rounded-2xl border border-white/10">
                        <div className="p-8 text-white">
                            <div className="mb-8">
                                <h1 className="text-4xl font-bold text-white mb-2">Edit Upwork Profile</h1>
                                <p className="text-white/70 text-lg">Update profile information for {profile.name}</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Profile Name */}
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                                        Profile Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-white placeholder-white/50"
                                        placeholder="Enter profile name (e.g., John Doe, Jane Smith)"
                                        required
                                    />
                                    {errors.name && (
                                        <div className="mt-1 text-sm text-red-300">{errors.name}</div>
                                    )}
                                </div>

                                {/* Email */}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                                        Email (Optional)
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-white placeholder-white/50"
                                        placeholder="Enter email address"
                                    />
                                    {errors.email && (
                                        <div className="mt-1 text-sm text-red-300">{errors.email}</div>
                                    )}
                                </div>

                                {/* Description */}
                                <div>
                                    <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
                                        Description (Optional)
                                    </label>
                                    <textarea
                                        id="description"
                                        rows={4}
                                        value={data.description}
                                        onChange={(e) => setData('description', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-white placeholder-white/50"
                                        placeholder="Add any notes or description for this profile..."
                                    />
                                    {errors.description && (
                                        <div className="mt-1 text-sm text-red-300">{errors.description}</div>
                                    )}
                                </div>

                                {/* Active Status */}
                                <div>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={data.is_active}
                                            onChange={(e) => setData('is_active', e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-white">
                                            Profile is active (active profiles appear in dropdown selections)
                                        </span>
                                    </label>
                                    {errors.is_active && (
                                        <div className="mt-1 text-sm text-red-300">{errors.is_active}</div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-6">
                                    <Link
                                        href={route('upwork-profiles.index')}
                                        className="inline-flex items-center px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all border border-white/20"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        Cancel
                                    </Link>
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                                    >
                                        {processing ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Updating...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Update Profile
                                            </>
                                        )}
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
