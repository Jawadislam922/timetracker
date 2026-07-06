<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A curated shift NAME (Morning / Noon / Evening / Night / …) admins manage in
 * one place; users pick one via users.shift_id. Just a label for filtering and
 * grouping — the actual shift TIMING lives on the user (shift_start_time /
 * shift_hours).
 */
class Shift extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'sort_order',
    ];

    public function users()
    {
        return $this->hasMany(User::class);
    }
}
