<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmployeePortfolio extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'slug',
        'name',
        'title',
        'tagline',
        'stats_json',
        'profile_image_path',
        'about',
        'services_json',
        'employment_json',
        'skills_json',
        'why_json',
        'contact_json',
        'theme',
        'is_draft',
        'is_published',
    ];

    protected $casts = [
        'stats_json' => 'array',
        'services_json' => 'array',
        'employment_json' => 'array',
        'skills_json' => 'array',
        'why_json' => 'array',
        'contact_json' => 'array',
        'is_draft' => 'boolean',
        'is_published' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(EmployeePortfolioItem::class)->orderBy('sort_order');
    }
}
