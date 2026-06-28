import { useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

const TYPES = [
    ['feature_request', 'Feature request'],
    ['question', 'Question'],
    ['bug', 'Something is broken'],
    ['missing_doc', 'Missing from Help'],
];

/**
 * Modal to file a feedback / request item. Reused by the Help page ("can't find
 * it?") and the inbox page ("new request"). `initial` can preset the type,
 * subject, and context (e.g. the search query that came up empty).
 */
export default function FeedbackForm({ open, onClose, initial = {} }) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        type: 'feature_request',
        subject: '',
        message: '',
        context: null,
    });

    useEffect(() => {
        if (open) {
            setData({
                type: initial.type || 'feature_request',
                subject: initial.subject || '',
                message: '',
                context: initial.context || null,
            });
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    const submit = (e) => {
        e.preventDefault();
        post(route('feedback.store'), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Request sent — thanks!');
                reset();
                onClose();
            },
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-bold text-white">Send a request</h2>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200"><X className="h-5 w-5" /></button>
                </div>

                <form onSubmit={submit} className="space-y-3">
                    {initial.context?.query && (
                        <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
                            You searched: <span className="text-slate-200">“{initial.context.query}”</span>
                        </p>
                    )}

                    <div>
                        <span className="mb-1 block text-xs font-medium text-slate-400">Type</span>
                        <div className="flex flex-wrap gap-1.5">
                            {TYPES.map(([k, l]) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setData('type', k)}
                                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                                        data.type === k ? 'bg-orange-500/20 text-orange-300' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-400">Subject</label>
                        <input
                            value={data.subject}
                            onChange={(e) => setData('subject', e.target.value)}
                            maxLength={160}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500/60 focus:outline-none"
                            placeholder="Short summary"
                        />
                        {errors.subject && <p className="mt-1 text-xs text-rose-400">{errors.subject}</p>}
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-400">Details</label>
                        <textarea
                            value={data.message}
                            onChange={(e) => setData('message', e.target.value)}
                            rows={4}
                            maxLength={4000}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500/60 focus:outline-none"
                            placeholder="What do you need, or what's missing?"
                        />
                        {errors.message && <p className="mt-1 text-xs text-rose-400">{errors.message}</p>}
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
                        <button type="submit" disabled={processing} className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-600 disabled:opacity-50">
                            {processing ? 'Sending…' : 'Send request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
