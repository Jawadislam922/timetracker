<?php

namespace App\Http\Controllers;

use App\Models\FeedbackItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The feedback / request inbox. Anyone can file a request (a question, a feature
 * wish, a bug, or a "the docs didn't answer this" from Help search). Managers
 * with feedback.manage triage them — change status and reply. Regular members
 * only ever see their own submissions and their status.
 */
class FeedbackController extends Controller
{
    private function canManage(Request $request): bool
    {
        $user = $request->user();

        return $user->isSuperAdmin() || $user->hasPermission('feedback.manage');
    }

    public function index(Request $request): Response
    {
        $canManage = $this->canManage($request);

        // Opening the inbox means the submitter has now seen any replies on
        // their own requests — clear their "you have a reply" badge.
        FeedbackItem::unseenFor($request->user()->id)->update(['response_seen_at' => now()]);

        $query = FeedbackItem::with(['user:id,name,avatar', 'handler:id,name'])->latest();

        if ($canManage) {
            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }
            if ($request->filled('type')) {
                $query->where('type', $request->input('type'));
            }
        } else {
            // Members see only their own requests.
            $query->where('user_id', $request->user()->id);
        }

        $items = $query->limit(200)->get()->map(fn (FeedbackItem $f) => [
            'id' => $f->id,
            'type' => $f->type,
            'subject' => $f->subject,
            'message' => $f->message,
            'context' => $f->context,
            'status' => $f->status,
            'response' => $f->response,
            'created_at' => $f->created_at?->toIso8601String(),
            'handled_at' => $f->handled_at?->toIso8601String(),
            'user' => $f->user ? ['id' => $f->user->id, 'name' => $f->user->name, 'avatar_url' => $f->user->avatar_url] : null,
            'handler' => $f->handler ? ['name' => $f->handler->name] : null,
        ]);

        return Inertia::render('Feedback/Index', [
            'items' => $items,
            'canManage' => $canManage,
            'filters' => ['status' => $request->input('status'), 'type' => $request->input('type')],
            'counts' => $canManage ? [
                'new' => FeedbackItem::where('status', 'new')->count(),
                'open' => FeedbackItem::open()->count(),
                'total' => FeedbackItem::count(),
            ] : null,
        ]);
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(FeedbackItem::TYPES)],
            'subject' => ['required', 'string', 'max:160'],
            'message' => ['required', 'string', 'max:4000'],
            'context' => ['nullable', 'array'],
            'context.query' => ['nullable', 'string', 'max:200'],
            'context.url' => ['nullable', 'string', 'max:300'],
        ]);

        $item = FeedbackItem::create([
            'user_id' => $request->user()->id,
            'type' => $data['type'],
            'subject' => $data['subject'],
            'message' => $data['message'],
            'context' => $data['context'] ?? null,
            'status' => 'new',
        ]);

        // The Help chat box submits via XHR and must stay on the page, so answer
        // JSON there; the inbox modal uses a normal Inertia visit (redirect).
        if ($request->wantsJson()) {
            return response()->json(['ok' => true, 'id' => $item->id, 'message' => 'Thanks — your request landed in the team inbox.']);
        }

        return back()->with('success', 'Thanks — your request landed in the team inbox.');
    }

    public function update(Request $request, FeedbackItem $feedback): RedirectResponse
    {
        abort_unless($this->canManage($request), 403);

        $data = $request->validate([
            'status' => ['required', Rule::in(FeedbackItem::STATUSES)],
            'response' => ['nullable', 'string', 'max:4000'],
        ]);

        $feedback->update([
            'status' => $data['status'],
            'response' => $data['response'] ?? $feedback->response,
            'handled_by' => $request->user()->id,
            'handled_at' => now(),
        ]);

        return back()->with('success', 'Request updated.');
    }
}
