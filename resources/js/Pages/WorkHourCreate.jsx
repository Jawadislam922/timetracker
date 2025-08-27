import React, { useState, useRef, useEffect } from 'react';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import AnimatedBackground from '../Components/AnimatedBackground';
import { Head, useForm, Link } from '@inertiajs/react';

export default function WorkHourCreate({ auth, clients = [], trackers = [] }) {
    const form = useForm({
        date: (() => {
            // Get current date in Pakistan timezone (Asia/Karachi)
            const pakistanDate = new Date().toLocaleDateString('en-CA', {
                timeZone: 'Asia/Karachi'
            });
            return pakistanDate; // Returns YYYY-MM-DD format
        })(),
        hours: '0',
        minutes: '0',
        description: '',
        work_type: 'tracker',
        client_id: '',
        tracker: '',
        trackerSearch: '',
        clientSearch: '',
    });
    const [showTrackerOptions, setShowTrackerOptions] = useState(false);
    const [showClientOptions, setShowClientOptions] = useState(false);
    const [clientValidationError, setClientValidationError] = useState('');
    const [trackerValidationError, setTrackerValidationError] = useState('');
    const trackerRef = useRef(null);
    const clientRef = useRef(null);
    const trackerDropdownRef = useRef(null);
    const clientDropdownRef = useRef(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (trackerRef.current && trackerDropdownRef.current && 
                !trackerRef.current.contains(event.target) && 
                !trackerDropdownRef.current.contains(event.target)) {
                setShowTrackerOptions(false);
            }
            if (clientRef.current && clientDropdownRef.current && 
                !clientRef.current.contains(event.target) && 
                !clientDropdownRef.current.contains(event.target)) {
                setShowClientOptions(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Helper function to check if time is entered
    const hasTimeEntered = () => {
        const hours = Number(form.data.hours) || 0;
        const minutes = Number(form.data.minutes) || 0;
        return hours > 0 || minutes > 0;
    };

    // Validate client selection
    const validateClient = (searchValue) => {
        if (!isClientRequired()) {
            setClientValidationError('');
            return true;
        }

        if (!searchValue || searchValue.trim() === '') {
            setClientValidationError('Please select a client from the dropdown');
            return false;
        }

        // Check if the entered value exactly matches a client name
        const matchingClient = clients.find(client => client.name === searchValue);
        if (!matchingClient) {
            setClientValidationError('Please select a valid client from the dropdown');
            return false;
        }

        // Ensure client_id is set correctly
        if (form.data.client_id != matchingClient.id) {
            form.setData('client_id', matchingClient.id);
        }

        setClientValidationError('');
        return true;
    };

    // Validate tracker selection
    const validateTracker = (searchValue) => {
        if (!isTrackerRequired()) {
            setTrackerValidationError('');
            return true;
        }

        if (!searchValue || searchValue.trim() === '') {
            setTrackerValidationError('Please select a profile from the dropdown');
            return false;
        }

        // Check if the entered value exactly matches a tracker
        const matchingTracker = trackers.find(tracker => tracker === searchValue);
        if (!matchingTracker) {
            setTrackerValidationError('Please select a valid profile from the dropdown');
            return false;
        }

        // Ensure tracker is set correctly
        if (form.data.tracker !== matchingTracker) {
            form.setData('tracker', matchingTracker);
        }

        setTrackerValidationError('');
        return true;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Check if at least some time is entered
        const hours = Number(form.data.hours) || 0;
        const minutes = Number(form.data.minutes) || 0;
        
        if (hours === 0 && minutes === 0) {
            alert('Please enter at least some time (hours or minutes).');
            return;
        }

        // Validate client selection
        const isClientValid = validateClient(form.data.clientSearch);
        const isTrackerValid = validateTracker(form.data.trackerSearch || form.data.tracker);

        if (!isClientValid || !isTrackerValid) {
            return; // Don't submit if validation fails
        }
        
        // Calculate total hours as decimal (hours + minutes/60)
        const totalHours = hours + (minutes / 60);
        
        // Round to 2 decimal places for precision
        const roundedTotal = Math.round(totalHours * 100) / 100;
        
        form.post(route('work-hours.store', { hours: roundedTotal }));
    };

    const workTypes = [
        { label: 'Tracker', value: 'tracker' },
        { label: 'Manual Time', value: 'manual' },
        { label: 'Fixed Client', value: 'fixed' },
        { label: 'Outside of Upwork', value: 'outside_of_upwork' },
        { label: 'Office Work', value: 'office_work' },
        { label: 'Test Task', value: 'test_task' },
    ];

    const handleTrackerFocus = () => {
        setShowTrackerOptions(true);
        setShowClientOptions(false);
    };

    const handleClientFocus = () => {
        setShowClientOptions(true);
        setShowTrackerOptions(false);
    };

    const handleWorkTypeChange = (workType) => {
        // Clear fields that might not be needed for the new work type
        const newData = {
            ...form.data,
            work_type: workType,
        };

        // Clear profile name if not needed for this work type
        if (!['tracker', 'manual', 'fixed'].includes(workType)) {
            newData.tracker = '';
            newData.trackerSearch = '';
            setTrackerValidationError('');
        }

        // Clear client if not needed for this work type
        if (!['tracker', 'manual', 'fixed', 'outside_of_upwork'].includes(workType)) {
            newData.client_id = '';
            newData.clientSearch = '';
            setClientValidationError('');
        }

        form.setData(newData);
    };

    const isTrackerRequired = () => {
        return ['tracker', 'manual', 'fixed'].includes(form.data.work_type);
    };

    const isClientRequired = () => {
        return ['tracker', 'manual', 'fixed', 'outside_of_upwork'].includes(form.data.work_type);
    };

    // Handle client search change
    const handleClientSearchChange = (e) => {
        const val = e.target.value;
        form.setData('clientSearch', val);
        
        // Clear client_id if the search doesn't match any client exactly
        const matchingClient = clients.find(client => client.name === val);
        if (!matchingClient) {
            form.setData('client_id', '');
        } else {
            form.setData('client_id', matchingClient.id);
        }
        
        // Clear validation error when user starts typing
        if (clientValidationError) {
            setClientValidationError('');
        }
        
        setShowClientOptions(true);
    };

    // Handle tracker search change
    const handleTrackerSearchChange = (e) => {
        const val = e.target.value;
        form.setData('trackerSearch', val);
        
        // Clear tracker if the search doesn't match any tracker exactly
        const matchingTracker = trackers.find(tracker => tracker === val);
        if (!matchingTracker) {
            form.setData('tracker', '');
        } else {
            form.setData('tracker', matchingTracker);
        }
        
        // Clear validation error when user starts typing
        if (trackerValidationError) {
            setTrackerValidationError('');
        }
        
        setShowTrackerOptions(true);
    };

    // Handle client selection from dropdown
    const handleClientSelect = (client) => {
        form.setData('client_id', client.id);
        form.setData('clientSearch', client.name);
        setClientValidationError(''); // Clear any validation errors immediately
        setShowClientOptions(false);
        
        // Ensure validation passes for this selection
        setTimeout(() => {
            validateClient(client.name);
        }, 50);
    };

    // Handle tracker selection from dropdown
    const handleTrackerSelect = (tracker) => {
        form.setData('tracker', tracker);
        form.setData('trackerSearch', tracker);
        setTrackerValidationError(''); // Clear any validation errors immediately
        setShowTrackerOptions(false);
        
        // Ensure validation passes for this selection
        setTimeout(() => {
            validateTracker(tracker);
        }, 50);
    };

    // Handle client field blur - validate when user leaves the field
    const handleClientBlur = () => {
        setTimeout(() => {
            setShowClientOptions(false);
            if (isClientRequired()) {
                validateClient(form.data.clientSearch);
            }
        }, 300); // Increased timeout to allow dropdown click to complete
    };

    // Handle tracker field blur - validate when user leaves the field
    const handleTrackerBlur = () => {
        setTimeout(() => {
            setShowTrackerOptions(false);
            if (isTrackerRequired()) {
                validateTracker(form.data.trackerSearch || form.data.tracker);
            }
        }, 300); // Increased timeout to allow dropdown click to complete
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-semibold text-xl text-slate-100 leading-tight">Add Work Entry</h2>}>
            <Head title="Add Work Entry" />
            
            {/* Animated Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" style={{background: '#282a2a'}}>
                <AnimatedBackground />
            </div>
            
            <div className="py-12 min-h-screen relative z-10">
                <div className="max-w-4xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl overflow-visible shadow-2xl rounded-2xl border border-white/10">
                        <div className="p-8 text-white relative">
                            <div className="mb-8">
                                <h1 className="text-4xl font-bold text-white mb-2">Add Work Entry</h1>
                                <p className="text-white/70 text-lg">Log your work hours and track your progress</p>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="mb-6 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6">
                                    <div className="mb-4">
                                        <h3 className="text-lg font-semibold text-white mb-2">Work Type</h3>
                                        <p className="text-sm text-white/70 mb-4">
                                            Required fields for selected type: {' '}
                                            {form.data.work_type === 'tracker' && "Profile Name, Client Name, Description, Hours/Minutes, Tracking Date"}
                                            {form.data.work_type === 'manual' && "Profile Name, Client Name, Description, Hours/Minutes, Tracking Date"}
                                            {form.data.work_type === 'fixed' && "Profile Name, Client Name, Description, Hours/Minutes, Tracking Date"}
                                            {form.data.work_type === 'outside_of_upwork' && "Client Name, Description, Hours/Minutes, Tracking Date"}
                                            {form.data.work_type === 'office_work' && "Description, Hours/Minutes, Tracking Date"}
                                            {form.data.work_type === 'test_task' && "Description, Hours/Minutes, Tracking Date"}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        {workTypes.map((type) => (
                                            <button
                                                key={type.value}
                                                type="button"
                                                onClick={() => handleWorkTypeChange(type.value)}
                                                className={`p-3 rounded-xl font-medium transition-all text-sm ${
                                                    form.data.work_type === type.value
                                                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                                                        : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                                                }`}
                                            >
                                                {type.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className={`grid gap-6 mb-6 ${
                                    isTrackerRequired() && isClientRequired() ? 'md:grid-cols-2' : 
                                    isClientRequired() ? 'md:grid-cols-1' : 
                                    isTrackerRequired() ? 'md:grid-cols-1' : 
                                    'md:grid-cols-1'
                                }`}>
                                    {/* Profile Name */}
                                    {isTrackerRequired() && (
                                        <div className="relative">
                                            <label htmlFor="tracker" className="block text-sm font-medium text-white mb-2">
                                                Profile Name <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                ref={trackerRef}
                                                type="text"
                                                placeholder="Search or select profile..."
                                                className={`w-full px-4 py-3 bg-white/10 backdrop-blur-xl border rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-white placeholder-white/50 ${
                                                    trackerValidationError ? 'border-red-400' : 'border-white/20'
                                                }`}
                                                value={
                                                    form.data.trackerSearch ||
                                                    (form.data.tracker ? form.data.tracker : '')
                                                }
                                                onChange={handleTrackerSearchChange}
                                                onFocus={handleTrackerFocus}
                                                onBlur={handleTrackerBlur}
                                                required={isTrackerRequired()}
                                            />
                                            {trackerValidationError && (
                                                <div className="mt-1 text-sm text-red-300">
                                                    {trackerValidationError}
                                                </div>
                                            )}
                                            {showTrackerOptions && (
                                                <div 
                                                    ref={trackerDropdownRef}
                                                    className="absolute z-50 w-full mt-1 bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-xl max-h-48 overflow-y-auto shadow-2xl"
                                                >
                                                    <div className="p-2">
                                                        {trackers.filter(tracker => 
                                                            !form.data.trackerSearch || tracker.toLowerCase().includes(form.data.trackerSearch.toLowerCase())
                                                        ).map((tracker, index) => (
                                                            <button
                                                                key={index}
                                                                type="button"
                                                                className="w-full text-left px-3 py-2 hover:bg-white/20 rounded-lg text-white transition-all"
                                                                onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking
                                                                onClick={() => handleTrackerSelect(tracker)}
                                                            >
                                                                {tracker}
                                                            </button>
                                                        ))}
                                                        {trackers.filter(tracker => 
                                                            !form.data.trackerSearch || tracker.toLowerCase().includes(form.data.trackerSearch.toLowerCase())
                                                        ).length === 0 && form.data.trackerSearch && (
                                                            <div className="px-3 py-2 text-white/60 text-sm">
                                                                No profiles found. Please select from available options.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Client Name */}
                                    {isClientRequired() && (
                                        <div className="relative">
                                            <label htmlFor="client" className="block text-sm font-medium text-white mb-2">
                                                Client Name <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                ref={clientRef}
                                                type="text"
                                                placeholder="Search or select client..."
                                                className={`w-full px-4 py-3 bg-white/10 backdrop-blur-xl border rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-white placeholder-white/50 ${
                                                    clientValidationError ? 'border-red-400' : 'border-white/20'
                                                }`}
                                                value={form.data.clientSearch}
                                                onChange={handleClientSearchChange}
                                                onFocus={handleClientFocus}
                                                onBlur={handleClientBlur}
                                                required={isClientRequired()}
                                            />
                                            {clientValidationError && (
                                                <div className="mt-1 text-sm text-red-300">
                                                    {clientValidationError}
                                                </div>
                                            )}
                                            {showClientOptions && (
                                                <div 
                                                    ref={clientDropdownRef}
                                                    className="absolute z-50 w-full mt-1 bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-xl max-h-48 overflow-y-auto shadow-2xl"
                                                >
                                                    <div className="p-2">
                                                        {clients.filter(client => {
                                                            const label = client.name;
                                                            return !form.data.clientSearch || label.toLowerCase().includes(form.data.clientSearch.toLowerCase());
                                                        }).map(client => (
                                                            <button
                                                                key={client.id}
                                                                type="button"
                                                                className="w-full text-left px-3 py-2 hover:bg-white/20 rounded-lg text-white transition-all"
                                                                onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking
                                                                onClick={() => handleClientSelect(client)}
                                                            >
                                                                {client.name}
                                                            </button>
                                                        ))}
                                                        {clients.filter(client => {
                                                            const label = client.name;
                                                            return !form.data.clientSearch || label.toLowerCase().includes(form.data.clientSearch.toLowerCase());
                                                        }).length === 0 && form.data.clientSearch && (
                                                            <div className="px-3 py-2 text-white/60 text-sm">
                                                                No clients found. Please select from available options.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                    {/* Date */}
                                    <div>
                                        <label htmlFor="date" className="block text-sm font-medium text-white mb-2">
                                            Date <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            id="date"
                                            value={form.data.date}
                                            onChange={(e) => form.setData('date', e.target.value)}
                                            className="w-full px-4 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-white"
                                            required
                                        />
                                    </div>

                                    {/* Hours */}
                                    <div>
                                        <label htmlFor="hours" className="block text-sm font-medium text-white mb-2">
                                            Hours <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            id="hours"
                                            min="0"
                                            max="24"
                                            step="1"
                                            value={form.data.hours}
                                            onChange={(e) => {
                                                let value = parseInt(e.target.value);
                                                if (isNaN(value) || value < 0) value = 0;
                                                if (value > 24) value = 24;
                                                form.setData('hours', value.toString());
                                            }}
                                            onWheel={(e) => e.target.blur()}
                                            onFocus={(e) => e.target.addEventListener('wheel', (event) => event.preventDefault(), { passive: false })}
                                            onBlur={(e) => e.target.removeEventListener('wheel', (event) => event.preventDefault())}
                                            placeholder="Enter hours (0-24)"
                                            className="w-full px-4 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-white placeholder-white/50"
                                            required
                                        />
                                    </div>

                                    {/* Minutes */}
                                    <div>
                                        <label htmlFor="minutes" className="block text-sm font-medium text-white mb-2">
                                            Minutes
                                        </label>
                                        <input
                                            type="number"
                                            id="minutes"
                                            min="0"
                                            max="59"
                                            step="1"
                                            value={form.data.minutes}
                                            onChange={(e) => {
                                                let value = parseInt(e.target.value);
                                                if (isNaN(value) || value < 0) value = 0;
                                                if (value > 59) value = 59;
                                                form.setData('minutes', value.toString());
                                            }}
                                            onWheel={(e) => e.target.blur()}
                                            onFocus={(e) => e.target.addEventListener('wheel', (event) => event.preventDefault(), { passive: false })}
                                            onBlur={(e) => e.target.removeEventListener('wheel', (event) => event.preventDefault())}
                                            placeholder="Enter minutes (0-59)"
                                            className="w-full px-4 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-white placeholder-white/50"
                                        />
                                    </div>
                                </div>

                                {/* Total Time Display */}
                                <div className={`mb-6 p-4 backdrop-blur-xl rounded-xl border ${
                                    hasTimeEntered() 
                                        ? 'bg-gradient-to-r from-green-500/20 to-blue-500/20 border-white/20' 
                                        : 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border-red-400/30'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <svg className={`w-6 h-6 ${hasTimeEntered() ? 'text-blue-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div className="text-white">
                                            <div className={`text-sm font-medium ${hasTimeEntered() ? 'text-white/70' : 'text-red-300'}`}>
                                                Total Time {!hasTimeEntered() && '(Required)'}
                                            </div>
                                            <div className={`text-2xl font-bold ${!hasTimeEntered() ? 'text-red-300' : ''}`}>
                                                {(() => {
                                                    const hours = parseInt(form.data.hours) || 0;
                                                    const minutes = parseInt(form.data.minutes) || 0;
                                                    if (hours === 0 && minutes === 0) {
                                                        return 'No time entered';
                                                    }
                                                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                                                })()}
                                            </div>
                                            {hasTimeEntered() && (
                                                <div className="text-xs text-white/60">
                                                    {(() => {
                                                        const hours = parseInt(form.data.hours) || 0;
                                                        const minutes = parseInt(form.data.minutes) || 0;
                                                        const totalHours = hours + (minutes / 60);
                                                        return `${totalHours.toFixed(2)} decimal hours`;
                                                    })()}
                                                </div>
                                            )}
                                            {!hasTimeEntered() && (
                                                <div className="text-xs text-red-300">
                                                    Please enter at least some hours or minutes
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="mb-6">
                                    <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
                                        Description <span className="text-red-400">*</span>
                                    </label>
                                    <textarea
                                        id="description"
                                        rows={4}
                                        value={form.data.description}
                                        onChange={(e) => form.setData('description', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-white placeholder-white/50"
                                        placeholder="Describe the work you did..."
                                        required
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Link
                                        href={route('work-hours.index')}
                                        className="inline-flex items-center px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all border border-white/20"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        Cancel
                                    </Link>
                                    <button
                                        type="submit"
                                        disabled={form.processing}
                                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                                    >
                                        {form.processing ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Create Entry
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