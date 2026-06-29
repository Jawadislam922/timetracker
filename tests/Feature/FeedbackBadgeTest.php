<?php

namespace Tests\Feature;

use App\Models\FeedbackItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Submitter "you have a reply" badge: a request a manager handled after the
 * submitter last saw it counts as unseen (drives the Inbox badge), and opening
 * the inbox clears it. Reusable unread pattern (response_seen_at vs handled_at).
 */
class FeedbackBadgeTest extends TestCase
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

    private function requestFrom(User $member): FeedbackItem
    {
        return FeedbackItem::create([
            'user_id' => $member->id, 'type' => 'question',
            'subject' => 'Q', 'message' => 'why?', 'status' => 'new',
        ]);
    }

    public function test_a_handled_request_becomes_unseen_for_its_submitter(): void
    {
        $member = $this->member();
        $item = $this->requestFrom($member);

        // Brand-new, unanswered request — nothing unseen yet.
        $this->assertSame(0, FeedbackItem::unseenFor($member->id)->count());

        $this->actingAs($this->manager())
            ->patch(route('feedback.update', $item), ['status' => 'done', 'response' => 'handled'])
            ->assertRedirect();

        $this->assertSame(1, FeedbackItem::unseenFor($member->id)->count());
    }

    public function test_opening_the_inbox_clears_the_submitters_badge(): void
    {
        $member = $this->member();
        $item = $this->requestFrom($member);
        $item->update(['status' => 'done', 'response' => 'handled', 'handled_at' => now()]);

        $this->assertSame(1, FeedbackItem::unseenFor($member->id)->count());

        $this->actingAs($member)->get(route('feedback.index'))->assertOk();

        $this->assertSame(0, FeedbackItem::unseenFor($member->id)->count());
    }

    public function test_a_later_reply_makes_it_unseen_again(): void
    {
        $member = $this->member();
        $item = $this->requestFrom($member);

        // Seen AFTER it was last handled -> not unseen.
        $item->update([
            'status' => 'done', 'response' => 'first',
            'handled_at' => now()->subMinutes(5), 'response_seen_at' => now()->subMinutes(3),
        ]);
        $this->assertSame(0, FeedbackItem::unseenFor($member->id)->count());

        // A fresh reply now (handled after last seen) -> unseen again.
        $item->update(['handled_at' => now()]);
        $this->assertSame(1, FeedbackItem::unseenFor($member->id)->count());
    }

    public function test_one_persons_unseen_reply_does_not_leak_to_another(): void
    {
        $a = $this->member();
        $b = $this->member();
        $item = $this->requestFrom($a);
        $item->update(['status' => 'done', 'response' => 'x', 'handled_at' => now()]);

        $this->assertSame(1, FeedbackItem::unseenFor($a->id)->count());
        $this->assertSame(0, FeedbackItem::unseenFor($b->id)->count());
    }
}
