<?php

namespace Tests\Feature;

use App\Models\MachineFlag;
use App\Models\MachineReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * The tool-first compliance dashboard: flagged tools grouped across people
 * (one row → who has it), with Acknowledge / Ignore, and per-machine delete.
 */
class ComplianceDashboardTest extends TestCase
{
    use RefreshDatabase;

    private function flag(User $u, string $device, array $over = []): MachineFlag
    {
        return MachineFlag::create(array_merge([
            'user_id' => $u->id, 'device_name' => $device, 'kind' => 'extensions',
            'rule' => 'scraper', 'severity' => 'critical', 'alert' => true,
            'label' => 'Instant Data Scraper', 'signature' => md5($u->id.$device.'ids'),
            'status' => 'open', 'first_seen_at' => now(), 'last_seen_at' => now(),
        ], $over));
    }

    /**
     * One tool in several of a person's browser profiles is ONE row listing them all,
     * and a single Acknowledge clears every profile behind it. Four near-identical
     * rows differing only in the profile column is what made the page unreadable.
     */
    public function test_multi_profile_findings_collapse_to_one_row_and_acknowledge_together(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $jawad = User::factory()->create(['name' => 'Jawad']);

        $f1 = $this->flag($jawad, 'PC-1', ['browser_profile' => 'Upwork Faryal', 'signature' => 's1']);
        $f2 = $this->flag($jawad, 'PC-1', ['browser_profile' => 'Upwork Junaid', 'signature' => 's2']);
        $f3 = $this->flag($jawad, 'PC-1', ['browser_profile' => 'Your Chrome', 'signature' => 's3']);

        $this->actingAs($admin)->get('/monitoring/compliance')
            ->assertOk()
            ->assertInertia(fn ($p) => $p
                ->where('tools.0.occurrences', fn ($occ) => count($occ) === 1)
                ->where('tools.0.occurrences.0.profiles', ['Upwork Faryal', 'Upwork Junaid', 'Your Chrome'])
                ->where('tools.0.profiles', 3)
                ->etc());

        // One Acknowledge, passing every id on the row, clears all three profiles.
        $this->actingAs($admin)->patch(route('monitoring.compliance.flag', $f1), [
            'status' => 'acknowledged',
            'ids' => [$f1->id, $f2->id, $f3->id],
        ])->assertRedirect();

        $this->assertSame(3, MachineFlag::where('status', 'acknowledged')->count());
    }

    /** A crafted id list cannot reach another machine's ledger rows. */
    public function test_bulk_acknowledge_cannot_touch_another_machine(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $a = User::factory()->create(['name' => 'Ali']);
        $b = User::factory()->create(['name' => 'Bina']);

        $mine = $this->flag($a, 'PC-1', ['browser_profile' => 'Upwork Faryal', 'signature' => 'm1']);
        $theirs = $this->flag($b, 'PC-2', ['browser_profile' => 'Upwork Nimra', 'signature' => 't1']);

        $this->actingAs($admin)->patch(route('monitoring.compliance.flag', $mine), [
            'status' => 'ignored',
            'ids' => [$mine->id, $theirs->id],
        ])->assertRedirect();

        $this->assertSame('ignored', $mine->fresh()->status);
        $this->assertSame('open', $theirs->fresh()->status, 'another machine must be untouched');
    }

