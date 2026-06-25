<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The manual-entry form fetches the day's open gaps from this endpoint to offer
 * fillable suggestions.
 */
class WorkHourGapsEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_gaps_endpoint_returns_the_users_open_gaps(): void
    {
        $user = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $date = '2026-06-20';
        foreach (['clock_in' => '09:00', 'clock_out' => '12:00'] as $type => $time) {
            $ts = Carbon::parse("$date $time", 'Asia/Karachi');
            TimeEntry::create([
                'user_id' => $user->id, 'action_type' => $type,
                'action_timestamp' => $ts, 'action_date' => $date, 'action_time' => $ts->toTimeString(),
            ]);
        }

        $this->actingAs($user)
            ->getJson(route('work-hours.gaps', ['date' => $date]))
            ->assertOk()
            ->assertJsonPath('gaps.0.start', '09:00')
            ->assertJsonPath('gaps.0.end', '12:00')
            ->assertJsonPath('gaps.0.minutes', 180);
    }
}
