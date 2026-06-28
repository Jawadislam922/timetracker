import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PageShell from '@/Components/Layout/PageShell';
import PageHeader from '@/Components/Layout/PageHeader';
import Avatar from '@/Components/Avatar';
import FeedbackForm from '@/Components/FeedbackForm';
import toast from 'react-hot-toast';
import { Plus, Inbox, MessageSquare, Search } from 'lucide-react';

const STATUS_META = {
    new: { label: 'New', cls: 'bg-sky-500/15 text-sky-300' },
    in_review: { label: 'In review', cls: 'bg-amber-500/15 text-amber-300' },
    planned: { label: 'Planned', cls: 'bg-violet-500/15 text-violet-300' },
    done: { label: 'Done', cls: 'bg-emerald-500/15 text-emerald-300' },
    declined: { label: 'Declined', cls: 'bg-slate-600/40 text-slate-300' },
};
const TYPE_LABEL = { feature_request: 'Feature', question: 'Question', bug: 'Bug', missing_doc: 'Missing doc' };
const STATUS_ORDER = ['new', 'in_review', 'planned', 'done', 'declined'];

const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return ''; }
};

function StatusPill({ status }) {
    const m = STATUS_META[status] || STATUS_META.new;
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls}`}>{m.label}</span>;
}

function ManagerRow({ item }) {
    const [status, setStatus] = useState(item.status);
    const [response, setResponse] = useState(item.response || '');
    const [saving, setSaving] = useState(false);
    const dirty = status !== item.status || response !== (item.response || '');

    const save = () => {
        setSaving(true);
        router.patch(route('feedback.update', item.id), { status, response }, {
            preserveScroll: true,
            onSuccess: () => toast.success('Request updated'),
            onFinish: () => setSaving(false),
        });
    };

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    {item.user ? <Avatar user={{ name: item.user.name, avatar_url: item.user.avatar_url }} size="sm" /> : null}
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-white">{item.subject}</span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400">{TYPE_LABEL[item.type] || item.type}</span>
                        </div>
                        <p className="text-xs text-slate-400">{item.user?.name || 'Unknown'} · {fmtDate(item.created_at)}</p>
                    </div>
                </div>
                <StatusPill status={status} />
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{item.message}</p>
            {item.context?.query && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-800/60 px-2 py-1 text-xs text-slate-400">
                    <Search className="h-3 w-3" /> searched “{item.context.query}”
                </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {STATUS_ORDER.map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                            status === s ? STATUS_META[s].cls : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        {STATUS_META[s].label}
                    </button>
                ))}
            </div>

            <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={2}
                placeholder="Reply / internal note (optional)"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500/60 focus:outline-none"
            />

            <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">{item.handler ? `Last handled by ${item.handler.name}` : ''}</span>
                <button
                    type="button"
                    onClick={save}
                    disabled={!dirty || saving}
                    className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-orange-600 disabled:opacity-40"
                >
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    );
}

function MemberRow({ item }) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">{item.subject}</span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400">{TYPE_LABEL[item.type] || item.type}</span>
                    </div>
                    <p className="text-xs text-slate-400">{fmtDate(item.created_at)}</p>
                </div>
                <StatusPill status={item.status} />
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{item.message}</p>
            {item.response && (
                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-400">Reply</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-200">{item.response}</p>
                </div>
            )}
        </div>
    );
}

export default function FeedbackIndex({ auth, items = [], canManage = false, filters = {}, counts = null }) {
    const [showForm, setShowForm] = useState(false);

    const setStatusFilter = (status) => router.get(route('feedback.index'), status ? { status } : {}, { preserveScroll: true, preserveState: true });

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title={canManage ? 'Feedback inbox' : 'My requests'} />

            <PageShell width="max-w-3xl">
                <div className="flex items-center justify-between gap-3">
                    <PageHeader
                        title={canManage ? 'Feedback inbox' : 'My requests'}
                        description={canManage
                            ? 'Questions and feature requests from the team — including searches the Help docs could not answer.'
                            : 'Requests you have sent, and where they stand.'}
                    />
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-600"
                    >
                        <Plus className="h-4 w-4" /> New request
                    </button>
                </div>

                {canManage && counts && (
                    <div className="mb-4 flex flex-wrap items-center gap-1.5">
                        <button type="button" onClick={() => setStatusFilter(null)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium ${!filters.status ? 'bg-orange-500/20 text-orange-300' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
                            All ({counts.total})
                        </button>
                        {STATUS_ORDER.map((s) => (
                            <button key={s} type="button" onClick={() => setStatusFilter(s)}
                                className={`rounded-md px-2.5 py-1 text-xs font-medium ${filters.status === s ? STATUS_META[s].cls : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
                                {STATUS_META[s].label}
                            </button>
                        ))}
                        <span className="ml-auto text-xs text-slate-500">{counts.open} open</span>
                    </div>
                )}

                {items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-12 text-center">
                        {canManage ? <Inbox className="h-9 w-9 text-slate-600" /> : <MessageSquare className="h-9 w-9 text-slate-600" />}
                        <p className="text-sm font-medium text-slate-200">{canManage ? 'Inbox is empty' : 'No requests yet'}</p>
                        <p className="text-xs text-slate-500">{canManage ? 'New requests from the team will show here.' : 'Send a request and track its status here.'}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => (canManage
                            ? <ManagerRow key={item.id} item={item} />
                            : <MemberRow key={item.id} item={item} />))}
                    </div>
                )}
            </PageShell>

            <FeedbackForm open={showForm} onClose={() => setShowForm(false)} />
        </AuthenticatedLayout>
    );
}
