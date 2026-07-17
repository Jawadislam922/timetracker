<?php

namespace Tests\Feature;

use App\Models\MachineReport;
use App\Models\User;
use App\Support\AutomationBlocklist;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Endpoint compliance inventory: the agent uploads installed extensions /
 * programs, the server matches them against the automation blocklist, and the
 * exact tools that get an Upwork profile banned (refresh tools, scrapers,
 * jigglers, VPNs) are flagged for the dashboard.
 */
class MachineReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_blocklist_flags_the_upwork_dangerous_tools_and_leaves_normal_apps_alone(): void
    {
        $hits = AutomationBlocklist::scan([
            ['name' => 'Easy Auto Refresh'],
            ['name' => 'Instant Data Scraper', 'id' => 'ofaokhiedipichpaobibbnahnkdoiiah'],
            ['name' => 'OP Auto Clicker'],
            ['name' => 'Browsec VPN'],
            ['name' => 'Grammarly for Chrome'],
            ['name' => 'Adobe Acrobat'],
            ['name' => 'Visual Studio Code'],
        ]);

        $rules = collect($hits)->pluck('rule')->all();
        $this->assertContains('upwork_refresh_bid', $rules);
        $this->assertContains('scraper', $rules);
        $this->assertContains('jiggler_autoclicker', $rules);
        $this->assertContains('vpn_proxy', $rules);
        $this->assertCount(4, $hits, 'only the four automation/VPN tools should flag, not Grammarly/Acrobat/VS Code');
    }

    public function test_agent_uploads_inventory_and_it_is_stored_with_flags(): void
    {
        $user = User::factory()->create(['name' => 'Waqar Ahmed']);
        Sanctum::actingAs($user, ['desktop-tracker']);

        $this->postJson('/api/desktop/machine-report', [
            'device_name' => 'PC-GD-2',
            'app_version' => '0.4.4',
            'platform' => 'win32',
            'reports' => [
                ['kind' => 'extensions', 'collected_at' => '2026-07-17T08:00:00Z', 'items' => [
                    ['name' => 'Easy Auto Refresh', 'id' => 'aabcefg', 'permissions' => ['tabs', 'https://www.upwork.com/*']],
                    ['name' => 'uBlock Origin', 'id' => 'zzz'],
                ]],
                ['kind' => 'programs', 'collected_at' => '2026-07-17T08:00:00Z', 'items' => [
                    ['name' => 'Google Chrome', 'publisher' => 'Google'],
                    ['name' => 'Slack', 'publisher' => 'Slack'],
                ]],
            ],
        ])->assertOk()->assertJson(['stored' => 2, 'flagged' => 1]);

        $ext = MachineReport::where('device_name', 'PC-GD-2')->where('kind', 'extensions')->first();
        $this->assertSame(2, $ext->item_count);
        $this->assertSame(1, $ext->flagged_count);
        $this->assertSame('Easy Auto Refresh', $ext->flagged[0]['name']);
        $this->assertSame('upwork_refresh_bid', $ext->flagged[0]['rule']);

        $prog = MachineReport::where('device_name', 'PC-GD-2')->where('kind', 'programs')->first();
        $this->assertSame(0, $prog->flagged_count);
    }
}
