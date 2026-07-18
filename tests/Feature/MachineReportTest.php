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
        ], 'extensions');

        $rules = collect($hits)->pluck('rule')->all();
        $this->assertContains('upwork_refresh_bid', $rules);
        $this->assertContains('scraper', $rules);
        $this->assertContains('jiggler_autoclicker', $rules);
        $this->assertContains('vpn_proxy', $rules);
        $this->assertCount(4, $hits, 'only the four automation/VPN tools should flag, not Grammarly/Acrobat/VS Code');
    }

    /**
     * The false positives that made the owner distrust the whole feature:
     * benign tools were flagged as VPNs only because they REQUEST the "proxy"
     * browser permission. Matching must be on the tool NAME, never permissions.
     */
    public function test_benign_tools_that_merely_request_the_proxy_permission_are_not_flagged(): void
    {
        $hits = AutomationBlocklist::scan([
            ['name' => 'Similarweb - Website Traffic, AI Traffic & SEO Checker', 'permissions' => ['proxy', 'tabs', 'webRequest']],
            ['name' => 'IDM Integration Module', 'permissions' => ['proxy', 'downloads']],
            ['name' => 'uBlock Origin', 'permissions' => ['proxy', 'webRequest']],
            ['name' => 'AdGuard AdBlocker', 'permissions' => ['proxy']],
        ], 'extensions');

        $this->assertCount(0, $hits, 'permissions must never drive a flag — only the tool name');
    }

    /** "hola" (Hola VPN) must be a whole word, not a substring of Scholar/Nicholas. */
    public function test_vpn_word_patterns_do_not_match_innocent_substrings(): void
    {
        $hits = AutomationBlocklist::scan([
            ['name' => 'Google Scholar Button'],
            ['name' => 'Nicholas Theme'],
        ], 'extensions');

        $this->assertCount(0, $hits);
    }

    /**
     * Alerting policy: refresh/bid, scrapers, jigglers, antidetect browsers AND
     * VPNs alert. Dev/QA automation frameworks stay watch-only (legitimate on an
     * engineering machine).
     */
    public function test_alerting_policy_per_category(): void
    {
        $hits = collect(AutomationBlocklist::scan([
            ['name' => 'Easy Auto Refresh'],
            ['name' => 'Instant Data Scraper'],
            ['name' => 'OP Auto Clicker'],
            ['name' => 'NordVPN'],
            ['name' => 'GoLogin'],
            ['name' => 'Selenium IDE'],
        ], 'extensions'))->keyBy('rule');

        $this->assertTrue($hits['upwork_refresh_bid']['alert']);
        $this->assertTrue($hits['scraper']['alert']);
        $this->assertTrue($hits['jiggler_autoclicker']['alert']);
        $this->assertTrue($hits['vpn_proxy']['alert'], 'VPNs alert for now (owner is verifying client use)');
        $this->assertTrue($hits['antidetect_browser']['alert'], 'antidetect browsers are a hard Upwork ban risk');
        $this->assertSame('antidetect_browser', $hits['antidetect_browser']['rule']);
        $this->assertFalse($hits['automation_framework']['alert'], 'dev/QA tooling is watch-only');
    }

    /** Watch-only tooling (dev/QA automation) is stored for review but never alerts. */
    public function test_watch_only_tooling_is_recorded_but_does_not_alert(): void
    {
        $user = User::factory()->create(['name' => 'Sana Malik']);
        Sanctum::actingAs($user, ['desktop-tracker']);

        $this->postJson('/api/desktop/machine-report', [
            'device_name' => 'PC-VPN-1',
            'app_version' => '0.4.6',
            'platform' => 'win32',
            'reports' => [
                ['kind' => 'extensions', 'items' => [
                    ['name' => 'Selenium IDE', 'id' => 'sel'],                      // watch only
                    ['name' => 'Auto Refresh Plus | Page Monitor', 'id' => 'arp'],  // alerts
                ]],
            ],
        ])->assertOk()->assertJson(['flagged' => 1]); // only the refresh tool alerts

        $ext = MachineReport::where('device_name', 'PC-VPN-1')->where('kind', 'extensions')->first();
        $this->assertSame(2, $ext->flagged_count, 'both are recorded for review');
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

    /** A still-installed tool alerts once, not on every hourly re-upload. */
    public function test_a_banning_tool_alerts_once_then_stays_quiet_until_removed_and_reinstalled(): void
    {
        $user = User::factory()->create(['name' => 'Bilal Raza']);
        Sanctum::actingAs($user, ['desktop-tracker']);

        $withTool = ['device_name' => 'PC-Q-1', 'reports' => [
            ['kind' => 'extensions', 'items' => [['name' => 'Easy Auto Refresh', 'id' => 'ear1']]],
        ]];
        $withoutTool = ['device_name' => 'PC-Q-1', 'reports' => [
            ['kind' => 'extensions', 'items' => [['name' => 'uBlock Origin', 'id' => 'ub1']]],
        ]];

        // First sighting alerts.
        $this->postJson('/api/desktop/machine-report', $withTool)->assertJson(['flagged' => 1]);
        // Same tool re-uploaded → no new alert.
        $this->postJson('/api/desktop/machine-report', $withTool)->assertJson(['flagged' => 0]);

        $flag = \App\Models\MachineFlag::where('label', 'Easy Auto Refresh')->first();
        $this->assertSame('open', $flag->status);

        // Tool removed → flag auto-resolves.
        $this->postJson('/api/desktop/machine-report', $withoutTool)->assertJson(['flagged' => 0]);
        $this->assertSame('resolved', $flag->fresh()->status);

        // Reinstalled later → alerts again (install detection).
        $this->postJson('/api/desktop/machine-report', $withTool)->assertJson(['flagged' => 1]);
        $this->assertSame('open', $flag->fresh()->status);
    }

    /** An ignored tool never alerts again, and is not auto-resolved when it disappears. */
    public function test_ignored_tool_stays_silent(): void
    {
        $user = User::factory()->create(['name' => 'Hira Aslam']);
        Sanctum::actingAs($user, ['desktop-tracker']);

        $payload = ['device_name' => 'PC-IG-1', 'reports' => [
            ['kind' => 'extensions', 'items' => [['name' => 'OP Auto Clicker', 'id' => 'opac']]],
        ]];

        $this->postJson('/api/desktop/machine-report', $payload)->assertJson(['flagged' => 1]);

        \App\Models\MachineFlag::where('label', 'OP Auto Clicker')->update(['status' => 'ignored']);

        // Re-upload while ignored → silent.
        $this->postJson('/api/desktop/machine-report', $payload)->assertJson(['flagged' => 0]);
        $this->assertSame('ignored', \App\Models\MachineFlag::where('label', 'OP Auto Clicker')->first()->status);
    }
}
