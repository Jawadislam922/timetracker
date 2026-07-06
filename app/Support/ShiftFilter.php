<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Shared parsing + application of the `shift_ids[]` manager filter (curated
 * shift ids, plus a "no_shift" sentinel for people with no shift assigned).
 * Used by the Dashboard, Team Performance and Attendance endpoints so the
 * filter behaves identically everywhere.
 */
class ShiftFilter
{
    /** @return array{0: int[], 1: bool} [regular shift ids, include "no shift"] */
    public static function parse(Request $request): array
    {
        $raw = $request->input('shift_ids', []);
        $ids = collect(is_array($raw) ? $raw : [$raw])
            ->map(fn ($id) => (string) $id)
            ->filter(fn ($id) => $id !== '' && $id !== 'all')
            ->unique()
            ->values();

        $noShift = $ids->contains('no_shift');
        $regular = $ids->reject(fn ($id) => $id === 'no_shift')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        return [$regular, $noShift];
    }

    /** Apply the filter to a User query builder (no-op when nothing selected). */
    public static function apply(Builder $query, Request $request): Builder
    {
        [$regular, $noShift] = self::parse($request);
        if (empty($regular) && ! $noShift) {
            return $query;
        }

        return $query->where(function ($q) use ($regular, $noShift) {
            if (! empty($regular)) {
                $q->whereIn('shift_id', $regular);
            }
            if ($noShift) {
                $method = empty($regular) ? 'where' : 'orWhere';
                $q->{$method}(fn ($eq) => $eq->whereNull('shift_id'));
            }
        });
    }
}
