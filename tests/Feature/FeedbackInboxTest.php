<?php

namespace Tests\Feature;

use App\Models\FeedbackItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The feedback inbox: anyone can file a request (incl. from a failed Help
 * search), members see only their own, managers (feedback.manage) see all and
 * triage them.
 */
class FeedbackInboxTest extends TestCase
{
    use RefreshDatabase;

    public function test_anyone_can_submit_and_it_lands_as_new_with_context(): void
    {
        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);

        $this->actingAs($member)->post('/feedback', [
            'type' => 'missing_doc',
            'subject' => 'Where do I change my schedule?',
            'message' => "Couldn't find the setting.",
            'context' => ['query' => 'change schedule'],
        ])->assertRedirect();

        $this->assertDatabaseHas('feedback_items', [
            'user_id' => $member->id,
            'subject' => 'Where do I change my schedule?',
            'type' => 'missing_doc',
            'status' => 'new',
        ]);
        $this->assertSame('change schedule', FeedbackItem::first()->context['query']);
    }

    public function test_xhr_submit_from_help_chat_returns_json(): void
    {
        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);

        $this->actingAs($member)->postJson('/feedback', [
            'type' => 'missing_doc',
            'subject' => 'export button',
            'message' => 'where is export',
            'context' => ['query' => 'export button'],
        ])->assertOk()->assertJson(['ok' => true]);

        $this->assertDatabaseHas('feedback_items', ['subject' => 'export button', 'status' => 'new']);
    }

    public function test_member_sees_only_own_manager_sees_all(): void
    {
        $a = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $b = User::factory()->create(['role' => 'member', 'permissions' => []]);
        FeedbackItem::create(['user_id' => $a->id, 'type' => 'question', 'subject' => 'A item', 'message' => 'm', 'status' => 'new']);
        FeedbackItem::create(['user_id' => $b->id, 'type' => 'question', 'subject' => 'B item', 'message' => 'm', 'status' => 'new']);

        $propsA = $this->actingAs($a)->get('/feedback')->assertOk()->viewData('page')['props'];
        $this->assertFalse($propsA['canManage']);
        $this->assertCount(1, $propsA['items']);

        $manager = User::factory()->create(['role' => 'admin', 'permissions' => ['feedback.manage']]);
        $propsM = $this->actingAs($manager)->get('/feedback')->assertOk()->viewData('page')['props'];
        $this->assertTrue($propsM['canManage']);
        $this->assertCount(2, $propsM['items']);
    }

    public function test_update_is_gated_and_records_handler(): void
    {
        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $item = FeedbackItem::create(['user_id' => $member->id, 'type' => 'question', 'subject' => 'x', 'message' => 'm', 'status' => 'new']);

        $this->actingAs($member)->patch('/feedback/'.$item->id, ['status' => 'done'])->assertForbidden();

        $manager = User::factory()->create(['role' => 'admin', 'permissions' => ['feedback.manage']]);
        $this->actingAs($manager)->patch('/feedback/'.$item->id, ['status' => 'planned', 'response' => 'On the roadmap'])->assertRedirect();

        $item->refresh();
        $this->assertSame('planned', $item->status);
        $this->assertSame('On the roadmap', $item->response);
        $this->assertSame($manager->id, $item->handled_by);
        $this->assertNotNull($item->handled_at);
    }

    public function test_open_count_badge_counts_only_open_statuses(): void
    {
        $u = User::factory()->create(['role' => 'member', 'permissions' => []]);
        FeedbackItem::create(['user_id' => $u->id, 'type' => 'question', 'subject' => '1', 'message' => 'm', 'status' => 'new']);
        FeedbackItem::create(['user_id' => $u->id, 'type' => 'question', 'subject' => '2', 'message' => 'm', 'status' => 'in_review']);
        FeedbackItem::create(['user_id' => $u->id, 'type' => 'question', 'subject' => '3', 'message' => 'm', 'status' => 'done']);
        FeedbackItem::create(['user_id' => $u->id, 'type' => 'question', 'subject' => '4', 'message' => 'm', 'status' => 'declined']);

        $this->assertSame(2, FeedbackItem::open()->count());
    }
}
