import React, { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';

function fmtDuration(seconds) {
    if (!seconds) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
}

// Honors the company display settings (timezone + 12/24h) instead of the
// viewer's machine locale.
let DISPLAY = { timezone: 'Asia/Karachi', format: '12' };

function fmtTime(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleTimeString('en-US', {
            timeZone: DISPLAY.timezone,
            hour: 'numeric', minute: '2-digit',
            hour12: String(DISPLAY.format) !== '24',
        });
    } catch {
        return iso;
    }
}

export default function SessionDetail({ auth, session, screenshots = [], permissions = {} }) {
    DISPLAY = usePage().props.display || DISPLAY;
    const [lightbox, setLightbox] = useState(null);

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <h2 className="font-semibold text-xl text-gray-800 leading-tight">
                    Tracking Session #{session.id}
                </h2>
            }
        >
            <Head title={`Session #${session.id}`} />

            <div className="py-8">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-4">
                    <Link href={route('monitoring.sessions')} className="text-sm text-indigo-600 hover:underline">
                        &larr; Back to sessions
                    </Link>

                    <div className="bg-white shadow rounded-lg p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><div className="text-gray-500">User</div><div className="font-medium">{session.user?.name}</div></div>
                        <div><div className="text-gray-500">Client</div><div className="font-medium">{session.client?.name || '—'}</div></div>
                        <div><div className="text-gray-500">Work type</div><div className="font-medium">{session.work_type || '—'}</div></div>
                        <div><div className="text-gray-500">Status</div><div className="font-medium">{session.status}</div></div>
                        <div><div className="text-gray-500">Started</div><div className="font-medium">{fmtTime(session.started_at)}</div></div>
                        <div><div className="text-gray-500">Stopped</div><div className="font-medium">{fmtTime(session.stopped_at)}</div></div>
                        <div><div className="text-gray-500">Duration</div><div className="font-medium">{fmtDuration(session.total_seconds)}</div></div>
                        <div><div className="text-gray-500">Activity</div><div className="font-medium">{session.activity_percent ?? 0}%</div></div>
                        {session.task_note && (
                            <div className="col-span-full">
                                <div className="text-gray-500">Task note</div>
                                <div className="font-medium whitespace-pre-wrap">{session.task_note}</div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white shadow rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Screenshots</h3>
                        {!permissions?.view_screenshots ? (
                            <p className="text-sm text-gray-500">You do not have permission to view screenshots for this session.</p>
                        ) : screenshots.length === 0 ? (
                            <p className="text-sm text-gray-500">No screenshots captured.</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {screenshots.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setLightbox(s)}
                                        className="block text-left bg-gray-50 rounded-lg overflow-hidden hover:ring-2 hover:ring-indigo-400"
                                    >
                                        {s.thumbnail_url ? (
                                            <img
                                                src={s.thumbnail_url}
                                                alt={`Screenshot at ${fmtTime(s.captured_at)}`}
                                                className="w-full h-32 object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-32 flex items-center justify-center text-gray-400 text-xs">
                                                no preview
                                            </div>
                                        )}
                                        <div className="p-2 text-xs">
                                            <div className="font-medium">{fmtTime(s.captured_at)}</div>
                                            <div className="text-gray-500 truncate">{s.active_app || '—'}</div>
                                            <div className="text-gray-400">Activity: {s.activity_percent ?? 0}%</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {lightbox && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
                    onClick={() => setLightbox(null)}
                >
                    <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={lightbox.image_url}
                            alt="Full screenshot"
                            className="w-full rounded-lg shadow-2xl"
                        />
                        <div className="text-white text-sm mt-2">
                            {fmtTime(lightbox.captured_at)} — {lightbox.active_app || 'unknown app'}
                            {lightbox.active_window_title ? ` · ${lightbox.active_window_title}` : ''}
                            <button
                                type="button"
                                className="ml-4 underline"
                                onClick={() => setLightbox(null)}
                            >
                                close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
