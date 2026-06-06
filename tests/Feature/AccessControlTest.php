<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccessControlTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_without_permission_cannot_open_clients(): void
    {
        $member = User::factory()->create([
            'role' => 'member',
            'permissions' => [],
        ]);

        $this->actingAs($member)
            ->get(route('clients.index'))
            ->assertForbidden();
    }

    public function test_management_permission_implies_matching_view_permission(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'permissions' => ['clients.manage'],
        ]);

        $this->assertTrue($admin->hasPermission('clients.view'));
        $this->assertContains('clients.view', $admin->effectivePermissions());
    }

    public function test_super_admin_has_every_configured_permission(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'permissions' => [],
        ]);

        $this->assertTrue($superAdmin->hasPermission('users.manage'));
        $this->assertTrue($superAdmin->hasPermission('reports.export'));
    }

    public function test_super_admin_cannot_demote_their_own_account(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'permissions' => [],
        ]);

        $this->actingAs($superAdmin)
            ->patch(route('users.update', $superAdmin), [
                'name' => $superAdmin->name,
                'email' => $superAdmin->email,
                'role' => 'member',
                'permissions' => [],
                'designation' => null,
            ])
            ->assertSessionHasErrors('role');

        $this->assertSame('super_admin', $superAdmin->fresh()->role);
    }
}
