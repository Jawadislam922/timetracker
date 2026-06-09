<?php

namespace Tests\Feature;

use App\Jobs\GenerateScreenshotThumbnail;
use App\Models\Client;
use App\Models\TrackingActivitySample;
use App\Models\TrackingScreenshot;
use App\Models\TrackingSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DesktopApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_desktop_login_issues_token_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'tester@example.com',
            'password' => bcrypt('secret-pass-123'),
        ]);

        $this->postJson('/api/desktop/login', [
            'email' => 'tester@example.com',
            'password' => 'secret-pass-123',
            'device_name' => 'Test Device',
        ])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role']]);

        $this->assertSame(1, $user->tokens()->count());
    }

    public function test_desktop_login_rejects_bad_credentials(): void
    {
        User::factory()->create([
            'email' => 'tester@example.com',
            'password' => bcrypt('secret-pass-123'),
        ]);

        $this->postJson('/api/desktop/login', [
            'email' => 'tester@example.com',
            'password' => 'wrong',
            'device_name' => 'Test Device',
        ])->assertStatus(422);
    }

    public function test_me_endpoint_requires_token(): void
    {
        $this->getJson('/api/desktop/me')->assertUnauthorized();
    }

    public function test_session_start_is_idempotent_per_client_uuid(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user, ['desktop-tracker']);

        $payload = [
            'client_uuid' => 'uuid-aaaa',
            'started_at' => now()->toIso8601String(),
            'work_type' => 'tracker_manual',
            'task_note' => 'Initial task',
            'device_name' => 'Test Device',
            'platform' => 'win32',
            'app_version' => '0.1.0',
        ];

        $first = $this->postJson('/api/desktop/sessions/start', $payload)->assertStatus(201);
        $second = $this->postJson('/api/desktop/sessions/start', $payload)->assertStatus(201);

        $this->assertSame($first->json('id'), $second->json('id'));
        $this->assertSame(1, TrackingSession::count());
    }

    public function test_heartbeat_and_stop_update_session(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user, ['desktop-tracker']);

        $start = $this->postJson('/api/desktop/sessions/start', [
            'client_uuid' => 'uuid-bbbb',
            'started_at' => now()->subMinutes(30)->toIso8601String(),
        ])->assertStatus(201);

        $sessionId = $start->json('id');

        $this->patchJson("/api/desktop/sessions/{$sessionId}/heartbeat", [
            'total_seconds' => 600,
            'activity_percent' => 42,
        ])->assertOk();

        $this->postJson("/api/desktop/sessions/{$sessionId}/stop", [
            'stopped_at' => now()->toIso8601String(),
            'total_seconds' => 1800,
            'activity_percent' => 55,
            'task_note' => 'Wrapped up',
        ])->assertOk();

        $session = TrackingSession::find($sessionId);
        $this->assertSame('stopped', $session->status);
        $this->assertSame(1800, $session->total_seconds);
        $this->assertSame(55, $session->activity_percent);
        $this->assertSame('Wrapped up', $session->task_note);
    }

    public function test_screenshot_upload_persists_file_and_dispatches_thumbnail_job(): void
    {
        Storage::fake('screenshots');
        Bus::fake();

        $user = User::factory()->create();
        Sanctum::actingAs($user, ['desktop-tracker']);

        $session = TrackingSession::create([
            'user_id' => $user->id,
            'client_uuid' => 'uuid-cccc',
            'started_at' => now(),
            'status' => 'active',
            'source' => 'desktop',
        ]);

        $response = $this->postJson('/api/desktop/screenshots', [
            'tracking_session_id' => $session->id,
            'captured_at' => now()->toIso8601String(),
            'image' => UploadedFile::fake()->image('shot.jpg', 800, 600),
            'activity_percent' => 70,
            'keyboard_count' => 12,
            'mouse_count' => 30,
            'active_app' => 'Code.exe',
            'active_window_title' => 'tests/DesktopApiTest.php',
            'url_domain' => null,
        ])->assertStatus(201);

        $screenshot = TrackingScreenshot::find($response->json('id'));
        $this->assertNotNull($screenshot);
        Storage::disk('screenshots')->assertExists($screenshot->image_path);
        Bus::assertDispatched(GenerateScreenshotThumbnail::class);
    }

    public function test_screenshot_upload_rejects_other_users_session(): void
    {
        Storage::fake('screenshots');

        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $session = TrackingSession::create([
            'user_id' => $owner->id,
            'client_uuid' => 'uuid-dddd',
            'started_at' => now(),
            'status' => 'active',
            'source' => 'desktop',
        ]);

        Sanctum::actingAs($intruder, ['desktop-tracker']);

        $this->postJson('/api/desktop/screenshots', [
            'tracking_session_id' => $session->id,
            'captured_at' => now()->toIso8601String(),
            'image' => UploadedFile::fake()->image('shot.jpg'),
        ])->assertForbidden();
    }

    public function test_activity_batch_inserts_samples(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user, ['desktop-tracker']);

        $session = TrackingSession::create([
            'user_id' => $user->id,
            'client_uuid' => 'uuid-eeee',
            'started_at' => now(),
            'status' => 'active',
            'source' => 'desktop',
        ]);

        $this->postJson('/api/desktop/activity/batch', [
            'tracking_session_id' => $session->id,
            'samples' => [
                [
                    'captured_at' => now()->toIso8601String(),
                    'keyboard_count' => 5,
                    'mouse_count' => 8,
                    'idle_seconds' => 0,
                    'active_app' => 'Code.exe',
                ],
                [
                    'captured_at' => now()->addMinute()->toIso8601String(),
                    'keyboard_count' => 0,
                    'mouse_count' => 0,
                    'idle_seconds' => 60,
                ],
            ],
        ])->assertStatus(201)->assertJson(['accepted' => 2]);

        $this->assertSame(2, TrackingActivitySample::count());
    }

    public function test_meta_endpoints_return_data(): void
    {
        $user = User::factory()->create();
        Client::create(['name' => 'Acme Co', 'work_type' => 'tracker_manual']);

        Sanctum::actingAs($user, ['desktop-tracker']);

        $this->getJson('/api/desktop/clients')->assertOk()->assertJsonStructure(['clients']);
        $this->getJson('/api/desktop/work-types')->assertOk()->assertJsonStructure(['work_types']);
        $this->getJson('/api/desktop/settings')
            ->assertOk()
            ->assertJsonStructure(['settings' => [
                'screenshot_interval_min_seconds',
                'screenshot_interval_max_seconds',
                'idle_threshold_seconds',
                'activity_sample_interval_seconds',
                'capture_enabled',
            ]]);
    }
}
