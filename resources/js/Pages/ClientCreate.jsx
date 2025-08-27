import React from 'react';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import AnimatedBackground from '../Components/AnimatedBackground';
import TagInput from '../Components/TagInput';
import { Head, useForm, Link } from '@inertiajs/react';

export default function ClientCreate({ auth, upworkProfiles, workTypes }) {
    const form = useForm({
        name: '',
        tags: [],
        work_type: '',
        upwork_profile_id: '',
    });

    // Search and dropdown states
    const [workTypeSearch, setWorkTypeSearch] = React.useState('');
    const [profileSearch, setProfileSearch] = React.useState('');
    const [showWorkTypeDropdown, setShowWorkTypeDropdown] = React.useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = React.useState(false);
    
    // Refs for dropdown management
    const workTypeRef = React.useRef(null);
    const profileRef = React.useRef(null);
    const workTypeDropdownRef = React.useRef(null);
    const profileDropdownRef = React.useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        form.post(route('clients.store'));
    };

    // Check if profile is required for the selected work type
    const isProfileRequired = form.data.work_type && ['tracker_manual', 'fixed'].includes(form.data.work_type);
    
    // Reset profile when work type changes and profile is not required
    React.useEffect(() => {
        if (!isProfileRequired && form.data.upwork_profile_id) {
            form.setData('upwork_profile_id', '');
            setProfileSearch('');
        }
    }, [form.data.work_type]);

    // Close dropdowns when clicking outside
    React.useEffect(() => {
        function handleClickOutside(event) {
            if (workTypeRef.current && workTypeDropdownRef.current && 
                !workTypeRef.current.contains(event.target) && 
                !workTypeDropdownRef.current.contains(event.target)) {
                setShowWorkTypeDropdown(false);
            }
            if (profileRef.current && profileDropdownRef.current && 
                !profileRef.current.contains(event.target) && 
                !profileDropdownRef.current.contains(event.target)) {
                setShowProfileDropdown(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Filter work types based on search
    const filteredWorkTypes = Object.entries(workTypes || {}).filter(([key, value]) =>
        value.toLowerCase().includes(workTypeSearch.toLowerCase())
    );

    // Filter profiles based on search
    const filteredProfiles = upworkProfiles?.filter(profile =>
        profile.name.toLowerCase().includes(profileSearch.toLowerCase())
    ) || [];

    // Handle work type selection
    const handleWorkTypeSelect = (key, value) => {
        form.setData('work_type', key);
        setWorkTypeSearch(value);
        setShowWorkTypeDropdown(false);
    };

    // Handle profile selection
    const handleProfileSelect = (profile) => {
        form.setData('upwork_profile_id', profile.id);
        setProfileSearch(profile.name);
        setShowProfileDropdown(false);
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-semibold text-xl text-slate-100 leading-tight">Add Client</h2>}>
            <Head title="Add Client" />
            
            {/* Animated Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" style={{background: '#282a2a'}}>
                <AnimatedBackground />
            </div>
            
            <div className="py-12 min-h-screen relative z-10">
                <div className="max-w-2xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl overflow-hidden shadow-2xl rounded-2xl border border-white/10">
                        <div className="p-8">
                            <div className="mb-8">
                                <h1 className="text-4xl font-bold text-white mb-2">
                                    Add Client
                                </h1>
                                <p className="text-white/70 text-lg">Create a new client for your projects</p>
                            </div>
                            
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Client Name */}
                                <div>
                                    <label className="block text-sm font-semibold text-white/90 mb-3">
                                        Client Name <span className="text-red-400">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter client name..." 
                                        value={form.data.name} 
                                        onChange={e => form.setData('name', e.target.value)} 
                                        className="w-full px-4 py-3 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all text-white placeholder-white/50"
                                        required 
                                    />
                                    {form.errors.name && <div className="text-red-400 text-sm mt-2">{form.errors.name}</div>}
                                </div>

                                {/* Work Type - Searchable Dropdown */}
                                <div ref={workTypeRef} className="relative">
                                    <label className="block text-sm font-semibold text-white/90 mb-3">
                                        Work Type <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Search and select work type..."
                                        value={workTypeSearch}
                                        onChange={(e) => {
                                            setWorkTypeSearch(e.target.value);
                                            setShowWorkTypeDropdown(true);
                                        }}
                                        onFocus={() => setShowWorkTypeDropdown(true)}
                                        className="w-full px-4 py-3 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all text-white placeholder-white/50"
                                        required
                                    />
                                    {showWorkTypeDropdown && filteredWorkTypes.length > 0 && (
                                        <div ref={workTypeDropdownRef} className="absolute z-50 w-full mt-1 bg-slate-800 border border-white/20 rounded-xl shadow-2xl backdrop-blur-xl max-h-60 overflow-y-auto">
                                            {filteredWorkTypes.map(([key, value]) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => handleWorkTypeSelect(key, value)}
                                                    className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-all first:rounded-t-xl last:rounded-b-xl"
                                                >
                                                    {value}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {form.errors.work_type && <div className="text-red-400 text-sm mt-2">{form.errors.work_type}</div>}
                                </div>

                                {/* Upwork Profile - conditionally shown with search */}
                                {(isProfileRequired) && (
                                    <div ref={profileRef} className="relative">
                                        <label className="block text-sm font-semibold text-white/90 mb-3">
                                            Upwork Profile 
                                            {isProfileRequired && <span className="text-red-400">*</span>}
                                            {!isProfileRequired && <span className="text-white/50 font-normal ml-2">(optional)</span>}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={isProfileRequired ? 'Search and select upwork profile...' : 'Search and select upwork profile (optional)...'}
                                            value={profileSearch}
                                            onChange={(e) => {
                                                setProfileSearch(e.target.value);
                                                setShowProfileDropdown(true);
                                            }}
                                            onFocus={() => setShowProfileDropdown(true)}
                                            className="w-full px-4 py-3 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all text-white placeholder-white/50"
                                            required={isProfileRequired}
                                        />
                                        {showProfileDropdown && filteredProfiles.length > 0 && (
                                            <div ref={profileDropdownRef} className="absolute z-50 w-full mt-1 bg-slate-800 border border-white/20 rounded-xl shadow-2xl backdrop-blur-xl max-h-60 overflow-y-auto">
                                                {filteredProfiles.map((profile) => (
                                                    <button
                                                        key={profile.id}
                                                        type="button"
                                                        onClick={() => handleProfileSelect(profile)}
                                                        className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-all first:rounded-t-xl last:rounded-b-xl"
                                                    >
                                                        <div>
                                                            <div className="font-medium">{profile.name}</div>
                                                            {profile.email && <div className="text-sm text-white/70">{profile.email}</div>}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {form.errors.upwork_profile_id && <div className="text-red-400 text-sm mt-2">{form.errors.upwork_profile_id}</div>}
                                        <p className="text-white/60 text-sm mt-2">
                                            {isProfileRequired 
                                                ? 'Select the Upwork profile associated with this client'
                                                : 'Optionally select an Upwork profile for this client'
                                            }
                                        </p>
                                    </div>
                                )}

                                {/* Tags */}
                                <div>
                                    <label className="block text-sm font-semibold text-white/90 mb-3">
                                        Tags
                                        <span className="text-white/50 font-normal ml-2">(optional)</span>
                                    </label>
                                    <TagInput
                                        tags={form.data.tags}
                                        onChange={(newTags) => form.setData('tags', newTags)}
                                        placeholder="Add tags to categorize this client..."
                                    />
                                    {form.errors.tags && <div className="text-red-400 text-sm mt-2">{form.errors.tags}</div>}
                                    <p className="text-white/60 text-sm mt-2">
                                        Add tags to help organize and search for clients (e.g., "Enterprise", "Startup", "Local")
                                    </p>
                                </div>

                                {/* Preview Card - only show if name is entered */}
                                {form.data.name && (
                                    <div className="p-6 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-xl rounded-xl border border-white/20">
                                        <div className="flex items-center mb-4">
                                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-xl mr-4 shadow-lg">
                                                {form.data.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm text-white/60 mb-1">New Client Preview:</p>
                                                <p className="font-semibold text-white text-lg">{form.data.name}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            {form.data.work_type && (
                                                <div>
                                                    <p className="text-sm text-white/60 mb-1">Work Type:</p>
                                                    <span className="inline-flex px-3 py-1 text-xs font-medium bg-blue-500/20 text-blue-300 rounded-md backdrop-blur-xl border border-blue-400/30">
                                                        {workTypes?.[form.data.work_type] || form.data.work_type}
                                                    </span>
                                                </div>
                                            )}
                                            
                                            {form.data.upwork_profile_id && (
                                                <div>
                                                    <p className="text-sm text-white/60 mb-1">Upwork Profile:</p>
                                                    <span className="inline-flex px-3 py-1 text-xs font-medium bg-purple-500/20 text-purple-300 rounded-md backdrop-blur-xl border border-purple-400/30">
                                                        {upworkProfiles?.find(p => p.id == form.data.upwork_profile_id)?.name || 'Unknown'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {form.data.tags && form.data.tags.length > 0 && (
                                            <div>
                                                <p className="text-sm text-white/60 mb-2">Tags:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {form.data.tags.map((tag, index) => (
                                                        <span
                                                            key={index}
                                                            className="inline-flex px-2 py-1 text-xs font-medium bg-green-500/20 text-green-300 rounded-md backdrop-blur-xl border border-green-400/30"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Submit Buttons */}
                                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                                    <button
                                        type="submit"
                                        disabled={form.processing}
                                        className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl disabled:opacity-50 backdrop-blur-xl"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {form.processing ? 'Creating...' : 'Create Client'}
                                    </button>
                                    <Link
                                        href={route('clients.index')}
                                        className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-xl"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        Back to Clients
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
