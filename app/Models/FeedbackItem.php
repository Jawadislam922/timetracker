<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedbackItem extends Model
{
    public const TYPES = ['question', 'feature_request', 'bug', 'missing_doc'];

    public const STATUSES = ['new', 'in_review', 'planned', 'done', 'declined'];

    /** Statuses that still need a manager's attention (drive the inbox badge). */
    public const OPEN_STATUSES = ['new', 'in_review', 'planned'];

    protected $fillable = [
        'user_id', 'type', 'subject', 'message', 'context', 'status', 'response', 'handled_by', 'handled_at', 'response_seen_at',
    ];

    protected $casts = [
        'context' => 'array',
        'handled_at' => 'datetime',
        'response_seen_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', self::OPEN_STATUSES);
    }

    /**
     * A user's own requests that a manager has handled (replied / re-statused)
     * since the user last saw them — i.e. unseen replies. Drives the submitter's
     * Inbox badge. Reusable unread pattern: handled after last seen, or never
     * seen.
     */
    public function scopeUnseenFor(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId)
            ->whereNotNull('handled_at')
            ->where(function (Builder $q) {
                $q->whereNull('response_seen_at')
                    ->orWhereColumn('response_seen_at', '<', 'handled_at');
            });
    }
}
