<?php

namespace Tests\Feature;

use App\Models\FeedbackItem;
use App\Models\FeedbackMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Submitter "you have a reply" badge: a ticket with a manager reply posted
 * since the submitter last read it counts as unseen, and opening the ticket
 * clears it. (Reusable unread pattern: a message newer than last-read.)
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

    private function ticket(User $owner): FeedbackItem
    {
        return FeedbackItem::create([
            'user_id' => $owner->id, 'type' => 'question',
            'subject' => 'Q', 'message' => 'why?', 'status' => 'new',
        ]);
    }

    private function managerReply(FeedbackItem $item, User $manager, string $body = 'reply'): FeedbackMessage
    {
        return $item->messages()->create(['user_id' => $manager->id, 'body' => $body]);
    }

    public function test_a_manager_reply_makes_the_ticket_unseen_for_its_submitter(): void
    {
        $member = $this->member();
        $item = $this->ticket($member);
        $this->assertSame(0, FeedbackItem::unseenFor($member->id)->count());

        $this->managerReply($item, $this->manager());

        $this->assertSame(1, FeedbackItem::unseenFor($member->id)->count());
    }

    public function test_opening_a_ticket_clears_the_submitters_badge(): void
    {
        $member = $this->member();
        $item = $this->ticket($member);
        $this->managerReply($item, $this->manager());
        $this->assertSame(1, FeedbackItem::unseenFor($member->id)->count());

        $this->actingAs($member)->post(route('feedback.seen', $item))->assertRedirect();

        $this->assertSame(0, FeedbackItem::unseenFor($member->id)->count());
    }

    public function test_a_later_reply_after_reading_shows_unseen_again(): void
    {
        $member = $this->member();
        $manager = $this->manager();
        $item = $this->ticket($member);

        $first = $this->managerReply($item, $manager, 'first');
        $first->created_at = now()->subMinutes(5);
        $first->save();
        $item->response_seen_at = now()->subMinutes(3); // read after the first reply
        $item->save();
        $this->assertSame(0, FeedbackItem::unseenFor($member->id)->count());

        $this->managerReply($item, $manager, 'second'); // posted now, after last read
        $this->assertSame(1, FeedbackItem::unseenFor($member->id)->count());
    }

    public function test_unseen_does_not_leak_between_submitters(): void
    {
        $a = $this->member();
        $b = $this->member();
        $item = $this->ticket($a);
        $this->managerReply($item, $this->manager());

        $this->assertSame(1, FeedbackItem::unseenFor($a->id)->count());
        $this->assertSame(0, FeedbackItem::unseenFor($b->id)->count());
    }
}