    public function test_flags_are_grouped_by_tool_with_who_has_it(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $a = User::factory()->create(['name' => 'Ali']);
        $b = User::factory()->create(['name' => 'Bina']);

        $this->flag($a, 'PC-1');
        $this->flag($b, 'PC-2', ['signature' => 'sig-b']);
        // A watch-only VPN on one machine.
        $this->flag($a, 'PC-1', [
            'rule' => 'vpn_proxy', 'severity' => 'high', 'alert' => false,
            'label' => 'NordVPN', 'signature' => 'sig-vpn',
        ]);

        $this->actingAs($admin)->get('/monitoring/compliance')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Monitoring/Compliance')
                ->where('summary.open_alerts', 2)   // scraper on 2 machines
                ->where('summary.watch', 1)          // one VPN
                ->has('tools', 2)
                ->where('tools.0.name', 'Instant Data Scraper')  // banning sorts first
                ->where('tools.0.people', 2)
                ->where('tools.0.alert', true)
                ->where('tools.1.name', 'NordVPN')
                ->where('tools.1.alert', false)
            );
    }

    public function test_employees_list_their_enabled_extensions(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $ali = User::factory()->create(['name' => 'Ali']);
        $bina = User::factory()->create(['name' => 'Bina']);

        MachineReport::create([
            'user_id' => $ali->id, 'device_name' => 'PC-ALI', 'kind' => 'extensions', 'collected_at' => now(),
            'items' => [
                ['name' => 'Instant Data Scraper', 'browser' => 'Chrome', 'enabled' => true],
                ['name' => 'uBlock Origin', 'browser' => 'Chrome', 'enabled' => true],
            ],
            'item_count' => 2, 'flagged_count' => 1,
        ]);
        // Programs count toward the same person — this is what made "Bitdefender VPN
        // on 13 people" impossible to reconcile with an extensions-only view.
        MachineReport::create([
            'user_id' => $ali->id, 'device_name' => 'PC-ALI', 'kind' => 'programs', 'collected_at' => now(),
            'items' => [['name' => 'NordVPN', 'publisher' => 'NordVPN s.a.']],
            'item_count' => 1, 'flagged_count' => 1,
        ]);
        MachineReport::create([
            'user_id' => $bina->id, 'device_name' => 'PC-BINA', 'kind' => 'extensions', 'collected_at' => now(),
            'items' => [['name' => 'Grammarly', 'browser' => 'Edge', 'enabled' => true]],
            'item_count' => 1, 'flagged_count' => 0,
        ]);

        $this->actingAs($admin)->get('/monitoring/compliance')
            ->assertInertia(fn (Assert $page) => $page
                ->has('employees', 2)
                ->where('employees.0.user', 'Ali')            // most-flagged person sorts first
                ->where('employees.0.flagged', 2)             // scraper extension + NordVPN program
                ->where('employees.0.count', 3)               // extensions AND programs
                ->where('employees.0.extension_count', 2)
                ->where('employees.0.program_count', 1)
                ->where('employees.0.extensions.0.flagged', true) // flagged items sort first
                ->where('employees.1.user', 'Bina')
            );
    }

    public function test_manager_can_acknowledge_and_ignore_a_flag(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $flag = $this->flag(User::factory()->create(), 'PC-9');

        $this->actingAs($admin)->patch(route('monitoring.compliance.flag', $flag), ['status' => 'acknowledged'])
            ->assertRedirect();
        $this->assertSame('acknowledged', $flag->fresh()->status);
        $this->assertSame($admin->id, $flag->fresh()->acknowledged_by);

        $this->actingAs($admin)->patch(route('monitoring.compliance.flag', $flag), ['status' => 'ignored']);
        $this->assertSame('ignored', $flag->fresh()->status);
    }

    public function test_manager_can_delete_a_machines_history(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $u = User::factory()->create();
        $this->flag($u, 'PC-DEL');
        MachineReport::create([
            'user_id' => $u->id, 'device_name' => 'PC-DEL', 'kind' => 'extensions',
            'collected_at' => now(), 'items' => [], 'item_count' => 0, 'flagged_count' => 0,
        ]);

        $this->actingAs($admin)->delete(route('monitoring.compliance.machine.destroy'), [
            'user_id' => $u->id, 'device_name' => 'PC-DEL',
        ])->assertRedirect();

        $this->assertSame(0, MachineFlag::where('device_name', 'PC-DEL')->count());
        $this->assertSame(0, MachineReport::where('device_name', 'PC-DEL')->count());
    }
}
