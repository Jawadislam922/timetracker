<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Diagnostics;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The desktop tracker uploads client-side errors/telemetry (capture failures,
 * pause/break transitions, crashes) so machine problems are visible server-side.
 */
class DesktopDiagnosticsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        File::deleteDirectory(Diagnostics::dir('desktop'));
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(Diagnostics::dir('desktop'));
        parent::tearDown();
    }

    public function test_desktop_uploads_telemetry_into_the_diagnostics_store(): void
    {
        $user = User::factory()->create(['name' => 'Asim Khan']);
        Sanctum::actingAs($user, ['desktop-tracker']);

        $this->postJson('/api/desktop/diagnostics', [
            'device_name' => 'PC-CW-2',
            'events' => [
                ['level' => 'warn', 'event' => 'screenshot_capture_failed', 'message' => 'access denied',
                    'context' => ['where' => 'scheduled'], 'at' => '2026-07-08T20:00:00Z', 'app_version' => '0.4.3', 'platform' => 'win32'],
                ['level' => 'info', 'event' => 'break_detected', 'message' => 'pausing tracker'],
            ],
        ])->assertOk()->assertJson(['stored' => 2]);

        $files = File::files(Diagnostics::dir('desktop'));
        $this->assertCount(2, $files);
        $snaps = collect($files)->map(fn ($f) => json_decode(File::get($f->getPathname()), true));
        $this->assertTrue($snaps->contains(fn ($s) => $s['event'] === 'screenshot_capture_failed' && $s['device_name'] === 'PC-CW-2'));
        $this->assertTrue($snaps->contains(fn ($s) => ($s['user']['name'] ?? null) === 'Asim Khan'));
    }

    public function test_it_rejects_a_bad_level(): void
    {
        Sanctum::actingAs(User::factory()->create(), ['desktop-tracker']);

        $this->postJson('/api/desktop/diagnostics', [
            'events' => [['level' => 'nope', 'event' => 'x']],
        ])->assertStatus(422);
    }
}
