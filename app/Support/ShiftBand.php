<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * Buckets a worker's shift start time into a coarse "band" for the dashboard
 * Shift Board, so HR can read the day as three shifts that tile the clock:
 *
 *   Day      08:00–15:59   (the 8 AM – 4 PM crew)
 *   Evening  16:00–23:59   (the 4 PM – midnight crew, incl. the 16:00 US team)
 *   Night    00:00–07:59   (the after-midnight crew)
 *
 * Anyone with no shift start time set falls into "Unscheduled". The thresholds
 * are the single source of truth for the band split — change them here to move
 * a start time between bands (e.g. push the 21:00 starters into Night by
 * lowering EVENING's upper bound).
 */
class ShiftBand
{
    public const DAY = 'day';
    public const EVENING = 'evening';
    public const NIGHT = 'night';
    public const UNSCHEDULED = 'unscheduled';

    /** Display order on the board. */
    public const ORDER = [self::DAY, self::EVENING, self::NIGHT, self::UNSCHEDULED];

    public const LABELS = [
        self::DAY => 'Day shift',
        self::EVENING => 'Evening shift',
        self::NIGHT => 'Night shift',
        self::UNSCHEDULED => 'Unscheduled',
    ];

    public const RANGE_LABELS = [
        self::DAY => '8 AM – 4 PM',
        self::EVENING => '4 PM – 12 AM',
        self::NIGHT => '12 AM – 8 AM',
        self::UNSCHEDULED => 'No shift set',
    ];

    /**
     * Classify a shift start time into a band. Accepts a Carbon (the cast on
     * User::shift_start_time), an "H:i"/"H:i:s" string, or null/empty.
     */
    public static function classify($shiftStart): string
    {
        if (empty($shiftStart)) {
            return self::UNSCHEDULED;
        }

        $hour = $shiftStart instanceof Carbon
            ? (int) $shiftStart->format('G')
            : (int) explode(':', (string) $shiftStart)[0];

        if ($hour >= 8 && $hour < 16) {
            return self::DAY;
        }
        if ($hour >= 16) {
            return self::EVENING;
        }

        return self::NIGHT; // 00:00–07:59
    }

    public static function label(string $band): string
    {
        return self::LABELS[$band] ?? ucfirst($band);
    }

    public static function rangeLabel(string $band): string
    {
        return self::RANGE_LABELS[$band] ?? '';
    }
}
