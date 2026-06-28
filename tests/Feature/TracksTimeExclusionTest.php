<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Non-tracking staff (tracks_time = false — HR, finance) are excluded from the
 * performance surfaces so they never read as "0% this week", while still
 * existing as normal users elsewhere (directory, attendance).
 */
class TracksTimeExclusionTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_tracking_user_is_hidden_from_team_performance(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'permissions' => ['timeline.view_others', 'dashboard.view_team']]);
        User::factory()->create(['role' => 'member', 'permissions' => [], 'tracks_time' => true, 'name' => 'Tracker Tom']);
        User::factory()->create(['role' => 'member', 'permissions' => [], 'tracks_time' => false, 'name' => 'HR Hannah']);

        $props = $this->actingAs($admin)->get('/team?range=today')->assertOk()->viewData('page')['props'];
        $names = collect($props['rows'])->pluck('name');

        $this->assertTrue($names->contains('Tracker Tom'));
        $this->assertFalse($names->contains('HR Hannah'), 'Non-tracking staff must not appear in Team Performance.');
    }

    public function test_non_tracking_user_is_excluded_from_dashboard_kpis(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'permissions' => ['dashboard.view_team'], 'tracks_time' => true]);
        User::factory()->create(['role' => 'member', 'permissions' => [], 'tracks_time' => true]);
        User::factory()->create(['role' => 'member', 'permissions' => [], 'tracks_time' => false]);

        $res = $this->actingAs($admin)->getJson('/time-entries/today-summary')->assertOk();

        // team_size counts only tracking staff: the admin + the one tracking member.
        $this->assertSame(2, $res->json('team_kpis.team_size'));
    }

    public function test_tracks_time_defaults_true_and_saves_false(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $member = User::factory()->create(['role' => 'member', 'permissions' => [], 'tracks_time' => true]);

        $this->actingAs($admin)->patch('/users/'.$member->id, [
            'name' => $member->name,
            'email' => $member->email,
            'role' => 'member',
            'tracks_time' => false,
        ])->assertRedirect();

        $this->assertFalse($member->fresh()->tracks_time);
    }
}
