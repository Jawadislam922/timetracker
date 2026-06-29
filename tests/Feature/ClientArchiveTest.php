<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\User;
use App\Models\WorkHour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Archiving a client (finished contract) removes it from the pickers used to
 * log NEW work, but it stays visible on existing entries and in history, and
 * an entry that already references a now-archived client keeps it on edit.
 */
class ClientArchiveTest extends TestCase
{
    use RefreshDatabase;

    private function manualPayload(array $over = []): array
    {
        return array_merge([
            'date' => '2026-06-23',
            'hours' => 3,
            'minutes' => 0,
            'description' => 'manual entry',
            'work_type' => 'fixed',
            'client_id' => null,
            'tracker' => null,
        ], $over);
    }

    public function test_store_rejects_an_archived_client_for_new_work(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin']);
        $archived = Client::create(['name' => 'Old Co', 'work_type' => 'fixed', 'is_active' => false]);

        $this->actingAs($admin)
            ->post(route('work-hours.store'), $this->manualPayload(['client_id' => $archived->id]))
            ->assertSessionHasErrors('client_id');

        $this->assertDatabaseMissing('work_hours', ['client_id' => $archived->id]);
    }

    public function test_create_picker_lists_active_clients_only(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin']);
        $active = Client::create(['name' => 'Active Co', 'work_type' => 'fixed', 'is_active' => true]);
        $archived = Client::create(['name' => 'Old Co', 'work_type' => 'fixed', 'is_active' => false]);

        $this->actingAs($admin)->get(route('work-hours.create'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('WorkHourCreate')
                ->where('clients', fn ($clients) => collect($clients)->pluck('id')->contains($active->id)
                    && collect($clients)->pluck('id')->doesntContain($archived->id)));
    }

    public function test_edit_keeps_the_entrys_own_archived_client(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin']);
        $archived = Client::create(['name' => 'Old Co', 'work_type' => 'fixed', 'is_active' => false]);
        $wh = WorkHour::create([
            'user_id' => $admin->id, 'date' => '2026-06-23', 'hours' => 2.0,
            'description' => 'past work', 'work_type' => 'fixed', 'source' => 'manual',
            'client_id' => $archived->id,
        ]);

        $this->actingAs($admin)->get(route('work-hours.edit', $wh))
            ->assertInertia(fn (Assert $page) => $page
                ->component('WorkHourEdit')
                ->where('clients', fn ($clients) => collect($clients)->pluck('id')->contains($archived->id)));
    }

    public function test_set_status_archives_and_restores_a_client(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin']);
        $client = Client::create(['name' => 'Co', 'work_type' => 'fixed', 'is_active' => true]);

        $this->actingAs($admin)->patch(route('clients.set-status', $client), ['is_active' => false])->assertRedirect();
        $this->assertFalse($client->fresh()->is_active);

        $this->actingAs($admin)->patch(route('clients.set-status', $client), ['is_active' => true])->assertRedirect();
        $this->assertTrue($client->fresh()->is_active);
    }

    public function test_desktop_client_picker_excludes_archived_clients(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $active = Client::create(['name' => 'Active Co', 'work_type' => 'fixed', 'is_active' => true]);
        $archived = Client::create(['name' => 'Old Co', 'work_type' => 'fixed', 'is_active' => false]);
        $token = $user->createToken('laptop', ['desktop-tracker'])->plainTextToken;

        $res = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson(route('desktop.clients'))->assertOk();

        $ids = collect($res->json('clients'))->pluck('id');
        $this->assertTrue($ids->contains($active->id));
        $this->assertFalse($ids->contains($archived->id));
    }
}
