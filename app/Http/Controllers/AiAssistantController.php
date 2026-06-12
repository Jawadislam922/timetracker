<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\WorkHour;
use App\Services\AnthropicService;
use App\Support\BusinessTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Manager chat over the team's recent work data. The model only ever sees
 * an aggregated 14-day data pack (no screenshots, no raw timestamps), and
 * access mirrors the Reports permission.
 */
class AiAssistantController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('AiAssistant', [
            'aiEnabled' => app(AnthropicService::class)->configured(),
        ]);
    }

    public function ask(Request $request): JsonResponse
    {
        $ai = app(AnthropicService::class);

        if (! $ai->configured()) {
            return response()->json(['message' => 'AI is not configured — add the Anthropic key on the Developer page.'], 422);
        }

        $data = $request->validate([
            'messages' => ['required', 'array', 'min:1', 'max:12'],
            'messages.*.role' => ['required', Rule::in(['user', 'assistant'])],
            'messages.*.content' => ['required', 'string', 'max:2000'],
        ]);

        $reply = $ai->chat($data['messages'], $this->systemPrompt(), 1200);

        if ($reply === null) {
            return response()->json(['message' => 'The assistant could not answer right now — try again in a minute.'], 503);
        }

        return response()->json(['reply' => $reply]);
    }

    private function systemPrompt(): string
    {
        $pack = Cache::remember('ai-assistant-datapack', now()->addMinutes(10), fn () => $this->dataPack());

        return "You are the SA Track analytics assistant for managers at Sparking Asia, a digital agency. "
            ."Answer questions about the team's tracked work using ONLY the data below (the last 14 days, "
            ."hours from the work diary). If asked about anything outside this window or data, say so plainly. "
            ."Times are written as decimal hours; present them as e.g. '7h 30m'. Dates are Y-m-d in Asia/Karachi. "
            ."Plain text only — short paragraphs or simple dash lists, no markdown headers or tables. Be concise "
            ."and factual; never invent people, clients, or numbers.\n\n".$pack;
    }

    private function dataPack(): string
    {
        $end = BusinessTime::today();
        $start = $end->copy()->subDays(13);

        $users = User::orderBy('name')->get(['id', 'name', 'designation', 'shift_start_time']);

        $hours = WorkHour::with('client:id,name')
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->get(['id', 'user_id', 'client_id', 'date', 'hours', 'work_type']);

        $byUser = $hours->groupBy('user_id');

        $lines = ["RANGE: {$start->toDateString()} to {$end->toDateString()}"];

        foreach ($users as $user) {
            $rows = $byUser->get($user->id);
            if (! $rows || $rows->isEmpty()) {
                continue;
            }

            $total = round($rows->sum('hours'), 1);
            $days = $rows->groupBy(fn ($r) => $r->date->toDateString())
                ->map(fn ($g) => round($g->sum('hours'), 1))
                ->sortKeys()
                ->map(fn ($h, $d) => substr($d, 5).'='.$h)
                ->implode(' ');
            $clients = $rows->groupBy(fn ($r) => $r->client?->name ?: ucfirst(str_replace('_', ' ', $r->work_type)))
                ->map(fn ($g) => round($g->sum('hours'), 1))
                ->sortDesc()
                ->take(5)
                ->map(fn ($h, $c) => "{$c} {$h}h")
                ->implode(', ');

            $shift = $user->shift_start_time ? $user->shift_start_time->format('H:i') : 'no shift set';
            $lines[] = "{$user->name} ({$user->designation}, shift {$shift}): total {$total}h | days: {$days} | top: {$clients}";
        }

        $clientTotals = $hours->groupBy(fn ($r) => $r->client?->name ?: ucfirst(str_replace('_', ' ', $r->work_type)))
            ->map(fn ($g) => round($g->sum('hours'), 1))
            ->sortDesc()
            ->take(20)
            ->map(fn ($h, $c) => "{$c} {$h}h")
            ->implode(', ');
        $lines[] = "TEAM CLIENT TOTALS: {$clientTotals}";

        // Hard cap so an unexpectedly large team can never blow up the prompt.
        return substr(implode("\n", $lines), 0, 24000);
    }
}
