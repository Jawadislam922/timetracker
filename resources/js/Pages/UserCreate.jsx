import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import UserForm from '@/Components/Users/UserForm';

export default function UserCreate({ auth, roles, permissionGroups, canManageAccess, designationOptions = [] }) {
    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Add User" />
            <div className="min-h-screen bg-slate-950">
                <div className="mx-auto max-w-none px-4 py-6 sm:px-6 lg:px-8">
                    <div className="mb-6 border-b border-slate-800 pb-5">
                        <p className="text-sm font-semibold text-orange-400">Team management</p>
                        <h1 className="mt-1 text-2xl font-bold text-white">Add user</h1>
                        <p className="mt-1 text-sm text-slate-400">Create an account and assign only the access it needs.</p>
                    </div>
                    <UserForm
                        roles={roles}
                        permissionGroups={permissionGroups}
                        canManageAccess={canManageAccess}
                        designationOptions={designationOptions}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
