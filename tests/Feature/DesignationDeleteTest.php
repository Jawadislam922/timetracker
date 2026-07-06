<?php

namespace Tests\Feature;

use App\Models\Designation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Regression for the reported "deleted designation comes back" bug: deleting a
 * designation must clear it from everyone who had it, so rememberDesignation()
 * can't resurrect it on their next save.
 */
class DesignationDeleteTest extends TestCase
{
    use RefreshDatabase;

    public function test_deleting_a_designation_clears_it_and_it_does_not_resurrect(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);

        // Typo'd designation added via a normal user save.
        $this->actingAs($admin)->post(route('users.store'), [
            'name' => 'Des Person', 'email' => 'des@example.com',
            'password' => 'longenoughpassword12', 'designation' => 'Graphic Desger',
        ])->assertRedirect();
        $user = User::where('email', 'des@example.com')->first();
        $this->assertSame('Graphic Desger', $user->designation);
        $designation = Designation::where('name', 'Graphic Desger')->firstOrFail();

        // Delete it → cleared from the user AND removed from suggestions.
        $this->actingAs($admin)->delete(route('users.designations.destroy', $designation->id))->assertRedirect();
        $this->assertNull($user->fresh()->designation);
        $this->assertDatabaseMissing('designations', ['id' => $designation->id]);

        // Editing the user again must NOT bring the deleted designation back.
        $this->actingAs($admin)->from(route('users.edit', $user))->patch(route('users.update', $user), [
            'name' => 'Des Person Renamed', 'email' => 'des@example.com',
        ])->assertRedirect();
        $this->assertDatabaseMissing('designations', ['name' => 'Graphic Desger']);
    }
}
