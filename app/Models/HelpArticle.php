<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class HelpArticle extends Model
{
    protected $fillable = [
        'title', 'slug', 'category', 'body', 'keywords', 'admin_only', 'sort_order', 'is_published',
    ];

    protected $casts = [
        'admin_only' => 'boolean',
        'is_published' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('is_published', true);
    }

    /**
     * Admin-only articles are hidden from regular members; everyone sees the
     * rest. Pass whether the viewer is a manager/admin.
     */
    public function scopeVisibleTo(Builder $query, bool $isManager): Builder
    {
        return $isManager ? $query : $query->where('admin_only', false);
    }
}
