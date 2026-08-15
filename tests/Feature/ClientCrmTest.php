<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * The client section as a small CRM: contact fields, duplicate prevention on
 * create/rename, and an archived-aware default list.
 *
 * The duplicate guard exists because production accumulated three separate
 * clients named "Brad Pugh" — nothing ever checked, and their mixed hours took
 * a filter redesign to untangle.
 */
class ClientCrmTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
    }

    public function test_creating_an_exact_duplicate_name_is_blocked(): void
    {
        Client::create(['name' => 'Brad Pugh', 'work_type' => 'outside_of_upwork']);

        $this->actingAs($this->admin())
            ->post(route('clients.store'), ['name' => '  brad pugh ', 'work_type' => 'outside_of_upwork'])
            ->assertSessionHasErrors('name');

        $this->assertSame(1, Client::where('name', 'like', '%rad%')->count(), 'no duplicate created');
    }

    public function test_explicit_override_allows_a_true_namesake(): void
    {
        Client::create(['name' => 'Brad Pugh', 'work_type' => 'outside_of_upwork']);

        $this->actingAs($this->admin())
            ->post(route('clients.store'), [
                'name' => 'Brad Pugh', 'work_type' => 'outside_of_upwork', 'allow_duplicate' => true,
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(2, Client::where('name', 'Brad Pugh')->count());
    }

    public function test_archived_duplicate_points_at_restore_instead(): void
    {
        Client::create(['name' => 'Old Timer LLC', 'work_type' => 'outside_of_upwork', 'is_active' => false]);

        $response = $this->actingAs($this->admin())
            ->post(route('clients.store'), ['name' => 'Old Timer LLC', 'work_type' => 'outside_of_upwork']);

        $response->assertSessionHasErrors('name');
        $this->assertStringContainsString('archived', session('errors')->first('name'));
        $this->assertSame(1, Client::count());
    }

    public function test_rename_onto_an_existing_client_is_blocked(): void
    {
        Client::create(['name' => 'Keep Me', 'work_type' => 'outside_of_upwork']);
        $other = Client::create(['name' => 'Rename Me', 'work_type' => 'outside_of_upwork']);

        $this->actingAs($this->admin())
            ->put(route('clients.update', $other), ['name' => 'Keep Me', 'work_type' => 'outside_of_upwork'])
            ->assertSessionHasErrors('name');

        $this->assertSame('Rename Me', $other->fresh()->name);
    }

    public function test_crm_contact_fields_persist(): void
    {
        $this->actingAs($this->admin())
            ->post(route('clients.store'), [
                'name' => 'Amy Chavez',
                'work_type' => 'outside_of_upwork',
                'email' => 'amy@example.com',
                'phone' => '+1 555 0100',
                'preferred_contact' => 'upwork',
                'contact_notes' => 'Mornings US time; Upwork messages only.',
            ])
            ->assertSessionHasNoErrors();

        $c = Client::where('name', 'Amy Chavez')->firstOrFail();
        $this->assertSame('amy@example.com', $c->email);
        $this->assertSame('+1 555 0100', $c->phone);
        $this->assertSame('upwork', $c->preferred_contact);
        $this->assertSame('Mornings US time; Upwork messages only.', $c->contact_notes);
    }

    public function test_client_list_defaults_to_active_only(): void
    {
        Client::create(['name' => 'Active One', 'work_type' => 'outside_of_upwork', 'is_active' => true]);
        Client::create(['name' => 'Archived One', 'work_type' => 'outside_of_upwork', 'is_active' => false]);

        $this->actingAs($this->admin())
            ->get(route('clients.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.status', 'active')
                ->has('clients.data', 1)
                ->where('clients.data.0.name', 'Active One')
            );
    }
}
