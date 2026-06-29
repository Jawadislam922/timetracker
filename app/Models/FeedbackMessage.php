<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One reply in a feedback ticket's thread — from the submitter or a manager.
 * The opening request itself lives on the FeedbackItem (subject/message); these
 * are everything said after it.
 */
class FeedbackMessage extends Model
{
    protected $fillable = ['feedback_item_id', 'user_id', 'body'];

    public function item(): BelongsTo
    {
        return $this->belongsTo(FeedbackItem::class, 'feedback_item_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
