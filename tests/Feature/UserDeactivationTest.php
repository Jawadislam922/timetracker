<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Deactivating a user (someone who left) must block both auth paths — web
 * session login AND desktop token — for new logins and any already-issued
 * credential, while preserving their history. Management is guarded: can't
 * deactivate yourself or a Super Admin you don't outrank.
 */
class UserDeactivationTest extends TestCase
{
    use RefreshDatabase;

    public function test_deactivated_user_cannot_log_in_on_the_web(): void
    {
        $user = User::factory()->create(['password' => bcrypt('password123!'), 'is_active' => false]);

        $this->post('/login', ['email' => $user->email, 'password' => 'password123!'])
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_active_user_can_still_log_in(): void
    {
        $user = User::factory()->create(['password' => bcrypt('password123!'), 'is_active' => true]);

        $this->post('/login', ['email' => $user->email, 'password' => 'password123!']);

        $this->assertAuthenticatedAs($user);
    }

    public function test_a_user_deactivated_mid_session_is_logged_out_on_next_request(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->update(['is_active' => false]);

        $this->actingAs($user)->get('/dashboard')->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_desktop_login_is_blocked_and_existing_tokens_revoked(): void
    {
        $user = User::factory()->create(['password' => bcrypt('password123!'), 'is_active' => false]);
        $user->createToken('old-device', ['desktop-tracker']);
        $this->assertSame(1, $user->tokens()->count());

        $this->postJson('/api/desktop/login', [
            'email' => $user->email, 'password' => 'password123!', 'device_name' => 'laptop',
        ])->assertStatus(422);

        $this->assertSame(0, $user->fresh()->tokens()->count(), 'a deactivated login attempt revokes existing tokens');
    }

    public function test_a_desktop_token_stops_working_once_the_user_is_deactivated(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $token = $user->createToken('laptop', ['desktop-tracker'])->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/desktop/me')->assertOk();

        $user->update(['is_active' => false]);
        // Each real request re-resolves the user from the token; in-process the
        // guard caches it, so clear it to mirror a fresh production request.
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/desktop/me')->assertStatus(403);
    }

    public function test_set_status_deactivates_revokes_tokens_and_keeps_history(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin']);
        $member = User::factory()->create(['is_active' => true]);
        $member->createToken('laptop', ['desktop-tracker']);

        $this->actingAs($admin)
            ->patch(route('users.set-status', $member), ['is_active' => false])
            ->assertRedirect();

        $this->assertFalse($member->fresh()->is_active);
        $this->assertSame(0, $member->fresh()->tokens()->count());
        $this->assertDatabaseHas('users', ['id' => $member->id]); // row preserved
    }

    public function test_cannot_deactivate_your_own_account(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'is_active' => true]);

        $this->actingAs($admin)
            ->patch(route('users.set-status', $admin), ['is_active' => false])
            ->assertSessionHasErrors('is_active');

        $this->assertTrue($admin->fresh()->is_active);
    }

    public function test_a_non_super_admin_cannot_deactivate_a_super_admin(): void
    {
        $manager = User::factory()->create(['role' => 'admin', 'permissions' => ['users.manage', 'users.view']]);
        $super = User::factory()->create(['role' => 'super_admin', 'is_active' => true]);

        $this->actingAs($manager)
            ->patch(route('users.set-status', $super), ['is_active' => false])
            ->assertForbidden();

        $this->assertTrue($super->fresh()->is_active);
    }

    public function test_bulk_status_deactivates_many_and_skips_super_admins(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'permissions' => ['users.manage', 'users.view']]);
        $a = User::factory()->create(['is_active' => true]);
        $b = User::factory()->create(['is_active' => true]);
        $super = User::factory()->create(['role' => 'super_admin', 'is_active' => true]);

        $this->actingAs($admin)->post(route('users.bulk-status'), [
            'is_active' => false,
            'ids' => [$a->id, $b->id, $super->id],
        ])->assertRedirect();

        $this->assertFalse($a->fresh()->is_active);
        $this->assertFalse($b->fresh()->is_active);
        $this->assertTrue($super->fresh()->is_active, 'a non-super admin can never deactivate a Super Admin');
    }

    public function test_active_scope_excludes_deactivated_users(): void
    {
        User::factory()->count(2)->create(['is_active' => true]);
        User::factory()->create(['is_active' => false]);

        $this->assertSame(2, User::active()->count());
    }
}
