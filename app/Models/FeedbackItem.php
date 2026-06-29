<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FeedbackItem extends Model
{
    public const TYPES = ['question', 'feature_request', 'bug', 'missing_doc'];

    public const STATUSES = ['new', 'in_review', 'planned', 'done', 'declined'];

    /** Statuses that still need a manager's attention (drive the inbox badge). */
    public const OPEN_STATUSES = ['new', 'in_review', 'planned'];

    protected $fillable = [
        'user_id', 'type', 'subject', 'message', 'context', 'status', 'response', 'handled_by', 'handled_at', 'response_seen_at', 'manager_seen_at',
    ];

    protected $casts = [
        'context' => 'array',
        'handled_at' => 'datetime',
        'response_seen_at' => 'datetime',
        'manager_seen_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    /** The conversation after the opening request, oldest first. */
    public function messages(): HasMany
    {
        return $this->hasMany(FeedbackMessage::class)->orderBy('created_at');
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', self::OPEN_STATUSES);
    }

    /**
     * A submitter's own tickets that have a reply from someone else (a manager)
     * posted since they last read the thread — i.e. unseen replies. Drives the
     * submitter's Inbox badge. (Reusable unread pattern: a message newer than
     * the viewer's last-read timestamp.)
     */
    public function scopeUnseenFor(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId)
            ->whereExists(function ($q) {
                $q->selectRaw('1')->from('feedback_messages')
                    ->whereColumn('feedback_messages.feedback_item_id', 'feedback_items.id')
                    ->whereColumn('feedback_messages.user_id', '!=', 'feedback_items.user_id')
                    ->where(function ($w) {
                        $w->whereNull('feedback_items.response_seen_at')
                            ->orWhereColumn('feedback_messages.created_at', '>', 'feedback_items.response_seen_at');
                    });
            });
    }
}
