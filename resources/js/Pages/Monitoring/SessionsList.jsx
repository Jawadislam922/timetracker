import React from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';

function fmtDuration(seconds) {
    if (!seconds) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

export default function SessionsList({ auth, sessions, users = [], filters = {}, permissions = {} }) {
    const onUserChange = (e) => {
        const userId = e.target.value;
        router.get(route('monitoring.sessions'), userId ? { user_id: userId } : {}, { preserveState: true });
    };

    const rows = sessions?.data || [];

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">Tracking Sessions</h2>}
        >
            <Head title="Tracking Sessions" />

            <div className="py-8">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-4">
                    {users.length > 0 && (
                        <div className="bg-white p-4 rounded-lg shadow flex items-center gap-3">
                            <label className="text-sm font-medium text-gray-700">Filter user:</label>
                            <select
                                value={filters?.user_id || ''}
                                onChange={onUserChange}
                                className="border-gray-300 rounded-md shadow-sm"
                            >
                                <option value="">All users</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="bg-white shadow-sm sm:rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stopped</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                            No tracking sessions yet. Start the desktop tracker to begin recording.
                                        </td>
                                    </tr>
                                )}
                                {rows.map((s) => (
                                    <tr key={s.id}>
                                        <td className="px-4 py-3 text-sm">{s.user?.name || `User #${s.user_id}`}</td>
                                        <td className="px-4 py-3 text-sm">{s.client?.name || '—'}</td>
                                        <td className="px-4 py-3 text-sm">{fmtDate(s.started_at)}</td>
                                        <td className="px-4 py-3 text-sm">{fmtDate(s.stopped_at)}</td>
                                        <td className="px-4 py-3 text-sm">{fmtDuration(s.total_seconds)}</td>
                                        <td className="px-4 py-3 text-sm">{s.activity_percent ?? 0}%</td>
                                        <td className="px-4 py-3 text-sm">
                                            <span
                                                className={
                                                    s.status === 'active'
                                                        ? 'inline-flex px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800'
                                                        : s.status === 'abandoned'
                                                            ? 'inline-flex px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800'
                                                            : 'inline-flex px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800'
                                                }
                                            >
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <Link
                                                href={route('monitoring.sessions.show', s.id)}
                                                className="text-indigo-600 hover:text-indigo-900"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
