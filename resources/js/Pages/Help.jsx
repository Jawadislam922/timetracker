import { useEffect, useMemo, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import PageHeader from '../Components/Layout/PageHeader';
import PageShell from '../Components/Layout/PageShell';
import { Search, Send, ShieldCheck, LifeBuoy, MessageSquarePlus, CheckCircle2 } from 'lucide-react';

// --- tiny markup renderer: blank-line paragraphs, "- " bullets, "1." steps, **bold** ---
function renderInline(text, key) {
    const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**')
        ? <strong key={`${key}-${i}`} className="font-semibold text-slate-100">{p.slice(2, -2)}</strong>
        : <span key={`${key}-${i}`}>{p}</span>));
}

function renderBody(body) {
    const lines = String(body).split('\n');
    const blocks = [];
    let list = null;
    const flush = () => { if (list) { blocks.push(list); list = null; } };
    lines.forEach((line) => {
        if (/^\s*-\s+/.test(line)) {
            if (!list || list.type !== 'ul') { flush(); list = { type: 'ul', items: [] }; }
            list.items.push(line.replace(/^\s*-\s+/, ''));
        } else if (/^\s*\d+\.\s+/.test(line)) {
            if (!list || list.type !== 'ol') { flush(); list = { type: 'ol', items: [] }; }
            list.items.push(line.replace(/^\s*\d+\.\s+/, ''));
        } else if (line.trim() === '') {
            flush();
        } else {
            flush();
            blocks.push({ type: 'p', text: line });
        }
    });
    flush();

    return blocks.map((b, i) => {
        if (b.type === 'p') return <p key={i} className="text-sm leading-relaxed text-slate-300">{renderInline(b.text, i)}</p>;
        if (b.type === 'ul') {
            return (
                <ul key={i} className="space-y-1">
                    {b.items.map((it, j) => (
                        <li key={j} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                            <span>{renderInline(it, `${i}-${j}`)}</span>
                        </li>
                    ))}
                </ul>
            );
        }
        return (
            <ol key={i} className="space-y-1">
                {b.items.map((it, j) => (
                    <li key={j} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-[11px] font-bold text-orange-300">{j + 1}</span>
                        <span>{renderInline(it, `${i}-${j}`)}</span>
                    </li>
                ))}
            </ol>
        );
    });
}

const terms = (q) => q.toLowerCase().split(/\s+/).map((t) => t.trim()).filter(Boolean);

function scoreArticle(article, qTerms) {
    const title = article.title.toLowerCase();
    const keywords = (article.keywords || '').toLowerCase();
    const body = article.body.toLowerCase();
    let score = 0;
    qTerms.forEach((t) => {
        if (title.includes(t)) score += 5;
        if (keywords.includes(t)) score += 3;
        if (body.includes(t)) score += 1;
    });
    return score;
}

const REQUEST_TYPES = [
    ['missing_doc', 'Missing from Help'],
    ['feature_request', 'Feature request'],
    ['question', 'Question'],
    ['bug', 'Something is broken'],
];

// An inline request form rendered as a chat message. Submits over XHR so the
// conversation stays put; on success the parent swaps it for a "sent" bubble.
function RequestForm({ query, onSent }) {
    const [type, setType] = useState('missing_doc');
    const [details, setDetails] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);

    const message = details.trim() || query || '';
    const subject = (query || details.trim().slice(0, 80) || 'Request').slice(0, 160);

    const send = () => {
        if (!message) { setError('Add a little detail first.'); return; }
        setSending(true);
        setError(null);
        axios.post(route('feedback.store'), {
            type,
            subject,
            message,
            context: query ? { query } : null,
        }).then(() => onSent()).catch((e) => {
            setError(e.response?.data?.message || 'Could not send — try again.');
            setSending(false);
        });
    };

    return (
        <div className="space-y-2.5">
            <p className="text-sm text-slate-300">Send this to the team and they'll get back to you. {query && <>You searched <span className="text-slate-100">“{query}”</span>.</>}</p>
            <div className="flex flex-wrap gap-1.5">
                {REQUEST_TYPES.map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setType(k)}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition ${type === k ? 'bg-orange-500/20 text-orange-300' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
                        {l}
                    </button>
                ))}
            </div>
            <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={4000}
                autoFocus
                placeholder={query ? 'Add any extra detail (optional)…' : 'What do you need, or what is missing?'}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500/60 focus:outline-none"
            />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <button type="button" onClick={send} disabled={sending}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-600 disabled:opacity-50">
                <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send request'}
            </button>
        </div>
    );
}

function BotBubble({ children }) {
    return (
        <div className="flex gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-orange-400 ring-1 ring-slate-700">
                <LifeBuoy className="h-4 w-4" />
            </span>
            <div className="max-w-[85%] space-y-2 rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900/70 px-4 py-3">
                {children}
            </div>
        </div>
    );
}

