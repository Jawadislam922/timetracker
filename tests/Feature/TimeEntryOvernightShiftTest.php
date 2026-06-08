<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TimeEntryOvernightShiftTest extends TestCase
{
    use RefreshDatabase;

    public function test_post_midnight_action_stays_with_the_shift_start_date(): void
    {
        $employee = User::factory()->create([
            'shift_start_time' => '16:00:00',
        ]);

        Carbon::setTestNow(Carbon::parse('2026-06-09 16:00:00', 'Asia/Karachi'));

        $this->actingAs($employee)
            ->postJson(route('time-entries.store'), ['action_type' => 'clock_in'])
            ->assertOk();

        Carbon::setTestNow(Carbon::parse('2026-06-10 01:00:00', 'Asia/Karachi'));

        $this->actingAs($employee)
            ->getJson(route('time-entries.today-summary'))
            ->assertOk()
            ->assertJsonPath('employees.0.total_work_hours', 9);

        $this->actingAs($employee)
            ->postJson(route('time-entries.store'), ['action_type' => 'clock_out'])
            ->assertOk();

        $entries = TimeEntry::query()->orderBy('action_timestamp')->get();

        $this->assertCount(2, $entries);
        $this->assertSame('2026-06-09', $entries[0]->action_date->toDateString());
        $this->assertSame('2026-06-09', $entries[1]->action_date->toDateString());

        $this->actingAs($employee)
            ->getJson(route('time-entries.today'))
            ->assertOk()
            ->assertJsonCount(2, 'entries');

        $this->actingAs($employee)
            ->getJson(route('time-entries.today-summary'))
            ->assertOk()
            ->assertJsonPath('employees.0.total_entries', 2);

        Carbon::setTestNow();
    }

    public function test_unrelated_early_action_is_not_moved_to_the_previous_shift_date(): void
    {
        $employee = User::factory()->create([
            'shift_start_time' => '16:00:00',
        ]);

        Carbon::setTestNow(Carbon::parse('2026-06-10 11:00:00', 'Asia/Karachi'));

        $this->actingAs($employee)
            ->postJson(route('time-entries.store'), ['action_type' => 'clock_in'])
            ->assertOk();

        $entry = TimeEntry::query()->firstOrFail();

        $this->assertSame('2026-06-10', $entry->action_date->toDateString());

        Carbon::setTestNow();
    }
}
