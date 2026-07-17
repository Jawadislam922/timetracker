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
                ['name' => 'Old Disabled Thing', 'browser' => 'Chrome', 'enabled' => false],
            ],
            'item_count' => 3, 'flagged_count' => 1,
        ]);
        MachineReport::create([
            'user_id' => $bina->id, 'device_name' => 'PC-BINA', 'kind' => 'extensions', 'collected_at' => now(),
            'items' => [['name' => 'Grammarly', 'browser' => 'Edge', 'enabled' => true]],
            'item_count' => 1, 'flagged_count' => 0,
        ]);

        $this->actingAs($admin)->get('/monitoring/compliance')
            ->assertInertia(fn (Assert $page) => $page
                ->has('employees', 2)
                ->where('employees.0.user', 'Ali')          // flagged person sorts first
                ->where('employees.0.flagged', 1)
                ->where('employees.0.count', 2)              // enabled only — disabled one excluded
                ->where('employees.0.extensions.0.name', 'Instant Data Scraper') // flagged ext first
                ->where('employees.0.extensions.0.flagged', true)
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
