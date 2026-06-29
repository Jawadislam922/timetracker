import { useEffect, useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PageShell from '@/Components/Layout/PageShell';
import Avatar from '@/Components/Avatar';
import FeedbackForm from '@/Components/FeedbackForm';
import { Plus, Inbox, MessageSquare, Search, Check, CheckCheck, ChevronLeft } from 'lucide-react';

const STATUS_META = {
    new: { label: 'New', cls: 'bg-sky-500/15 text-sky-300' },
    in_review: { label: 'In review', cls: 'bg-amber-500/15 text-amber-300' },
    planned: { label: 'Planned', cls: 'bg-violet-500/15 text-violet-300' },
    done: { label: 'Done', cls: 'bg-emerald-500/15 text-emerald-300' },
    declined: { label: 'Declined', cls: 'bg-slate-600/40 text-slate-300' },
};
const TYPE_LABEL = { feature_request: 'Feature', question: 'Question', bug: 'Bug', missing_doc: 'Missing doc' };
const STATUS_ORDER = ['new', 'in_review', 'planned', 'done', 'declined'];
const OPEN_STATUSES = ['new', 'in_review', 'planned'];
const CLOSED_STATUSES = ['done', 'declined'];

function StatusPill({ status }) {
    const m = STATUS_META[status] || STATUS_META.new;
    return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls}`}>{m.label}</span>;
}

export default function FeedbackIndex({ auth, items = [], canManage = false }) {
    const display = usePage().props.display || { timezone: 'Asia/Karachi' };
    const fmtWhen = (iso) => {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleString('en-US', {
                timeZone: display.timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            });
        } catch { return ''; }
    };

    const [filter, setFilter] = useState(canManage ? 'open' : 'all'); // all | open | closed | <status>
    const [selectedId, setSelectedId] = useState(items[0]?.id ?? null);
    const [showForm, setShowForm] = useState(false);
    const [reply, setReply] = useState('');
    const [replyStatus, setReplyStatus] = useState('');
    const [sending, setSending] = useState(false);

    const byStatus = useMemo(() => {
        const m = {};
        items.forEach((i) => { m[i.status] = (m[i.status] || 0) + 1; });
        return m;
    }, [items]);
    const openCount = OPEN_STATUSES.reduce((n, s) => n + (byStatus[s] || 0), 0);
    const closedCount = CLOSED_STATUSES.reduce((n, s) => n + (byStatus[s] || 0), 0);

    const visible = useMemo(() => items.filter((i) => {
        if (filter === 'all') return true;
        if (filter === 'open') return OPEN_STATUSES.includes(i.status);
        if (filter === 'closed') return CLOSED_STATUSES.includes(i.status);
        return i.status === filter;
    }), [items, filter]);

    const selected = items.find((i) => i.id === selectedId) || null;

    // Keep a valid selection when the filtered list changes.
    useEffect(() => {
        if (selected && visible.some((i) => i.id === selected.id)) return;
        setSelectedId(visible[0]?.id ?? null);
    }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

    // Opening an unread ticket marks it read for this side (clears its badge).
    useEffect(() => {
        const it = items.find((i) => i.id === selectedId);
        if (it && it.unread) {
            router.post(route('feedback.seen', selectedId), {}, { preserveScroll: true, preserveState: true });
        }
    }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

    const sendReply = () => {
        if (!reply.trim() || !selectedId) return;
        setSending(true);
        const payload = { body: reply };
        if (canManage && replyStatus) payload.status = replyStatus;
        router.post(route('feedback.reply', selectedId), payload, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => { setReply(''); setReplyStatus(''); },
            onFinish: () => setSending(false),
        });
    };

    const changeStatus = (status) => {
        router.patch(route('feedback.update', selectedId), { status }, { preserveScroll: true, preserveState: true });
    };

    const FILTERS = [
        { key: 'all', label: 'All', count: items.length },
        { key: 'open', label: 'Open', count: openCount },
        { key: 'closed', label: 'Closed', count: closedCount },
        ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS_META[s].label, count: byStatus[s] || 0 })),
    ];

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title={canManage ? 'Feedback inbox' : 'My requests'} />

            <PageShell width="max-w-none">
                <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-orange-400">Help &amp; Feedback</p>
                        <h1 className="mt-1 text-2xl font-bold text-white">{canManage ? 'Feedback inbox' : 'My requests'}</h1>
                        <p className="mt-1 text-sm text-slate-400">
                            {canManage
                                ? 'Tickets from the team — questions, feature requests, bugs, and searches the docs could not answer.'
                                : 'Requests you have sent, the replies, and where each one stands.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-orange-600 hover:to-amber-600"
                    >
                        <Plus className="h-4 w-4" /> New request
                    </button>
                </div>

                {/* Filter chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => setFilter(f.key)}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                                filter === f.key
                                    ? (STATUS_META[f.key]?.cls || 'bg-orange-500/20 text-orange-300')
                                    : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                        >
                            {f.label} <span className="opacity-60">{f.count}</span>
                        </button>
                    ))}
                </div>

                {items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-16 text-center">
                        {canManage ? <Inbox className="h-9 w-9 text-slate-600" /> : <MessageSquare className="h-9 w-9 text-slate-600" />}
                        <p className="text-sm font-medium text-slate-200">{canManage ? 'Inbox is empty' : 'No requests yet'}</p>
                        <p className="text-xs text-slate-500">{canManage ? 'New requests from the team will show here.' : 'Send a request and track its replies here.'}</p>
                    </div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
                        {/* List / sidebar */}
                        <div className={`overflow-hidden rounded-xl border border-slate-800 bg-slate-900 ${selected ? 'hidden lg:block' : ''}`}>
                            <ul className="max-h-[70vh] divide-y divide-slate-800 overflow-y-auto">
                                {visible.length === 0 && (
                                    <li className="px-4 py-10 text-center text-sm text-slate-500">No tickets in this view.</li>
                                )}
                                {visible.map((it) => (
                                    <li key={it.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedId(it.id)}
                                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-800/40 ${
                                                selectedId === it.id ? 'bg-slate-800/60' : ''
                                            }`}
                                        >
                                            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${it.unread ? 'bg-orange-400' : 'bg-transparent'}`} />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center justify-between gap-2">
                                                    <span className={`truncate text-sm ${it.unread ? 'font-bold text-white' : 'font-semibold text-slate-200'}`}>{it.subject}</span>
                                                    <StatusPill status={it.status} />
                                                </span>
                                                <span className="mt-0.5 block truncate text-xs text-slate-400">
                                                    {(canManage ? `${it.user?.name || 'Unknown'} · ` : '')}{TYPE_LABEL[it.type] || it.type} · {fmtWhen(it.last_activity_at)}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Detail / thread */}
                        <div className={`rounded-xl border border-slate-800 bg-slate-900 ${selected ? '' : 'hidden lg:flex'}`}>
                            {!selected ? (
                                <div className="flex w-full flex-col items-center justify-center gap-2 py-24 text-center text-slate-500">
                                    <MessageSquare className="h-8 w-8" />
                                    <p className="text-sm">Select a ticket to read the conversation.</p>
                                </div>
                            ) : (
                                <div className="flex h-full flex-col">
                                    {/* Header */}
                                    <div className="border-b border-slate-800 px-5 py-4">
                                        <button type="button" onClick={() => setSelectedId(null)} className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 lg:hidden">
                                            <ChevronLeft className="h-3.5 w-3.5" /> Back to list
                                        </button>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h2 className="text-base font-bold text-white">{selected.subject}</h2>
                                                <p className="mt-0.5 text-xs text-slate-400">
                                                    {selected.user?.name || 'Unknown'} · {TYPE_LABEL[selected.type] || selected.type} · opened {fmtWhen(selected.created_at)}
                                                </p>
                                            </div>
                                            <StatusPill status={selected.status} />
                                        </div>
                                        {canManage && (
                                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                                {STATUS_ORDER.map((s) => (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        onClick={() => changeStatus(s)}
                                                        className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                                                            selected.status === s ? STATUS_META[s].cls : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
                                                        }`}
                                                    >
                                                        {STATUS_META[s].label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Thread */}
                                    <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" style={{ maxHeight: '52vh' }}>
                                        {/* Opening request */}
                                        <MessageBubble
                                            authorName={selected.user?.name}
                                            avatarUser={selected.user}
                                            when={fmtWhen(selected.created_at)}
                                            body={selected.message}
                                            mine={!canManage}
                                            opening
                                        />
                                        {selected.context?.query && (
                                            <p className="ml-11 inline-flex items-center gap-1.5 rounded-lg bg-slate-800/60 px-2 py-1 text-xs text-slate-400">
                                                <Search className="h-3 w-3" /> searched “{selected.context.query}”
                                            </p>
                                        )}
                                        {selected.messages.map((m) => (
                                            <MessageBubble
                                                key={m.id}
                                                authorName={m.author?.name}
                                                avatarUser={m.author}
                                                when={fmtWhen(m.created_at)}
                                                body={m.body}
                                                mine={m.author?.id === auth.user.id}
                                            />
                                        ))}

                                        {/* Read receipt (managers see whether the submitter read the latest reply) */}
                                        {canManage && selected.submitter_read_latest !== null && (
                                            <p className="ml-11 inline-flex items-center gap-1 text-xs text-slate-500">
                                                {selected.submitter_read_latest
                                                    ? <><CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> Seen by {selected.user?.name?.split(' ')[0] || 'them'}</>
                                                    : <><Check className="h-3.5 w-3.5" /> Sent · not read yet</>}
                                            </p>
                                        )}
                                    </div>

                                    {/* Reply box */}
                                    <div className="border-t border-slate-800 p-4">
                                        <textarea
                                            value={reply}
                                            onChange={(e) => setReply(e.target.value)}
                                            rows={2}
                                            placeholder={canManage ? 'Reply to the team member…' : 'Add a reply…'}
                                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        />
                                        <div className="mt-2 flex items-center justify-between gap-2">
                                            {canManage ? (
                                                <select
                                                    value={replyStatus}
                                                    onChange={(e) => setReplyStatus(e.target.value)}
                                                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 [color-scheme:dark] focus:border-orange-500 focus:ring-orange-500"
                                                >
                                                    <option value="">Keep status</option>
                                                    {STATUS_ORDER.map((s) => <option key={s} value={s}>Set: {STATUS_META[s].label}</option>)}
                                                </select>
                                            ) : <span className="text-xs text-slate-500">A manager will be notified.</span>}
                                            <button
                                                type="button"
                                                onClick={sendReply}
                                                disabled={!reply.trim() || sending}
                                                className="rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-40"
                                            >
                                                {sending ? 'Sending…' : 'Send reply'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </PageShell>

            <FeedbackForm open={showForm} onClose={() => setShowForm(false)} />
        </AuthenticatedLayout>
    );
}

function MessageBubble({ authorName, avatarUser, when, body, mine = false, opening = false }) {
    return (
        <div className="flex items-start gap-3">
            <div className="shrink-0">
                {avatarUser ? <Avatar user={{ name: avatarUser.name, avatar_url: avatarUser.avatar_url }} size="sm" /> : <div className="h-8 w-8 rounded-full bg-slate-700" />}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{authorName || 'Unknown'}{mine ? ' (you)' : ''}</span>
                    <span className="text-xs text-slate-500">{when}</span>
                    {opening && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400">Request</span>}
                </div>
                <div className={`mt-1 whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${mine ? 'bg-orange-500/10 text-slate-100' : 'bg-slate-800/50 text-slate-200'}`}>
                    {body}
                </div>
            </div>
        </div>
    );
}
