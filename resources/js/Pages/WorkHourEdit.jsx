import React from 'react';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import { Head, useForm, Link } from '@inertiajs/react';
import PageHeader from '../Components/Layout/PageHeader';
import PageShell from '../Components/Layout/PageShell';

export default function WorkHourEdit({ auth, workHour, windowSlots = [], trackers = [], clients = [] }) {
    // Tracker-recorded entries have locked hours — the time always reflects what
    // the desktop measured, so it can't be edited up/down. Description, client,
    // and work type stay editable. (The server enforces this too.)
    const isTracked = !!workHour.tracking_session_id || workHour.source === 'tracker';

    // Convert decimal hours back to hours and minutes for the locked display.
    const lockedMinutes = Math.round(workHour.hours * 60);
    const displayHours = Math.floor(lockedMinutes / 60);
    const displayMinutes = lockedMinutes % 60;

    const form = useForm({
        date: workHour.date,
        // Locked tracker hours stay on hours/minutes; manual entries use windows.
        hours: displayHours.toString(),
        minutes: displayMinutes.toString(),
        windows: (windowSlots || []).map((w) => ({ start: w.start, end: w.end })),
        description: workHour.description || '',
        work_type: workHour.work_type || 'tracker',
        client_id: workHour.client_id || '',
        tracker: workHour.tracker || '',
        trackerSearch: '',
        clientSearch: '',
    });

    // The owner's open gaps for the entry's date (excluding THIS entry's own
    // windows so they read as fillable, not "busy"). Only needed for manual.
    const [gaps, setGaps] = React.useState([]);
    const [gapsLoading, setGapsLoading] = React.useState(false);
    const [gapsError, setGapsError] = React.useState('');

    React.useEffect(() => {
        if (isTracked || !form.data.date) return;
        let cancelled = false;
        setGapsLoading(true);
        setGapsError('');
        const params = { date: form.data.date, ignore: workHour.id };
        if (workHour.user_id) params.user_id = workHour.user_id;
        fetch(route('work-hours.gaps', params), {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => { if (!cancelled) setGaps(data.gaps || []); })
            .catch(() => { if (!cancelled) { setGaps([]); setGapsError('Could not load in-office time for this day.'); } })
            .finally(() => { if (!cancelled) setGapsLoading(false); });
        return () => { cancelled = true; };
    }, [form.data.date, isTracked]);

    // --- Window row helpers ---------------------------------------------------
    // Times are stored as full 'HH:MM:SS' so a gap's exact seconds survive.
    const secondsOf = (t) => {
        if (!t) return null;
        const [h = 0, m = 0, s = 0] = t.split(':').map(Number);
        return h * 3600 + m * 60 + s;
    };
    const minutesBetween = (start, end) => {
        const a = secondsOf(start);
        const b = secondsOf(end);
        if (a === null || b === null) return 0;
        return Math.round((b - a) / 60);
    };
    const totalWindowMinutes = (form.data.windows || []).reduce(
        (acc, w) => acc + Math.max(0, minutesBetween(w.start, w.end)), 0,
    );
    const addWindow = (start = '', end = '') =>
        form.setData('windows', [...(form.data.windows || []), { start, end }]);
    const removeWindow = (i) =>
        form.setData('windows', (form.data.windows || []).filter((_, idx) => idx !== i));
    const updateWindow = (i, key, val) =>
        form.setData('windows', (form.data.windows || []).map((w, idx) => (idx === i ? { ...w, [key]: val } : w)));
    const fmtMins = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
    const to12 = (hhmm) => {
        if (!hhmm) return '--';
        const [h, m] = hhmm.split(':').map(Number);
        const ap = h < 12 ? 'AM' : 'PM';
        const hr = h % 12 === 0 ? 12 : h % 12;
        return `${hr}:${String(m).padStart(2, '0')} ${ap}`;
    };
    const [showTrackerOptions, setShowTrackerOptions] = React.useState(false);
    const [showClientOptions, setShowClientOptions] = React.useState(false);
    const [clientValidationError, setClientValidationError] = React.useState('');
    const [trackerValidationError, setTrackerValidationError] = React.useState('');
    const trackerRef = React.useRef(null);
    const clientRef = React.useRef(null);
    const trackerDropdownRef = React.useRef(null);
    const clientDropdownRef = React.useRef(null);

    // Close dropdowns when clicking outside
    React.useEffect(() => {
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

        // Validate client selection
        const isClientValid = validateClient(form.data.clientSearch);
        const isTrackerValid = validateTracker(form.data.trackerSearch || form.data.tracker);
        if (!isClientValid || !isTrackerValid) {
            return; // Don't submit if validation fails
        }

        if (isTracked) {
            // Hours are locked server-side; just send the editable fields. The
            // server ignores submitted hours/windows for tracker rows.
            form.transform((data) => ({
                date: data.date,
                description: data.description,
                work_type: data.work_type,
                client_id: data.client_id,
                tracker: data.tracker,
                hours: displayHours,
                minutes: displayMinutes,
            }));
            form.put(route('work-hours.update', workHour.id));
            return;
        }

        // Manual entry — submit windows.
        const windows = (form.data.windows || []).filter((w) => w.start && w.end);
        if (windows.length === 0) {
            alert('Please add at least one time window (start and end).');
            return;
        }
        if (windows.some((w) => minutesBetween(w.start, w.end) <= 0)) {
            alert('Each time window must end after it starts.');
            return;
        }

        form.transform((data) => ({
            date: data.date,
            description: data.description,
            work_type: data.work_type,
            client_id: data.client_id,
            tracker: data.tracker,
            windows: windows.map((w) => ({
                start_at: `${data.date}T${w.start}`,
                end_at: `${data.date}T${w.end}`,
            })),
        }));
        form.put(route('work-hours.update', workHour.id));
    };

    const workTypes = [
        { label: 'Tracker', value: 'tracker' },
        { label: 'Manual Time', value: 'manual' },
        { label: 'Fixed Client', value: 'fixed' },
        { label: 'Outside of Upwork', value: 'outside_of_upwork' },
        { label: 'Office Work', value: 'office_work' },
        { label: 'Test Task', value: 'test_task' },
        { label: 'Upwork Bidding', value: 'upwork_bidding' },
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

    // Set initial search values
    React.useEffect(() => {
        if (workHour.client && form.data.clientSearch === '') {
            form.setData(prev => ({
                ...prev,
                clientSearch: workHour.client.name
            }));
        }
        if (workHour.tracker && form.data.trackerSearch === '') {
            form.setData(prev => ({
                ...prev,
                trackerSearch: workHour.tracker
            }));
        }
    }, [workHour]);

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Edit Work Entry" />
            
            <PageShell width="max-w-6xl">
                <PageHeader
                    eyebrow="Work diary"
                    title="Edit Work Entry"
                    description="Update the recorded time and its client or profile assignment."
                />

                    {/* Form Section */}
                    <div className="overflow-visible rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="p-5 sm:p-6">
                            <form onSubmit={handleSubmit}>
                                <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                                    <div className="mb-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg">
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900">Work Type</h3>
                                        </div>
                                        <p className="text-sm text-slate-700 mb-4 pl-14">
                                            <span className="font-semibold text-emerald-700">Required fields:</span> {' '}
                                            {form.data.work_type === 'tracker' && "Profile Name, Client Name, Description, Time windows, Tracking Date"}
                                            {form.data.work_type === 'manual' && "Profile Name, Client Name, Description, Time windows, Tracking Date"}
                                            {form.data.work_type === 'fixed' && "Profile Name, Client Name, Description, Time windows, Tracking Date"}
                                            {form.data.work_type === 'outside_of_upwork' && "Client Name, Description, Time windows, Tracking Date"}
                                            {form.data.work_type === 'office_work' && "Description, Time windows, Tracking Date"}
                                            {form.data.work_type === 'test_task' && "Description, Time windows, Tracking Date"}
                                            {form.data.work_type === 'upwork_bidding' && "Description, Time windows, Tracking Date"}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {workTypes.map((type) => (
                                            <button
                                                key={type.value}
                                                type="button"
                                                onClick={() => handleWorkTypeChange(type.value)}
                                                className={`min-h-11 rounded-lg p-2.5 text-sm font-semibold transition ${
                                                    form.data.work_type === type.value
                                                        ? 'bg-emerald-600 text-white shadow-sm'
                                                        : 'border border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50'
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
                                            <label htmlFor="tracker" className="block text-sm font-medium text-slate-900 mb-2">
                                                Profile Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                ref={trackerRef}
                                                type="text"
                                                placeholder="Search or select profile..."
                                                className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-slate-900 placeholder-slate-400 ${
                                                    trackerValidationError ? 'border-red-400' : 'border-slate-300'
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
                                                <div className="mt-1 text-sm text-red-600">
                                                    {trackerValidationError}
                                                </div>
                                            )}
                                            {showTrackerOptions && (
                                                <div 
                                                    ref={trackerDropdownRef}
                                                    className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl"
                                                >
                                                    <div className="p-2">
                                                        {trackers.filter(tracker => 
                                                            !form.data.trackerSearch || tracker.toLowerCase().includes(form.data.trackerSearch.toLowerCase())
                                                        ).map((tracker, index) => (
                                                            <button
                                                                key={index}
                                                                type="button"
                                                                className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg text-slate-900 transition-all"
                                                                onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking
                                                                onClick={() => handleTrackerSelect(tracker)}
                                                            >
                                                                {tracker}
                                                            </button>
                                                        ))}
                                                        {trackers.filter(tracker => 
                                                            !form.data.trackerSearch || tracker.toLowerCase().includes(form.data.trackerSearch.toLowerCase())
                                                        ).length === 0 && form.data.trackerSearch && (
                                                            <div className="px-3 py-2 text-slate-500 text-sm">
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
                                            <label htmlFor="client" className="block text-sm font-medium text-slate-900 mb-2">
                                                Client Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                ref={clientRef}
                                                type="text"
                                                placeholder="Search or select client..."
                                                className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-slate-900 placeholder-slate-400 ${
                                                    clientValidationError ? 'border-red-400' : 'border-slate-300'
                                                }`}
                                                value={form.data.clientSearch}
                                                onChange={handleClientSearchChange}
                                                onFocus={handleClientFocus}
                                                onBlur={handleClientBlur}
                                                required={isClientRequired()}
                                            />
                                            {clientValidationError && (
                                                <div className="mt-1 text-sm text-red-600">
                                                    {clientValidationError}
                                                </div>
                                            )}
                                            {showClientOptions && (
                                                <div 
                                                    ref={clientDropdownRef}
                                                    className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl"
                                                >
                                                    <div className="p-2">
                                                        {clients.filter(client => {
                                                            const label = client.name;
                                                            return !form.data.clientSearch || label.toLowerCase().includes(form.data.clientSearch.toLowerCase());
                                                        }).map(client => (
                                                            <button
                                                                key={client.id}
                                                                type="button"
                                                                className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg text-slate-900 transition-all"
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
                                                            <div className="px-3 py-2 text-slate-500 text-sm">
                                                                No clients found. Please select from available options.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Date */}
                                <div className="mb-6">
                                    <label htmlFor="date" className="block text-sm font-medium text-slate-900 mb-2">
                                        Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        id="date"
                                        value={form.data.date}
                                        onChange={(e) => form.setData('date', e.target.value)}
                                        className="w-full md:w-1/3 px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:border-emerald-500 focus:ring-emerald-200 text-slate-900"
                                        required
                                    />
                                </div>

                                {isTracked ? (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                            {/* Hours (locked) */}
                                            <div>
                                                <label htmlFor="hours" className="block text-sm font-medium text-slate-900 mb-2">
                                                    Hours
                                                </label>
                                                <input
                                                    type="number"
                                                    id="hours"
                                                    value={form.data.hours}
                                                    disabled
                                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-slate-100 cursor-not-allowed text-slate-500"
                                                />
                                            </div>
                                            {/* Minutes (locked) */}
                                            <div>
                                                <label htmlFor="minutes" className="block text-sm font-medium text-slate-900 mb-2">
                                                    Minutes
                                                </label>
                                                <input
                                                    type="number"
                                                    id="minutes"
                                                    value={form.data.minutes}
                                                    disabled
                                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-slate-100 cursor-not-allowed text-slate-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="-mt-4 mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                            <p className="font-semibold">🔒 Tracked time can't be edited here.</p>
                                            <p className="mt-1 text-amber-700">
                                                These hours always reflect what the desktop tracker measured. To
                                                correct them (e.g. time tracked on the wrong client, or time you
                                                didn't actually work), open the <span className="font-semibold">Timeline</span> for
                                                this day and <span className="font-semibold">delete the relevant screenshots</span> —
                                                that removes that slice of tracked time everywhere. You can still
                                                edit the description, client, and work type here.
                                            </p>
                                            <Link
                                                href={route('timeline.index', { user_id: workHour.user_id, date: workHour.date })}
                                                className="mt-1.5 inline-block font-semibold text-amber-900 underline"
                                            >
                                                Open this day in the Timeline →
                                            </Link>
                                        </div>
                                    </>
                                ) : (
                                    /* Time windows + open-gap picker (manual entries) */
                                    <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-slate-900">
                                                Time windows <span className="text-red-500">*</span>
                                            </h3>
                                            <span className={`text-sm font-semibold ${totalWindowMinutes > 0 ? 'text-slate-700' : 'text-red-600'}`}>
                                                Total: {fmtMins(totalWindowMinutes)}
                                            </span>
                                        </div>
                                        <p className="mb-3 text-xs text-slate-600">
                                            Edit the exact clock windows worked. Pick from the open gaps below, or adjust the
                                            windows manually. Windows can&apos;t overlap tracked time, breaks, or another entry,
                                            and must fall within in-office hours.
                                        </p>

                                        {/* Open gaps */}
                                        <div className="mb-4">
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Open gaps for {form.data.date}
                                            </p>
                                            {gapsLoading ? (
                                                <p className="text-xs text-slate-500">Loading in-office time…</p>
                                            ) : gapsError ? (
                                                <p className="text-xs text-red-600">{gapsError}</p>
                                            ) : gaps.length === 0 ? (
                                                <p className="text-xs text-slate-500">No additional open gaps on this day.</p>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {gaps.map((g, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => addWindow((g.start_at || '').slice(11, 19), (g.end_at || '').slice(11, 19))}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                                                            title="Add this gap as a time window"
                                                        >
                                                            {to12(g.start)} – {to12(g.end)}
                                                            <span className="text-emerald-600">({fmtMins(g.minutes)}) · fill</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Window rows */}
                                        <div className="space-y-2">
                                            {(form.data.windows || []).length === 0 && (
                                                <p className="text-xs text-slate-500">No windows yet.</p>
                                            )}
                                            {(form.data.windows || []).map((w, i) => {
                                                const mins = minutesBetween(w.start, w.end);
                                                const invalid = w.start && w.end && mins <= 0;
                                                const serverError = form.errors[`windows.${i}.start_at`] || form.errors[`windows.${i}.end_at`];
                                                return (
                                                    <div key={i}>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <input
                                                                type="time"
                                                                value={w.start ? w.start.slice(0, 5) : ''}
                                                                onChange={(e) => updateWindow(i, 'start', e.target.value ? `${e.target.value}:00` : '')}
                                                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                                            />
                                                            <span className="text-slate-400">→</span>
                                                            <input
                                                                type="time"
                                                                value={w.end ? w.end.slice(0, 5) : ''}
                                                                onChange={(e) => updateWindow(i, 'end', e.target.value ? `${e.target.value}:00` : '')}
                                                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                                            />
                                                            <span className={`text-xs ${invalid ? 'text-red-600' : 'text-slate-500'}`}>
                                                                {w.start && w.end ? (invalid ? 'ends before it starts' : fmtMins(Math.max(0, mins))) : ''}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeWindow(i)}
                                                                className="ml-auto rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                        {serverError && <p className="mt-1 text-xs text-red-600">{serverError}</p>}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => addWindow()}
                                            className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                        >
                                            + Add window
                                        </button>
                                    </div>
                                )}

                                {/* Description */}
                                <div className="mb-6">
                                    <label htmlFor="description" className="block text-sm font-medium text-slate-900 mb-2">
                                        Description <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        id="description"
                                        rows={4}
                                        value={form.data.description}
                                        onChange={(e) => form.setData('description', e.target.value)}
                                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-slate-900 placeholder-slate-400"
                                        placeholder="Describe the work you did..."
                                        required
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Link
                                        href={route('work-hours.index')}
                                        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        Cancel
                                    </Link>
                                    <button
                                        type="submit"
                                        disabled={form.processing}
                                        className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {form.processing ? (
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
                                                Update Entry
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
            </PageShell>
        </AuthenticatedLayout>
    );
}