function UserBubble({ text }) {
    return (
        <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-orange-500/20 px-4 py-2.5 text-sm text-orange-50">{text}</div>
        </div>
    );
}

export default function Help({ auth, articles = [] }) {
    const [messages, setMessages] = useState([{ id: 'intro', role: 'bot', kind: 'intro' }]);
    const [input, setInput] = useState('');
    const idRef = useRef(1);
    const endRef = useRef(null);
    const nextId = () => `m${idRef.current++}`;

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

    const suggestions = useMemo(
        () => articles.filter((a) => a.title.includes('?') || a.category === 'Schedule').slice(0, 4).map((a) => a.title),
        [articles],
    );

    const ask = (text) => {
        const q = (text || '').trim();
        if (!q) return;
        const qt = terms(q);
        const results = articles
            .map((a) => ({ a, s: scoreArticle(a, qt) }))
            .filter((r) => r.s > 0)
            .sort((x, y) => y.s - x.s || x.a.sort_order - y.a.sort_order)
            .slice(0, 3)
            .map((r) => r.a);

        setMessages((m) => [
            ...m,
            { id: nextId(), role: 'user', text: q },
            results.length
                ? { id: nextId(), role: 'bot', kind: 'results', query: q, articles: results }
                : { id: nextId(), role: 'bot', kind: 'noresults', query: q },
        ]);
        setInput('');
    };

    const startRequest = (query) => setMessages((m) => [...m, { id: nextId(), role: 'bot', kind: 'request', query }]);
    const markSent = (id) => setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, kind: 'sent' } : msg)));

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Help" />

            <PageShell width="max-w-3xl">
                <PageHeader
                    title="Help"
                    description="Ask a question and I'll search our guides. No answer? Send it straight to the team — right here."
                />

                <div className="flex h-[calc(100vh-16rem)] min-h-[26rem] flex-col rounded-2xl border border-slate-800 bg-slate-950/40">
                    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
                        {messages.map((msg) => {
                            if (msg.role === 'user') return <UserBubble key={msg.id} text={msg.text} />;

                            if (msg.kind === 'intro') {
                                return (
                                    <BotBubble key={msg.id}>
                                        <p className="text-sm text-slate-200">Hi {auth.user?.name?.split(' ')[0] || 'there'}! Ask me anything about using SA Track — clocking in, changing your schedule, fixing times. I search our help guides (no AI).</p>
                                        {suggestions.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {suggestions.map((s) => (
                                                    <button key={s} type="button" onClick={() => ask(s)}
                                                        className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white">
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </BotBubble>
                                );
                            }

                            if (msg.kind === 'results') {
                                return (
                                    <BotBubble key={msg.id}>
                                        <p className="text-xs font-medium text-slate-400">Here's what I found:</p>
                                        {msg.articles.map((a) => (
                                            <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                                                <div className="mb-1.5 flex items-center gap-2">
                                                    {a.admin_only && <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />}
                                                    <span className="text-sm font-semibold text-white">{a.title}</span>
                                                </div>
                                                <div className="space-y-2">{renderBody(a.body)}</div>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => startRequest(msg.query)}
                                            className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-300 hover:text-orange-200">
                                            <MessageSquarePlus className="h-3.5 w-3.5" /> Not what you needed? Send a request
                                        </button>
                                    </BotBubble>
                                );
                            }

                            if (msg.kind === 'noresults') {
                                return (
                                    <BotBubble key={msg.id}>
                                        <p className="text-sm text-slate-200">I couldn't find a guide for “{msg.query}”.</p>
                                        <button type="button" onClick={() => startRequest(msg.query)}
                                            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-600">
                                            <MessageSquarePlus className="h-4 w-4" /> Send this to the team
                                        </button>
                                    </BotBubble>
                                );
                            }

                            if (msg.kind === 'request') {
                                return <BotBubble key={msg.id}><RequestForm query={msg.query} onSent={() => markSent(msg.id)} /></BotBubble>;
                            }

                            if (msg.kind === 'sent') {
                                return (
                                    <BotBubble key={msg.id}>
                                        <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Sent! The team will see it in their inbox.</p>
                                        <p className="text-xs text-slate-500">You can track it under “Requests” in the top menu.</p>
                                    </BotBubble>
                                );
                            }

                            return null;
                        })}
                        <div ref={endRef} />
                    </div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); ask(input); }}
                        className="flex items-center gap-2 border-t border-slate-800 px-3 py-3"
                    >
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type your question…"
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-orange-500/60 focus:outline-none"
                            />
                        </div>
                        <button type="submit" disabled={!input.trim()}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-slate-950 transition hover:bg-orange-600 disabled:opacity-40">
                            <Send className="h-4 w-4" />
                        </button>
                    </form>
                </div>
            </PageShell>
        </AuthenticatedLayout>
    );
}
