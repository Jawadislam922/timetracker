import React, { useEffect, useMemo, useRef } from 'react';
import { useForm } from '@inertiajs/react';
import SearchableMultiSelect from './Filters/SearchableMultiSelect';
import TagInput from './TagInput';

/**
 * Add / edit a client in place — no page navigation for the common case.
 *
 * The name field live-matches against EVERY existing client (active and
 * archived) while you type. An exact match blocks saving outright: production
 * accumulated three separate "Brad Pugh" records because nothing ever checked,
 * and un-mixing their hours afterwards is far harder than preventing the
 * duplicate. If it genuinely is a different person with the same name, one
 * explicit checkbox allows it; if the match is archived, the right move is to
 * restore it, so that's what the hint offers.
 */
export default function ClientFormModal({
    open,
    onClose,
    client = null,           // null => create; object => edit
    workTypes = {},
    preferredContacts = {},
    profileOptions = [],
    allClients = null,        // lazy: null until the parent partial-reloads it
}) {
    const isEdit = !!client?.id;
    const nameRef = useRef(null);

    const form = useForm({
        name: '',
        email: '',
        phone: '',
        preferred_contact: '',
        contact_notes: '',
        tags: [],
        work_type: '',
        upwork_profile_ids: [],
        allow_duplicate: false,
    });

    // (Re)seed the form each time the modal opens for a different subject.
    useEffect(() => {
        if (!open) return;
        form.clearErrors();
        form.setData({
            name: client?.name ?? '',
            email: client?.email ?? '',
            phone: client?.phone ?? '',
            preferred_contact: client?.preferred_contact ?? '',
            contact_notes: client?.contact_notes ?? '',
            tags: client?.tags ?? [],
            work_type: client?.work_type ?? '',
            // Fall back to the legacy single-profile column when the pivot is
            // empty. Every CSV-imported client is in exactly that state, and
            // without this they open with an empty selector and cannot be saved
            // again until someone re-picks the profile by hand.
            upwork_profile_ids: (client?.upwork_profiles ?? []).length
                ? client.upwork_profiles.map((p) => p.id)
                : (client?.upwork_profile_id ? [client.upwork_profile_id] : []),
            allow_duplicate: false,
        });
        setTimeout(() => nameRef.current?.focus(), 50);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, client?.id]);

    const profileRequired = ['tracker_manual', 'fixed'].includes(form.data.work_type);

    // Switching to a work type that needs no profile must CLEAR the selection —
    // merely hiding the picker still synced the stale ids to the pivot on save.
    useEffect(() => {
        if (!open) return;
        if (!profileRequired && form.data.upwork_profile_ids.length > 0) {
            form.setData('upwork_profile_ids', []);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.data.work_type]);

    // Live duplicate matching against every client, self excluded when editing.
    const q = form.data.name.trim().toLowerCase();
    const matches = useMemo(() => {
        if (!allClients || q.length < 2) return [];
        return allClients
            .filter((c) => c.id !== client?.id && c.name.toLowerCase().includes(q))
            .slice(0, 6);
    }, [allClients, q, client?.id]);
    const exactMatch = matches.find((c) => c.name.trim().toLowerCase() === q) || null;
    const blocked = !!exactMatch && !form.data.allow_duplicate;

    const submit = (e) => {
        e.preventDefault();
        if (blocked) return;
        const opts = {
            preserveScroll: true,
            onSuccess: () => { form.reset(); onClose(); },
        };
        // Come back to THIS list view — same page, search and filters. Without
        // it the save redirects to a bare /clients and dumps you on page 1.
        form.transform((data) => ({
            ...data,
            return_to: window.location.pathname + window.location.search,
        }));
        if (isEdit) {
            form.put(route('clients.update', client.id), opts);
        } else {
            form.post(route('clients.store'), opts);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[8vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                    <h2 className="text-base font-semibold text-white">{isEdit ? `Edit ${client.name}` : 'Add client'}</h2>
                    <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200" aria-label="Close">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-4 px-5 py-4">
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">Name *</label>
                        <input
                            ref={nameRef}
                            type="text"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/40"
                            placeholder="Client name"
                            required
                        />
                        {form.errors.name && <p className="mt-1 text-xs text-rose-400">{form.errors.name}</p>}

                        {/* Live duplicate matches while typing */}
                        {matches.length > 0 && (
                            <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${exactMatch ? 'border-rose-500/40 bg-rose-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
                                <p className={`mb-1 font-semibold ${exactMatch ? 'text-rose-300' : 'text-amber-300'}`}>
                                    {exactMatch ? 'This client already exists:' : 'Similar clients already exist — is it one of these?'}
                                </p>
                                <ul className="space-y-0.5">
                                    {matches.map((c) => (
                                        <li key={c.id} className="flex items-center gap-2 text-slate-200">
                                            <span>{c.name}</span>
                                            {!c.is_active && (
                                                <span className="rounded border border-slate-600 bg-slate-700/60 px-1.5 text-[10px] uppercase text-slate-300">archived</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                {exactMatch && !exactMatch.is_active && (
                                    <p className="mt-1.5 text-slate-300">
                                        It's archived — <Link href={route('clients.index', { status: 'archived', search: exactMatch.name })} className="text-orange-300 underline">restore it</Link> instead of creating a duplicate.
                                    </p>
                                )}
                                {exactMatch && (
                                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={form.data.allow_duplicate}
                                            onChange={(e) => form.setData('allow_duplicate', e.target.checked)}
                                            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500/40"
                                        />
                                        This is a <strong>different</strong> client who happens to have the same name
                                    </label>
                                )}
                            </div>
                        )}
                        {allClients === null && form.data.name.trim().length >= 2 && (
                            <p className="mt-1 text-[11px] text-slate-500">Checking for existing clients…</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">Email</label>
                            <input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/40"
                                placeholder="client@example.com" />
                            {form.errors.email && <p className="mt-1 text-xs text-rose-400">{form.errors.email}</p>}
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">Phone</label>
                            <input type="text" value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/40"
                                placeholder="+1 …" />
                            {form.errors.phone && <p className="mt-1 text-xs text-rose-400">{form.errors.phone}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">Preferred contact</label>
                            <select value={form.data.preferred_contact} onChange={(e) => form.setData('preferred_contact', e.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/40">
                                <option value="">Not set</option>
                                {Object.entries(preferredContacts).map(([k, label]) => (
                                    <option key={k} value={k}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">Work type *</label>
                            <select value={form.data.work_type} onChange={(e) => form.setData('work_type', e.target.value)} required
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/40">
                                <option value="">Select…</option>
                                {Object.entries(workTypes).map(([k, label]) => (
                                    <option key={k} value={k}>{label}</option>
                                ))}
                            </select>
                            {form.errors.work_type && <p className="mt-1 text-xs text-rose-400">{form.errors.work_type}</p>}
                        </div>
                    </div>

                    {profileRequired && (
                        <div>
                            <SearchableMultiSelect
                                label="Upwork profiles *"
                                inline
                                options={profileOptions.map((p) => ({ value: String(p.id), label: p.name }))}
                                selectedValues={form.data.upwork_profile_ids.map(String)}
                                onChange={(vals) => form.setData('upwork_profile_ids', vals.map(Number))}
                                placeholder="Select the profile(s) this client came through"
                            />
                            {form.errors.upwork_profile_ids && <p className="mt-1 text-xs text-rose-400">{form.errors.upwork_profile_ids}</p>}
                        </div>
                    )}

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">How to approach them</label>
                        <textarea value={form.data.contact_notes} onChange={(e) => form.setData('contact_notes', e.target.value)}
                            rows={2} maxLength={500}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/40"
                            placeholder="e.g. Replies fastest on Upwork mornings US time; never call without booking" />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-400">Tags</label>
                        <TagInput
                            tags={form.data.tags}
                            onChange={(tags) => form.setData('tags', tags)}
                            placeholder="Add tags to categorise this client…"
                            compact
                        />
                    </div>

                    <div className="flex items-center justify-end border-t border-slate-800 pt-4">
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose}
                                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">
                                Cancel
                            </button>
                            <button type="submit" disabled={form.processing || blocked}
                                title={blocked ? 'A client with exactly this name already exists' : undefined}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                                {form.processing ? 'Saving…' : isEdit ? 'Save changes' : 'Add client'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
