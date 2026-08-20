import React, { useState, useMemo } from 'react';
import AuthenticatedLayout from '../../Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import PageHeader from '../../Components/Layout/PageHeader';
import PageShell from '../../Components/Layout/PageShell';

const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Inactive' },
];

const currentListUrl = () => (
    typeof window === 'undefined' ? '/upwork-profiles' : `${window.location.pathname}${window.location.search}`
);

export default function Index({ auth, profiles, status = 'all' }) {
    const canManage = auth.user?.is_super_admin || auth.user?.permissions?.includes('profiles.manage');
    const { delete: destroy } = useForm();

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [selectAllMatching, setSelectAllMatching] = useState(false);

    const pageIds = useMemo(() => profiles.map((p) => p.id), [profiles]);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

    const clearSelection = () => {
        setSelectedIds(new Set());
        setSelectAllMatching(false);
    };

    const handleDelete = (profile) => {
        if (confirm(`Are you sure you want to delete the profile "${profile.name}"? This action cannot be undone.`)) {
            destroy(route('upwork-profiles.destroy', profile.id));
        }
    };

    const handleStatusFilter = (value) => {
        clearSelection();
        router.get(route('upwork-profiles.index'), { status: value }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const toggleProfileStatus = (profile) => {
        router.patch(route('upwork-profiles.set-status', profile.id), {
            is_active: !profile.is_active,
        }, {
            preserveScroll: true,
            preserveState: false,
        });
    };

    const toggleRow = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
        setSelectAllMatching(false);
    };

    const toggleSelectAllOnPage = () => {
        const next = new Set(selectedIds);
        if (allPageSelected) {
            pageIds.forEach((id) => next.delete(id));
            setSelectAllMatching(false);
        } else {
            pageIds.forEach((id) => next.add(id));
        }
        setSelectedIds(next);
    };

    const selectionCount = selectAllMatching ? profiles.length : selectedIds.size;

    const runBulk = (isActive) => {
        if (selectionCount === 0) return;
        const data = selectAllMatching
            ? { is_active: isActive, all_matching: true, status }
            : { is_active: isActive, ids: Array.from(selectedIds) };

        router.post(route('upwork-profiles.bulk-status'), data, {
            preserveScroll: true,
            preserveState: false,
            onSuccess: () => clearSelection(),
        });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Upwork Profiles" />
            <PageShell>
                <PageHeader
                    title="Upwork Profiles"
                    description="Manage profile names used for client assignments and time tracking."
                    actions={canManage && (
                                <Link
                                    href={`${route('upwork-profiles.create')}?return_to=${encodeURIComponent(currentListUrl())}`}
                                    className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Add Profile
                                </Link>
                    )}
                />

                    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-sm font-semibold text-slate-100">Profile directory</h2>
                                <p className="text-xs text-slate-400">{profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="profile-status-filter" className="text-xs font-semibold uppercase text-slate-500">Status</label>
                                <select
                                    id="profile-status-filter"
                                    value={status}
                                    onChange={(e) => handleStatusFilter(e.target.value)}
                                    className="rounded-lg border border-slate-700 bg-slate-900 py-2 pl-3 pr-8 text-sm font-medium text-slate-200 [color-scheme:dark] focus:border-orange-500 focus:ring-orange-500"
                                >
                                    {STATUS_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Bulk action bar */}
                        {canManage && selectedIds.size > 0 && (
                            <div className="flex flex-col gap-2 border-b border-slate-800 bg-orange-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-sm font-medium text-orange-300">
                                        {selectionCount} selected
                                    </span>
                                    {allPageSelected && profiles.length > 0 && (
                                        selectAllMatching ? (
                                            <button
                                                type="button"
                                                onClick={() => setSelectAllMatching(false)}
                                                className="text-xs font-semibold text-orange-300 underline hover:text-orange-200"
                                            >
                                                Clear matching selection
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setSelectAllMatching(true)}
                                                className="text-xs font-semibold text-orange-300 underline hover:text-orange-200"
                                            >
                                                Select all {profiles.length} matching
                                            </button>
                                        )
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => runBulk(true)}
                                        className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                                    >
                                        Enable
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => runBulk(false)}
                                        className="inline-flex items-center rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
                                    >
                                        Disable
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearSelection}
                                        className="inline-flex items-center rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}

                        {profiles.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <svg className="mx-auto mb-3 h-10 w-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <h3 className="text-base font-semibold text-slate-100">No profiles found</h3>
                                <p className="mt-1 text-sm text-slate-400">Create a profile to assign it to clients and work entries.</p>
                                {canManage && (
                                    <Link
                                        href={`${route('upwork-profiles.create')}?return_to=${encodeURIComponent(currentListUrl())}`}
                                        className="mt-4 inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                                    >
                                        Add first profile
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-800">
                                    <thead className="bg-slate-950">
                                        <tr>
                                            {canManage && (
                                                <th className="w-12 px-4 py-3 text-left">
                                                    <input
                                                        type="checkbox"
                                                        checked={allPageSelected}
                                                        onChange={toggleSelectAllOnPage}
                                                        className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-2 focus:ring-orange-500"
                                                    />
                                                </th>
                                            )}
                                            <th className="sticky left-0 z-10 bg-slate-950 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-300">Profile</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-300">Description</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-300">Status</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-300">Created</th>
                                            {canManage && <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-300">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 bg-slate-900">
                                        {profiles.map((profile) => (
                                            <tr key={profile.id} className="bg-slate-900 hover:bg-slate-800/40">
                                                {canManage && (
                                                    <td className="whitespace-nowrap px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(profile.id)}
                                                            onChange={() => toggleRow(profile.id)}
                                                            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-2 focus:ring-orange-500"
                                                        />
                                                    </td>
                                                )}
                                                <td className="sticky left-0 z-[1] whitespace-nowrap bg-inherit px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-slate-100">{profile.name}</span>
                                                        {!profile.is_active && (
                                                            <span className="inline-flex rounded-md bg-slate-700/40 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-slate-400">{profile.email || 'No email'}</div>
                                                </td>
                                                <td className="max-w-md px-4 py-3 text-sm text-slate-400">
                                                    <span className="line-clamp-2">{profile.description || 'No description'}</span>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3">
                                                    {canManage ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleProfileStatus(profile)}
                                                            title={profile.is_active ? 'Click to disable' : 'Click to enable'}
                                                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                                                                profile.is_active
                                                                    ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                                                                    : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                                                            }`}
                                                        >
                                                            <span className={`h-1.5 w-1.5 rounded-full ${profile.is_active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                                            {profile.is_active ? 'Active' : 'Disabled'}
                                                        </button>
                                                    ) : (
                                                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
                                                            profile.is_active
                                                                ? 'bg-emerald-500/15 text-emerald-300'
                                                                : 'bg-slate-700/40 text-slate-300'
                                                        }`}>
                                                            {profile.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-400">
                                                    {new Date(profile.created_at).toLocaleDateString()}
                                                </td>
                                                {canManage && (
                                                    <td className="whitespace-nowrap px-4 py-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Link
                                                                href={`${route('upwork-profiles.edit', profile.id)}?return_to=${encodeURIComponent(currentListUrl())}`}
                                                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                                                            >
                                                                Edit
                                                            </Link>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(profile)}
                                                                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-400 hover:bg-red-500/10"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
            </PageShell>
        </AuthenticatedLayout>
    );
}
