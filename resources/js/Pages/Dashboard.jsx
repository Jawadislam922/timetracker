import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { 
    Clock, 
    LogIn, 
    LogOut, 
    Coffee,
    User, 
    Calendar, 
    Download, 
    CheckCircle,
    Timer,
    Activity,
    BarChart3,
    TrendingUp,
    PlayCircle,
    PauseCircle,
    Square,
    RotateCcw,
    Sparkles
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
    showTimeActionSuccess, 
    showError, 
    showExportSuccess, 
    showLoading,
    showWorkReminder,
    showActionBlocked 
} from '@/Utils/notifications';
import { 
    formatHours, 
    getTimeBasedGreeting 
} from '@/Utils/timeUtils';

export default function Dashboard({ auth }) {
    const [entries, setEntries] = useState([]);
    const [employeesData, setEmployeesData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [todayStats, setTodayStats] = useState({
        totalHours: 0,
        totalBreakTime: 0,
        sessionsCount: 0,
        lastAction: null
    });

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch today's entries and employee summary on component mount
    useEffect(() => {
        fetchTodaysEntries();
        fetchEmployeeSummary();
    }, []);

    const fetchTodaysEntries = async () => {
        try {
            const response = await axios.get('/time-entries/today');
            setEntries(response.data.entries || []);
            calculateTodayStats(response.data.entries || []);
        } catch (error) {
            console.error('Error fetching entries:', error);
            showError('Unable to load your time entries. Please refresh the page.');
        }
    };

    const fetchEmployeeSummary = async () => {
        try {
            const response = await axios.get('/time-entries/today-summary');
            setEmployeesData(response.data.employees || []);
        } catch (error) {
            console.error('Error fetching employee summary:', error);
            showError('Unable to load employee summary.');
        }
    };

    const calculateTodayStats = (entriesData) => {
        if (!entriesData || entriesData.length === 0) {
            setTodayStats({
                totalHours: 0,
                totalBreakTime: 0,
                sessionsCount: 0,
                lastAction: null
            });
            return;
        }

        let totalMinutes = 0;
        let breakMinutes = 0;
        let sessions = 0;
        let currentSessionStart = null;
        let currentBreakStart = null;
        
        // Sort entries by time (oldest first)
        const sortedEntries = [...entriesData].sort((a, b) => 
            new Date(a.action_timestamp) - new Date(b.action_timestamp)
        );

        for (let entry of sortedEntries) {
            const entryTime = new Date(entry.action_timestamp);
            
            switch (entry.action_type) {
                case 'clock_in':
                    currentSessionStart = entryTime;
                    sessions++;
                    break;
                case 'clock_out':
                    if (currentSessionStart) {
                        totalMinutes += (entryTime - currentSessionStart) / (1000 * 60);
                        currentSessionStart = null;
                    }
                    break;
                case 'break_start':
                    currentBreakStart = entryTime;
                    break;
                case 'break_end':
                    if (currentBreakStart) {
                        breakMinutes += (entryTime - currentBreakStart) / (1000 * 60);
                        currentBreakStart = null;
                    }
                    break;
            }
        }

        // If still clocked in, add time until now
        if (currentSessionStart) {
            totalMinutes += (new Date() - currentSessionStart) / (1000 * 60);
        }

        setTodayStats({
            totalHours: Math.max(0, (totalMinutes - breakMinutes) / 60),
            totalBreakTime: breakMinutes / 60,
            sessionsCount: sessions,
            lastAction: entriesData[0]?.action_type || null
        });
    };

    const handleBlockedAction = (actionType) => {
        let reason = '';
        switch (actionType) {
            case 'clock_in':
                reason = todayStats.lastAction === 'clock_in' 
                    ? 'You are already clocked in and working.' 
                    : todayStats.lastAction === 'break_start'
                    ? 'Please end your break first.'
                    : todayStats.lastAction === 'break_end'
                    ? 'You are still in an active work session. Clock out to end your day.'
                    : 'Please clock out first.';
                break;
            case 'clock_out':
                reason = todayStats.lastAction === 'break_start'
                    ? 'Please end your break first before clocking out.'
                    : !todayStats.lastAction || todayStats.lastAction === 'clock_out'
                    ? 'Please clock in first to start tracking your time.'
                    : 'Clock out is not available right now.';
                break;
            case 'break_start':
                reason = todayStats.lastAction === 'clock_out' 
                    ? 'Please clock in first to start your work session.' 
                    : todayStats.lastAction === 'break_start'
                    ? 'You are already on a break.'
                    : 'Please clock in first.';
                break;
            case 'break_end':
                reason = 'Please start a break first.';
                break;
            default:
                reason = 'This action is not available right now.';
        }
        showActionBlocked(actionType, reason);
    };

    const addEntry = async (actionType) => {
        // Check if action is blocked
        if (isButtonDisabled(actionType)) {
            handleBlockedAction(actionType);
            return;
        }

        const loadingToast = showLoading('Recording your time entry...');
        setLoading(true);
        
        try {
            const response = await axios.post('/time-entries', {
                action_type: actionType
            });
            
            // Add new entry to the beginning of the list
            const newEntries = [response.data.entry, ...entries];
            setEntries(newEntries);
            calculateTodayStats(newEntries);
            
            // Refresh employee summary to update stats
            fetchEmployeeSummary();
            
            // Dismiss loading toast and show success
            toast.dismiss(loadingToast);
            showTimeActionSuccess(actionType);
            
            // Show work reminders based on patterns
            setTimeout(() => {
                if (actionType === 'clock_in' && newEntries.length > 0) {
                    const lastBreak = newEntries.find(e => e.action_type === 'break_start');
                    if (!lastBreak) {
                        setTimeout(() => showWorkReminder('break'), 30000); // Remind about breaks after 30 seconds for demo
                    }
                }
            }, 2000);
            
        } catch (error) {
            console.error('Error adding entry:', error);
            toast.dismiss(loadingToast);
            showError('Failed to record time entry. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = async () => {
        const loadingToast = showLoading('Preparing your time report...');
        
        try {
            const response = await axios.get('/time-entries/export', {
                responseType: 'blob'
            });
            
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sparking-asia-timesheet-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            toast.dismiss(loadingToast);
            showExportSuccess();
        } catch (error) {
            console.error('Error exporting CSV:', error);
            toast.dismiss(loadingToast);
            showError('Failed to export your timesheet. Please try again.');
        }
    };

    const getActionColor = (actionType) => {
        switch(actionType) {
            case 'clock_in': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'clock_out': return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'break_start': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'break_end': return 'bg-blue-50 text-blue-700 border-blue-200';
            default: return 'bg-gray-50 text-gray-700 border-gray-200';
        }
    };

    const getActionIcon = (actionType) => {
        switch(actionType) {
            case 'clock_in': return <PlayCircle className="w-4 h-4" />;
            case 'clock_out': return <Square className="w-4 h-4" />;
            case 'break_start': return <PauseCircle className="w-4 h-4" />;
            case 'break_end': return <RotateCcw className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4" />;
        }
    };

    const getActionLabel = (actionType) => {
        switch(actionType) {
            case 'clock_in': return 'Clock In';
            case 'clock_out': return 'Clock Out';
            case 'break_start': return 'Break Start';
            case 'break_end': return 'Break End';
            default: return actionType;
        }
    };

    const getNextRecommendedAction = () => {
        if (!todayStats.lastAction) return 'clock_in';
        
        switch (todayStats.lastAction) {
            case 'clock_out':
                return 'clock_in';
            case 'clock_in':
                return 'break_start'; // After working for a while, suggest a break
            case 'break_start':
                return 'break_end';
            case 'break_end':
                return 'clock_out'; // After break, suggest ending the work session
            default:
                return 'clock_in';
        }
    };

    // Function to check if a button should be disabled
    // Improved Workflow Logic:
    // 1. Start: Only Clock In available
    // 2. After Clock In: Clock Out and Start Break available (working session active)
    // 3. After Start Break: Only End Break available (on break)
    // 4. After End Break: Clock Out and Start Break available (back to working session)
    // 5. After Clock Out: Only Clock In available (session ended)
    const isButtonDisabled = (actionType) => {
        if (loading) return true;
        if (!todayStats.lastAction) {
            // If no previous action, only clock_in should be enabled
            return actionType !== 'clock_in';
        }
        
        switch (todayStats.lastAction) {
            case 'clock_in':
                // After clock in, disable clock_in, enable clock_out and break_start
                return actionType === 'clock_in' || actionType === 'break_end';
            case 'clock_out':
                // After clock out, disable clock_out and break actions, enable only clock_in
                return actionType === 'clock_out' || actionType === 'break_start' || actionType === 'break_end';
            case 'break_start':
                // After break start, disable clock_in, clock_out, and break_start, enable only break_end
                // This ensures employees must end their break before they can clock out
                return actionType === 'clock_in' || actionType === 'clock_out' || actionType === 'break_start';
            case 'break_end':
                // After break end, employee is back to working state
                // Disable clock_in and break_end, enable only clock_out and break_start
                return actionType === 'clock_in' || actionType === 'break_end';
            default:
                return false;
        }
    };

    // Function to get button opacity based on state
    const getButtonOpacity = (actionType) => {
        if (isButtonDisabled(actionType)) {
            return 'opacity-40 cursor-not-allowed';
        }
        return 'opacity-100 cursor-pointer';
    };



    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Dashboard - Time Tracker" />

            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
                {/* Main Content - Full Width with Side Padding */}
                <div className="px-6 lg:px-12 xl:px-16 py-8 space-y-8">
                    
                    {/* Hero Section with Real-time Clock */}
                    <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 rounded-3xl shadow-2xl">
                        <div className="absolute inset-0 bg-black/10"></div>
                        <div className="relative px-8 py-12 text-white">
                            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                                <div className="text-center lg:text-left">
                                    <h1 className="text-4xl lg:text-5xl font-bold mb-4 leading-tight">
                                        {getTimeBasedGreeting()} {auth.user.name.split(' ')[0]}!
                                    </h1>
                                    <p className="text-xl text-blue-100 mb-6 font-medium">
                                        Ready to make today productive? Let's track your time efficiently.
                                    </p>
                                    {todayStats.lastAction && (
                                        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium">
                                            {getActionIcon(todayStats.lastAction)}
                                            <span>Last action: {getActionLabel(todayStats.lastAction)}</span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Real-time Clock */}
                                <div className="text-center bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                                    <div className="text-5xl lg:text-6xl font-mono font-bold mb-2">
                                        {currentTime.toLocaleTimeString('en-US', { 
                                            timeZone: 'Asia/Karachi',
                                            hour12: true,
                                            hour: 'numeric',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                    <div className="text-lg text-blue-100 font-medium">
                                        {currentTime.toLocaleDateString('en-US', { 
                                            timeZone: 'Asia/Karachi',
                                            weekday: 'long', 
                                            month: 'short', 
                                            day: 'numeric' 
                                        })}
                                    </div>
                                    <div className="text-sm text-blue-200 mt-1">Pakistan Time (PKT)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 border border-slate-100 hover:shadow-xl transition-all duration-300">
                            <div className="flex items-center justify-between mb-3 md:mb-4">
                                <div className="p-2 md:p-3 bg-emerald-100 rounded-xl">
                                    <Timer className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
                                </div>
                                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
                            </div>
                            <div className="text-xl md:text-2xl font-bold text-slate-800 mb-1">
                                {formatHours(todayStats.totalHours)}
                            </div>
                            <div className="text-xs md:text-sm text-slate-600 font-medium">
                                Hours Worked Today
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 border border-slate-100 hover:shadow-xl transition-all duration-300">
                            <div className="flex items-center justify-between mb-3 md:mb-4">
                                <div className="p-2 md:p-3 bg-amber-100 rounded-xl">
                                    <Coffee className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                                </div>
                                <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
                            </div>
                            <div className="text-xl md:text-2xl font-bold text-slate-800 mb-1">
                                {formatHours(todayStats.totalBreakTime)}
                            </div>
                            <div className="text-xs md:text-sm text-slate-600 font-medium">
                                Break Time
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 border border-slate-100 hover:shadow-xl transition-all duration-300">
                            <div className="flex items-center justify-between mb-3 md:mb-4">
                                <div className="p-2 md:p-3 bg-blue-100 rounded-xl">
                                    <Activity className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                </div>
                                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                            </div>
                            <div className="text-xl md:text-2xl font-bold text-slate-800 mb-1">
                                {todayStats.sessionsCount}
                            </div>
                            <div className="text-xs md:text-sm text-slate-600 font-medium">
                                Work Sessions
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 border border-slate-100 hover:shadow-xl transition-all duration-300">
                            <div className="flex items-center justify-between mb-3 md:mb-4">
                                <div className="p-2 md:p-3 bg-purple-100 rounded-xl">
                                    <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                                </div>
                                <Calendar className="w-4 h-4 md:w-5 md:h-5 text-purple-500" />
                            </div>
                            <div className="text-xl md:text-2xl font-bold text-slate-800 mb-1">
                                {entries.length}
                            </div>
                            <div className="text-xs md:text-sm text-slate-600 font-medium">
                                Total Entries
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions Section */}
                    <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 border border-slate-100">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl shadow-lg">
                                    <Clock className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold text-slate-800">Time Tracking</h2>
                                    <p className="text-sm md:text-base text-slate-600">Track your work time with one click</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                {/* Current Status Indicator */}
                                <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl px-4 py-2 text-sm font-medium text-blue-700 border border-blue-200">
                                    <div className={`w-2 h-2 rounded-full ${
                                        !todayStats.lastAction ? 'bg-gray-400' :
                                        todayStats.lastAction === 'clock_in' ? 'bg-green-500 animate-pulse' :
                                        todayStats.lastAction === 'break_start' ? 'bg-yellow-500 animate-pulse' :
                                        'bg-red-400'
                                    }`}></div>
                                    <span className="hidden sm:inline">Status: </span>
                                    <span className="font-semibold">
                                        {!todayStats.lastAction ? 'Not Started' :
                                         todayStats.lastAction === 'clock_in' ? 'Working' :
                                         todayStats.lastAction === 'clock_out' ? 'Clocked Out' :
                                         todayStats.lastAction === 'break_start' ? 'On Break' :
                                         'Working'}
                                    </span>
                                </div>
                                
                                {/* Recommended Action */}
                                {getNextRecommendedAction() && (
                                    <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl px-4 py-2 text-sm font-medium text-green-700 border border-green-200">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="hidden sm:inline">Next: </span>
                                        <span>{getActionLabel(getNextRecommendedAction())}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            <button
                                onClick={() => !isButtonDisabled('clock_in') && addEntry('clock_in')}
                                disabled={isButtonDisabled('clock_in')}
                                className={`group flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl transition-all duration-300 shadow-lg border-2 ${
                                    isButtonDisabled('clock_in')
                                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                        : getNextRecommendedAction() === 'clock_in' 
                                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-400 shadow-green-500/25 hover:shadow-xl transform hover:scale-105' 
                                            : 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300 hover:shadow-xl transform hover:scale-105'
                                } ${getButtonOpacity('clock_in')}`}
                            >
                                <div className={`p-2 md:p-3 rounded-xl mb-2 md:mb-3 transition-all ${
                                    isButtonDisabled('clock_in')
                                        ? 'bg-gray-200'
                                        : getNextRecommendedAction() === 'clock_in' 
                                            ? 'bg-white/20' 
                                            : 'bg-green-100 group-hover:bg-green-200'
                                }`}>
                                    <PlayCircle className="w-6 h-6 md:w-8 md:h-8" />
                                </div>
                                <span className="font-semibold text-sm md:text-lg">Clock In</span>
                                <span className="text-xs md:text-sm opacity-75 mt-1 hidden sm:block">
                                    {isButtonDisabled('clock_in') ? 
                                        (todayStats.lastAction === 'break_start' ? 'End break first' : 
                                         todayStats.lastAction === 'break_end' ? 'Still working' : 
                                         'Already working') 
                                        : 'Start your day'}
                                </span>
                            </button>
                            
                            <button
                                onClick={() => !isButtonDisabled('clock_out') && addEntry('clock_out')}
                                disabled={isButtonDisabled('clock_out')}
                                className={`group flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl transition-all duration-300 shadow-lg border-2 ${
                                    isButtonDisabled('clock_out')
                                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                        : getNextRecommendedAction() === 'clock_out' 
                                            ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white border-red-400 shadow-red-500/25 hover:shadow-xl transform hover:scale-105' 
                                            : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300 hover:shadow-xl transform hover:scale-105'
                                } ${getButtonOpacity('clock_out')}`}
                            >
                                <div className={`p-2 md:p-3 rounded-xl mb-2 md:mb-3 transition-all ${
                                    isButtonDisabled('clock_out')
                                        ? 'bg-gray-200'
                                        : getNextRecommendedAction() === 'clock_out' 
                                            ? 'bg-white/20' 
                                            : 'bg-red-100 group-hover:bg-red-200'
                                }`}>
                                    <Square className="w-6 h-6 md:w-8 md:h-8" />
                                </div>
                                <span className="font-semibold text-sm md:text-lg">Clock Out</span>
                                <span className="text-xs md:text-sm opacity-75 mt-1 hidden sm:block">
                                    {isButtonDisabled('clock_out') ? 
                                        (todayStats.lastAction === 'break_start' ? 'End break first' : 'Clock in first') 
                                        : 'End your day'}
                                </span>
                            </button>
                            
                            <button
                                onClick={() => !isButtonDisabled('break_start') && addEntry('break_start')}
                                disabled={isButtonDisabled('break_start')}
                                className={`group flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl transition-all duration-300 shadow-lg border-2 ${
                                    isButtonDisabled('break_start')
                                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                        : getNextRecommendedAction() === 'break_start' 
                                            ? 'bg-gradient-to-br from-amber-500 to-yellow-600 text-white border-amber-400 shadow-amber-500/25 hover:shadow-xl transform hover:scale-105' 
                                            : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 hover:border-amber-300 hover:shadow-xl transform hover:scale-105'
                                } ${getButtonOpacity('break_start')}`}
                            >
                                <div className={`p-2 md:p-3 rounded-xl mb-2 md:mb-3 transition-all ${
                                    isButtonDisabled('break_start')
                                        ? 'bg-gray-200'
                                        : getNextRecommendedAction() === 'break_start' 
                                            ? 'bg-white/20' 
                                            : 'bg-amber-100 group-hover:bg-amber-200'
                                }`}>
                                    <PauseCircle className="w-6 h-6 md:w-8 md:h-8" />
                                </div>
                                <span className="font-semibold text-sm md:text-lg">Start Break</span>
                                <span className="text-xs md:text-sm opacity-75 mt-1 hidden sm:block">
                                    {isButtonDisabled('break_start') ? 'Not available' : 'Take a pause'}
                                </span>
                            </button>
                            
                            <button
                                onClick={() => !isButtonDisabled('break_end') && addEntry('break_end')}
                                disabled={isButtonDisabled('break_end')}
                                className={`group flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl transition-all duration-300 shadow-lg border-2 ${
                                    isButtonDisabled('break_end')
                                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                        : getNextRecommendedAction() === 'break_end' 
                                            ? 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-blue-400 shadow-blue-500/25 hover:shadow-xl transform hover:scale-105' 
                                            : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300 hover:shadow-xl transform hover:scale-105'
                                } ${getButtonOpacity('break_end')}`}
                            >
                                <div className={`p-2 md:p-3 rounded-xl mb-2 md:mb-3 transition-all ${
                                    isButtonDisabled('break_end')
                                        ? 'bg-gray-200'
                                        : getNextRecommendedAction() === 'break_end' 
                                            ? 'bg-white/20' 
                                            : 'bg-blue-100 group-hover:bg-blue-200'
                                }`}>
                                    <RotateCcw className="w-6 h-6 md:w-8 md:h-8" />
                                </div>
                                <span className="font-semibold text-sm md:text-lg">End Break</span>
                                <span className="text-xs md:text-sm opacity-75 mt-1 hidden sm:block">
                                    {isButtonDisabled('break_end') ? 'Start break first' : 'Back to work'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Employee Summary */}
                    <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 border border-slate-100">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 md:mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-lg">
                                    <User className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold text-slate-800">
                                        {auth.user.role === 'admin' ? 'All Employees Today' : 'Your Work Summary'}
                                    </h2>
                                    <p className="text-sm md:text-base text-slate-600">
                                        {auth.user.role === 'admin' 
                                            ? 'Overview of all employee activity and hours' 
                                            : 'Your work hours and break time today'}
                                    </p>
                                </div>
                            </div>
                            {employeesData.length > 0 && (
                                <button
                                    onClick={downloadCSV}
                                    className="flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-sm md:text-base font-medium transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Export Data</span>
                                    <span className="sm:hidden">Export</span>
                                </button>
                            )}
                        </div>

                        {employeesData.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <User className="w-12 h-12 text-slate-400" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-700 mb-2">No activity yet</h3>
                                <p className="text-slate-500 mb-6">
                                    {auth.user.role === 'admin' 
                                        ? 'No employees have started tracking time today' 
                                        : 'Start your day by clocking in to see your summary'}
                                </p>
                                {auth.user.role !== 'admin' && (
                                    <button
                                        onClick={() => addEntry('clock_in')}
                                        disabled={loading}
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
                                    >
                                        <PlayCircle className="w-5 h-5" />
                                        Get Started
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b-2 border-slate-200">
                                            <th className="text-left py-4 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Employee</th>
                                            <th className="text-center py-4 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                            <th className="text-center py-4 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider bg-emerald-50">Today<br/>Work</th>
                                            <th className="text-center py-4 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider bg-amber-50">Today<br/>Break</th>
                                            <th className="text-center py-4 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider bg-purple-50">Week<br/>Work</th>
                                            <th className="text-center py-4 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider bg-orange-50">Week<br/>Break</th>
                                            <th className="text-center py-4 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider bg-indigo-50">Month<br/>Work</th>
                                            <th className="text-center py-4 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider bg-rose-50">Month<br/>Break</th>
                                            <th className="text-center py-4 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {employeesData.map((employee) => (
                                            <tr key={employee.user_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative flex-shrink-0">
                                                            {employee.avatar ? (
                                                                <img 
                                                                    src={employee.avatar} 
                                                                    alt={employee.user_name}
                                                                    className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"
                                                                />
                                                            ) : (
                                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow">
                                                                    <span className="text-white font-bold text-sm">
                                                                        {employee.user_name.charAt(0).toUpperCase()}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                                                employee.current_status === 'Working' ? 'bg-green-500' :
                                                                employee.current_status === 'On Break' ? 'bg-yellow-500' :
                                                                employee.current_status === 'Clocked Out' ? 'bg-red-500' :
                                                                'bg-gray-400'
                                                            }`}></div>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-semibold text-slate-800 text-sm truncate">
                                                                {employee.user_name}
                                                            </div>
                                                            <div className="text-xs text-slate-500 truncate">
                                                                {employee.designation}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                                                            employee.current_status === 'Working' ? 'bg-green-100 text-green-700' :
                                                            employee.current_status === 'On Break' ? 'bg-yellow-100 text-yellow-700' :
                                                            employee.current_status === 'Clocked Out' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {employee.current_status}
                                                        </span>
                                                        {employee.last_action_time && (
                                                            <span className="text-xs text-slate-400">
                                                                {employee.last_action_time}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 text-center bg-emerald-50/50">
                                                    <div className="font-bold text-emerald-700">
                                                        {formatHours(employee.total_work_hours)}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 text-center bg-amber-50/50">
                                                    <div className="font-bold text-amber-700">
                                                        {formatHours(employee.total_break_hours)}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 text-center bg-purple-50/50">
                                                    <div className="font-bold text-purple-700">
                                                        {formatHours(employee.weekly_work_hours || 0)}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 text-center bg-orange-50/50">
                                                    <div className="font-bold text-orange-700">
                                                        {formatHours(employee.weekly_break_hours || 0)}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 text-center bg-indigo-50/50">
                                                    <div className="font-bold text-indigo-700">
                                                        {formatHours(employee.monthly_work_hours || 0)}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 text-center bg-rose-50/50">
                                                    <div className="font-bold text-rose-700">
                                                        {formatHours(employee.monthly_break_hours || 0)}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <div className="p-1.5 bg-blue-100 rounded-lg">
                                                            <Activity className="w-3.5 h-3.5 text-blue-600" />
                                                        </div>
                                                        <span className="font-semibold text-slate-700 text-sm">
                                                            {employee.total_entries}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}