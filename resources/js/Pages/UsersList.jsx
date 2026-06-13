import { useEffect, useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Pencil, Plus, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Avatar from '@/Components/Avatar';
import ActiveFilterChips from '@/Components/Filters/ActiveFilterChips';
import SearchableMultiSelect from '@/Components/Filters/SearchableMultiSelect';
import { TraditionalPagination } from '@/Components/Pagination';

const roleStyles = {
    super_admin: 'bg-violet-100 text-violet-800',
    admin: 'bg-blue-100 text-blue-800',
    member: 'bg-emerald-100 text-emerald-800',
};

const noDesignationValue = 'no_designation';

export default function UsersList({ auth, users, filters = {}, filterOptions = {}, managedDesignations = [] }) {
    const can = (permission) => auth.user?.is_super_admin || auth.user?.permissions?.includes(permission);
    const [search, setSearch] = useState(filters.search || '');
    const [roles, setRoles] = useState((filters.roles || []).map(String));
    const [designations, setDesignations] = useState((filters.designations || []).map(String));
    const [perPage, setPerPage] = useState(users?.per_page || 10);
    const [deleteUser, setDeleteUser] = useState(null);
    const [showDesignationDialog, setShowDesignationDialog] = useState(false);
    const [newDesignation, setNewDesignation] = useState('');

    const roleOptions = filterOptions.roles || [];
    const designationOptions = [
        { value: noDesignationValue, label: 'No designation' },
        ...(filterOptions.designations || []).map((designation) => ({
            value: String(designation),
            label: String(designation),
        })),
    ];

    const applyFilters = (changes = {}) => {
        const next = {
            search: changes.search ?? search,
            roles: changes.roles ?? roles,
            designations: changes.designations ?? designations,
            perPage: changes.perPage ?? perPage,
            sort: changes.sort ?? (filters.sort || 'name'),
            dir: changes.dir ?? (filters.dir || 'asc'),
        };

        router.get(route('users.index'), next, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const sortBy = (column) => {
        const dir = (filters.sort || 'name') === column && (filters.dir || 'asc') === 'asc' ? 'desc' : 'asc';
        applyFilters({ sort: column, dir });
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (search !== (filters.search || '')) applyFilters({ search });
        }, 400);

        return () => window.clearTimeout(timer);
    }, [search]);

    const chips = useMemo(() => {
        const items = [];
        const roleLabels = new Map(roleOptions.map((option) => [String(option.value), option.label]));
        const designationLabels = new Map(designationOptions.map((option) => [String(option.value), option.label]));

        roles.forEach((role) => items.push({
            key: `role-${role}`,
            label: `Role: ${roleLabels.get(role) || role}`,
            onRemove: () => {
                const next = roles.filter((item) => item !== role);
                setRoles(next);
                applyFilters({ roles: next });
            },
        }));
        designations.forEach((designation) => items.push({
            key: `designation-${designation}`,
            label: `Designation: ${designationLabels.get(designation) || designation}`,
            onRemove: () => {
                const next = designations.filter((item) => item !== designation);
                setDesignations(next);
                applyFilters({ designations: next });
            },
        }));

        return items;
    }, [roles, designations, roleOptions, designationOptions]);

    const clearFilters = () => {
        setRoles([]);
        setDesignations([]);
        setSearch('');
        router.get(route('users.index'), { perPage }, { preserveState: true, replace: true });
    };

    const currentListUrl = () => (
        typeof window === 'undefined'
            ? route('users.index')
            : `${window.location.pathname}${window.location.search}`
    );

    const editUserHref = (userId) => {
        const returnTo = currentListUrl();
        return `${route('users.edit', userId)}?return_to=${encodeURIComponent(returnTo)}`;
    };

    const confirmDelete = () => {
        if (!deleteUser) return;
        router.delete(route('users.destroy', deleteUser.id), {
            data: { return_to: currentListUrl() },
            preserveState: true,
            preserveScroll: true,
            onFinish: () => setDeleteUser(null),
        });
    };

    const addDesignation = (event) => {
        event.preventDefault();
        const name = newDesignation.trim();

        if (!name) return;

        router.post(route('users.designations.store'), {
            name,
            return_to: currentListUrl(),
        }, {
            preserveScroll: true,
            onSuccess: () => setNewDesignation(''),
        });
    };

    const removeDesignation = (designation) => {
        router.delete(route('users.designations.destroy', designation.id), {
            data: { return_to: currentListUrl() },
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Users" />
            <div className="min-h-screen bg-slate-950">
                <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                    <section className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-orange-400">Team management</p>
                            <h1 className="mt-1 text-2xl font-bold text-white">Users</h1>
                            <p className="mt-1 text-sm text-slate-400">Manage accounts, roles, designations, and selected access.</p>
                        </div>
                        {can('users.manage') && (
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={() => setShowDesignationDialog(true)}
                                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                                >
                                    Manage designations
                                </button>
                                <Link
                                    href={route('users.create')}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add user
                                </Link>
                            </div>
                        )}
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_260px_260px_130px]">
                            <label className="block">
                                <span className="mb-2 block text-sm font-semibold text-slate-700">Search</span>
                                <span className="relative block">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Name or email"
                                        className="w-full rounded-lg border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </span>
                            </label>
                            <SearchableMultiSelect
                                label="Roles"
                                options={roleOptions}
                                selectedValues={roles}
                                onChange={(next) => {
                                    setRoles(next);
                                    applyFilters({ roles: next });
                                }}
                                placeholder="All roles"
                            />
                            <SearchableMultiSelect
                                label="Designations"
                                options={designationOptions}
                                selectedValues={designations}
                                onChange={(next) => {
                                    setDesignations(next);
                                    applyFilters({ designations: next });
                                }}
                                placeholder="All designations"
                            />
                            <label className="block">
                                <span className="mb-2 block text-sm font-semibold text-slate-700">Rows</span>
                                <select
                                    value={perPage}
                                    onChange={(event) => {
                                        const next = Number(event.target.value);
                                        setPerPage(next);
                                        applyFilters({ perPage: next });
                                    }}
                                    className="w-full rounded-lg border-slate-300 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                                >
                                    {[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
                                </select>
                            </label>
                        </div>
                        <div className="px-4 pb-4">
                            <ActiveFilterChips chips={chips} onClearAll={clearFilters} />
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                    <Users className="h-5 w-5" />
                                </span>
                                <div>
                                    <h2 className="font-bold text-slate-950">Team directory</h2>
                                    <p className="text-sm text-slate-500">{users.total} account{users.total === 1 ? '' : 's'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-900">
                                    <tr>
                                        {[
                                            { heading: 'User', sort: 'name' },
                                            { heading: 'Designation', sort: 'designation' },
                                            { heading: 'Shift', sort: 'shift' },
                                            { heading: 'Role', sort: 'role' },
                                            { heading: 'Weekly tracked', sort: 'weekly_hours', help: 'Work-diary hours this week (tracker + manual entries) — not clock in/out time.' },
                                            { heading: 'Actions', sort: null },
                                        ].map(({ heading, sort, help }, index) => (
                                            <th
                                                key={heading}
                                                className={`whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase text-white ${
                                                    index === 0 ? 'sticky left-0 z-10 bg-slate-900' : ''
                                                }`}
                                            >
                                                {sort ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => sortBy(sort)}
                                                        title={help || `Sort by ${heading.toLowerCase()}`}
                                                        className="inline-flex items-center gap-1 uppercase hover:text-orange-300"
                                                    >
                                                        {heading}
                                                        {help && <span className="text-slate-400">ⓘ</span>}
                                                        {(filters.sort || 'name') === sort && (
                                                            <span>{(filters.dir || 'asc') === 'asc' ? '▲' : '▼'}</span>
                                                        )}
                                                    </button>
                                                ) : heading}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {users.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-14 text-center">
                                                <Users className="mx-auto h-10 w-10 text-slate-400" />
                                                <h3 className="mt-3 font-semibold text-slate-900">No users found</h3>
                                                <p className="mt-1 text-sm text-slate-500">Adjust the search or selected filters.</p>
                                            </td>
                                        </tr>
                                    ) : users.data.map((user) => {
                                        const canEdit = can('users.manage') && (auth.user.is_super_admin || user.role !== 'super_admin');
                                        const canDelete = can('users.delete')
                                            && user.id !== auth.user.id
                                            && (auth.user.is_super_admin || user.role !== 'super_admin');

                                        return (
                                            <tr key={user.id} className="bg-white hover:bg-slate-50">
                                                <td className="sticky left-0 z-[1] min-w-64 bg-inherit px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar user={user} size="md" />
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-semibold text-slate-900">{user.name}</div>
                                                            <div className="truncate text-sm text-slate-500">{user.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                                                    <div className="font-medium text-slate-800">{user.designation || 'No designation'}</div>
                                                    {user.joining_date_display && (
                                                        <div className="text-xs text-slate-500">
                                                            Joined {user.joining_date_display}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                                                    {user.shift_start_display ? (
                                                        <>
                                                            <div className="font-medium text-slate-800">{user.shift_start_display}</div>
                                                            <div className="text-xs text-slate-500">{user.shift_grace_minutes ?? 15}m grace</div>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400">Not configured</span>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${roleStyles[user.role] || 'bg-slate-100 text-slate-700'}`}>
                                                        {user.role === 'super_admin' && <ShieldCheck className="h-3.5 w-3.5" />}
                                                        {user.role_label || user.role}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-semibold text-slate-800">
                                                    {user.weekly_hours_worked || '00:00'}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {canEdit && (
                                                            <Link
                                                                href={editUserHref(user.id)}
                                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                                                                title={`Edit ${user.name}`}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Link>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeleteUser(user)}
                                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
                                                                title={`Delete ${user.name}`}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        {!canEdit && !canDelete && <span className="text-sm text-slate-400">-</span>}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {users.total > 0 && (
                            <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
                                <TraditionalPagination pagination={users} preserveState preserveScroll />
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {deleteUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                    <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
                        <h2 className="text-lg font-bold text-slate-950">Delete user?</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            This will permanently delete {deleteUser.name}. Existing related records may prevent deletion.
                        </p>
                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteUser(null)}
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
                            >
                                Delete user
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDesignationDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                    <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
                        <div className="border-b border-slate-200 px-5 py-4">
                            <h2 className="text-lg font-bold text-slate-950">Manage designations</h2>
                            <p className="mt-1 text-sm text-slate-600">These appear as suggestions when adding or editing users.</p>
                        </div>
                        <div className="space-y-4 p-5">
                            <form onSubmit={addDesignation} className="flex gap-2">
                                <input
                                    value={newDesignation}
                                    onChange={(event) => setNewDesignation(event.target.value)}
                                    placeholder="Add designation"
                                    className="min-w-0 flex-1 rounded-lg border-slate-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                                <button
                                    type="submit"
                                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                                >
                                    Add
                                </button>
                            </form>

                            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                                {managedDesignations.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-sm text-slate-500">No designation suggestions yet.</div>
                                ) : managedDesignations.map((designation) => (
                                    <div key={designation.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                                        <span className="text-sm font-semibold text-slate-800">{designation.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeDesignation(designation)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
                                            title={`Remove ${designation.name}`}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
                            <button
                                type="button"
                                onClick={() => setShowDesignationDialog(false)}
                                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
