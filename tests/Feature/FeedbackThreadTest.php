<?php

namespace Tests\Feature;

use App\Models\FeedbackItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feedback tickets are threaded conversations. Both the submitter (on their own
 * ticket) and managers can reply; outsiders can't. Managers see whether the
 * submitter has read their latest reply, and a ticket reads as unseen for
 * managers until one of them opens it.
 */
class FeedbackThreadTest extends TestCase
{
    use RefreshDatabase;

    private function member(): User
    {
        return User::factory()->create(['role' => 'member', 'permissions' => []]);
    }

    private function manager(): User
    {
        return User::factory()->create(['role' => 'admin', 'permissions' => ['feedback.manage']]);
    }

    private function ticket(User $owner): FeedbackItem
    {
        return FeedbackItem::create([
            'user_id' => $owner->id, 'type' => 'question',
            'subject' => 'Q', 'message' => 'why?', 'status' => 'new',
        ]);
    }

    private function itemProp(array $props, int $id): array
    {
        return collect($props['items'])->firstWhere('id', $id);
    }

    public function test_submitter_can_reply_to_their_own_ticket(): void
    {
        $member = $this->member();
        $item = $this->ticket($member);

        $this->actingAs($member)->post(route('feedback.reply', $item), ['body' => 'one more thing'])->assertRedirect();

        $this->assertDatabaseHas('feedback_messages', [
            'feedback_item_id' => $item->id, 'user_id' => $member->id, 'body' => 'one more thing',
        ]);
    }

    public function test_a_stranger_cannot_reply_to_someone_elses_ticket(): void
    {
        $owner = $this->member();
        $stranger = $this->member();
        $item = $this->ticket($owner);

        $this->actingAs($stranger)->post(route('feedback.reply', $item), ['body' => 'hi'])->assertForbidden();
        $this->assertDatabaseMissing('feedback_messages', ['feedback_item_id' => $item->id, 'user_id' => $stranger->id]);
    }

    public function test_manager_reply_can_set_status_in_one_step(): void
    {
        $member = $this->member();
        $manager = $this->manager();
        $item = $this->ticket($member);

        $this->actingAs($manager)->post(route('feedback.reply', $item), ['body' => 'done!', 'status' => 'done'])->assertRedirect();

        $item->refresh();
        $this->assertSame('done', $item->status);
        $this->assertSame($manager->id, $item->handled_by);
        $this->assertDatabaseHas('feedback_messages', ['feedback_item_id' => $item->id, 'user_id' => $manager->id, 'body' => 'done!']);
    }

    public function test_a_ticket_is_unread_for_managers_until_one_opens_it(): void
    {
        $member = $this->member();
        $manager = $this->manager();
        $item = $this->ticket($member);

        $props = $this->actingAs($manager)->get('/feedback')->viewData('page')['props'];
        $this->assertTrue($this->itemProp($props, $item->id)['unread']);

        $this->actingAs($manager)->post(route('feedback.seen', $item))->assertRedirect();

        $props2 = $this->actingAs($manager)->get('/feedback')->viewData('page')['props'];
        $this->assertFalse($this->itemProp($props2, $item->id)['unread']);
    }

    public function test_managers_see_whether_the_submitter_read_their_reply(): void
    {
        $member = $this->member();
        $manager = $this->manager();
        $item = $this->ticket($member);
        $item->messages()->create(['user_id' => $manager->id, 'body' => 'here you go']);

        $before = $this->actingAs($manager)->get('/feedback')->viewData('page')['props'];
        $this->assertFalse($this->itemProp($before, $item->id)['submitter_read_latest']);

        $this->actingAs($member)->post(route('feedback.seen', $item))->assertRedirect();

        $after = $this->actingAs($manager)->get('/feedback')->viewData('page')['props'];
        $this->assertTrue($this->itemProp($after, $item->id)['submitter_read_latest']);
    }
}
