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
        'user_id', 'type', 'subject', 'message', 'context', 'status', 'response', 'handled_by', 'handled_at',
    ];

    protected $casts = [
        'context' => 'array',
        'handled_at' => 'datetime',
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
}
