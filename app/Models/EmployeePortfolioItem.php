<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeePortfolioItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_portfolio_id',
        'title',
        'description',
        'image_path',
        'link',
        'sort_order',
    ];

    public function portfolio(): BelongsTo
    {
        return $this->belongsTo(EmployeePortfolio::class, 'employee_portfolio_id');
    }
}
