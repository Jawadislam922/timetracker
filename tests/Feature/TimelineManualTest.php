<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WorkHour;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Manually-added clock windows surface on the Timeline as their own
 * "Manually added" blocks and a blue band, without being folded into the
 * tracker day total.
 */
class TimelineManualTest extends TestCase
{
    use RefreshDatabase;

    public function test_manual_window_renders_as_a_manual_block_and_band(): void
    {
        $user = User::factory()->create();
        $tz = config('app.timezone');
        $day = '2026-06-23';

        $wh = WorkHour::create([
            'user_id' => $user->id, 'date' => $day, 'hours' => 1.0,
            'description' => 'Logged offline work', 'work_type' => 'manual', 'source' => 'manual',
        ]);
        $wh->windows()->create([
            'start_at' => Carbon::parse("$day 14:00:00", $tz),
            'end_at' => Carbon::parse("$day 15:00:00", $tz),
        ]);

        $this->actingAs($user)
            ->get("/timeline?date=$day")
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('initialData.sessions', 1)
                ->where('initialData.sessions.0.is_manual', true)
                ->where('initialData.sessions.0.id', fn ($id) => str_starts_with((string) $id, 'manual-'))
                ->where('initialData.sessions.0.task_note', 'Logged offline work')
                // Display-only: not added to the tracker day total.
                ->where('initialData.totals.day', 0)
                // The 14:00–15:00 window shades 10 six-minute slots blue.
                ->where('initialData.activity_bands', fn ($bands) => collect($bands)
                    ->where('state', 'manual')->count() === 10)
            );
    }
}
