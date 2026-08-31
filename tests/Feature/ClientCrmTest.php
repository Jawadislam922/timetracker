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

    /**
     * A partial save must not wipe the fields it didn't send.
     *
     * The contact modal sends no `tags`; the old edit page sent no contact
     * fields. Blanket `?? null` writes meant each one silently destroyed the
     * other's data on every save.
     */
    public function test_saving_without_tags_keeps_existing_tags(): void
    {
        $client = Client::create([
            'name' => 'Tagged Co', 'work_type' => 'outside_of_upwork',
            'tags' => ['vip', 'retainer'], 'email' => 'a@b.com',
        ]);

        $this->actingAs($this->admin())
            ->put(route('clients.update', $client), [
                'name' => 'Tagged Co', 'work_type' => 'outside_of_upwork',
                'email' => 'changed@b.com',
            ])
            ->assertSessionHasNoErrors();

        $fresh = $client->fresh();
        $this->assertSame(['vip', 'retainer'], $fresh->tags, 'tags survived a contact-only save');
        $this->assertSame('changed@b.com', $fresh->email);
    }

    public function test_saving_without_contact_fields_keeps_them(): void
    {
        $client = Client::create([
            'name' => 'Contactable', 'work_type' => 'outside_of_upwork',
            'email' => 'keep@me.com', 'phone' => '+1 555', 'preferred_contact' => 'upwork',
            'contact_notes' => 'mornings only', 'tags' => ['old'],
        ]);

        // A tags-only save, as the retired edit page used to send.
        $this->actingAs($this->admin())
            ->put(route('clients.update', $client), [
                'name' => 'Contactable', 'work_type' => 'outside_of_upwork',
                'tags' => ['new'],
            ])
            ->assertSessionHasNoErrors();

        $fresh = $client->fresh();
        $this->assertSame('keep@me.com', $fresh->email);
        $this->assertSame('+1 555', $fresh->phone);
        $this->assertSame('upwork', $fresh->preferred_contact);
        $this->assertSame('mornings only', $fresh->contact_notes);
        $this->assertSame(['new'], $fresh->tags, 'the field that WAS sent still updates');
    }

    /** An explicitly-sent empty value still clears the field. */
    public function test_explicitly_clearing_a_field_still_works(): void
    {
        $client = Client::create([
            'name' => 'Clearable', 'work_type' => 'outside_of_upwork', 'email' => 'gone@soon.com',
        ]);

        $this->actingAs($this->admin())
            ->put(route('clients.update', $client), [
                'name' => 'Clearable', 'work_type' => 'outside_of_upwork', 'email' => '',
            ])
            ->assertSessionHasNoErrors();

        $this->assertNull($client->fresh()->email);
    }

    /** Saving from the list returns to that exact page/filters, not page 1. */
    public function test_update_returns_to_the_originating_list_view(): void
    {
        $client = Client::create(['name' => 'Somewhere', 'work_type' => 'outside_of_upwork']);

        $this->actingAs($this->admin())
            ->put(route('clients.update', $client), [
                'name' => 'Somewhere', 'work_type' => 'outside_of_upwork',
                'return_to' => '/clients?page=4&perPage=50&search=some',
            ])
            ->assertRedirect('/clients?page=4&perPage=50&search=some');
    }

    /** A crafted off-site return_to is ignored. */
    public function test_offsite_return_to_is_rejected(): void
    {
        $client = Client::create(['name' => 'Safe', 'work_type' => 'outside_of_upwork']);

        $this->actingAs($this->admin())
            ->put(route('clients.update', $client), [
                'name' => 'Safe', 'work_type' => 'outside_of_upwork',
                'return_to' => '//evil.example.com/steal',
            ])
            ->assertRedirect(route('clients.index'));
    }

    /** The retired add/edit pages redirect to the list instead of 404ing. */
    public function test_retired_client_pages_redirect_to_the_list(): void
    {
        $client = Client::create(['name' => 'Bookmarked', 'work_type' => 'outside_of_upwork']);
        $admin = $this->admin();

        $this->actingAs($admin)->get(route('clients.create'))
            ->assertRedirect(route('clients.index'));

        $this->actingAs($admin)->get(route('clients.edit', $client))
            ->assertRedirect(route('clients.index', ['search' => 'Bookmarked']));
    }

    /**
     * The add-client popup can restore an archived match in place.
     *
     * Warning someone that "Ivo Peeters is archived" and then making them close
     * the dialog, switch the list filter to Archived and search again is a dead
     * end — the popup now calls this endpoint directly.
     */
    public function test_an_archived_match_can_be_restored_from_the_add_dialog(): void
    {
        $archived = Client::create([
            'name' => 'Ivo Peeters', 'work_type' => 'outside_of_upwork', 'is_active' => false,
        ]);

        $this->actingAs($this->admin())
            ->patch(route('clients.set-status', $archived), [
                'is_active' => true,
                'return_to' => '/clients?page=2&search=ivo',
            ])
            ->assertRedirect('/clients?page=2&search=ivo');

        $this->assertTrue($archived->fresh()->is_active, 'the client is active again');
        $this->assertSame(1, Client::where('name', 'Ivo Peeters')->count(), 'restored, not duplicated');
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
