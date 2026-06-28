<?php

namespace Tests\Feature;

use App\Models\HelpArticle;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The Help page is now doc-driven: it hands the viewer the published articles
 * they're allowed to see. Manager-only guidance must never reach a regular
 * member, and unpublished drafts must never ship.
 */
class HelpKnowledgeBaseTest extends TestCase
{
    use RefreshDatabase;

    private function article(array $attrs): HelpArticle
    {
        return HelpArticle::create(array_merge([
            'title' => 'Untitled',
            'slug' => \Illuminate\Support\Str::slug($attrs['title'] ?? 'untitled-'.uniqid()),
            'category' => 'General',
            'body' => 'Body text.',
            'is_published' => true,
            'admin_only' => false,
        ], $attrs));
    }

    public function test_member_sees_published_public_articles_only(): void
    {
        $this->article(['title' => 'Clocking in', 'slug' => 'clocking-in']);
        $this->article(['title' => 'For managers', 'slug' => 'for-managers', 'admin_only' => true]);
        $this->article(['title' => 'Draft note', 'slug' => 'draft-note', 'is_published' => false]);

        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);

        $props = $this->actingAs($member)->get('/help')->assertOk()->viewData('page')['props'];
        $titles = collect($props['articles'])->pluck('title');

        $this->assertTrue($titles->contains('Clocking in'));
        $this->assertFalse($titles->contains('For managers'), 'Members must not see manager-only articles.');
        $this->assertFalse($titles->contains('Draft note'), 'Unpublished drafts must not ship.');
        $this->assertFalse($props['isManager']);
    }

    public function test_manager_sees_admin_only_articles(): void
    {
        $this->article(['title' => 'Clocking in', 'slug' => 'clocking-in']);
        $this->article(['title' => 'For managers', 'slug' => 'for-managers', 'admin_only' => true]);

        $manager = User::factory()->create(['role' => 'admin', 'permissions' => ['attendance.view']]);

        $props = $this->actingAs($manager)->get('/help')->assertOk()->viewData('page')['props'];
        $titles = collect($props['articles'])->pluck('title');

        $this->assertTrue($titles->contains('For managers'));
        $this->assertTrue($props['isManager']);
    }
}
