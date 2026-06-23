<?php

namespace App\Support;

use Illuminate\Support\Collection;

/**
 * Heuristics over a session's activity samples to spot input that looks
 * machine-generated (a "mouse jiggler" / anti-idle tool), so a manager can
 * REVIEW the session. It never cuts tracked time — false positives must only
 * cost a second look, never someone's hours.
 *
 * The jiggler signature, from real data: every sample shows heavy mouse
 * movement, the keyboard is never touched, yet the tracker's own activity
 * score stays low. A genuine mouse-heavy worker (design, browsing, reviewing)
 * still types occasionally and scores higher, so the combined test is
 * deliberately conservative.
 */
class InputPattern
{
    /** Mouse-move events in a sample at/above this count as "heavy" movement. */
    private const HEAVY_MOUSE = 100;

    /** Need at least this many input-bearing samples (~2 min) before judging. */
    private const MIN_ACTIVE_SAMPLES = 12;

    /** Above this share of keyboard-bearing samples, treat it as real work. */
    private const MAX_KEYBOARD_RATIO = 0.05;

    /** At/above this share of heavy-mouse, no-keyboard samples to be suspect. */
    private const MIN_MOUSE_ONLY_RATIO = 0.85;

    /** Only flag when the tracker's own activity score is this low or under. */
    private const MAX_ACTIVITY_PERCENT = 30;

    /**
     * @param  Collection  $samples  this session's TrackingActivitySample rows
     * @param  int  $activityPercent  the session's stored activity score
     * @return array{suspected: bool, mouse_only_ratio: float, keyboard_ratio: float, active_samples: int}
     */
    public static function suspectedAutomation(Collection $samples, int $activityPercent): array
    {
        // Only samples that carried input — idle gaps say nothing about jiggling.
        $active = $samples->filter(fn ($s) => ((int) $s->keyboard_count + (int) $s->mouse_count) > 0);
        $count = $active->count();

        $base = ['suspected' => false, 'mouse_only_ratio' => 0.0, 'keyboard_ratio' => 0.0, 'active_samples' => $count];

        if ($count < self::MIN_ACTIVE_SAMPLES) {
            return $base;
        }

        $withKeyboard = $active->filter(fn ($s) => (int) $s->keyboard_count > 0)->count();
        $heavyMouseNoKb = $active->filter(fn ($s) => (int) $s->keyboard_count === 0 && (int) $s->mouse_count >= self::HEAVY_MOUSE)->count();

        $keyboardRatio = $withKeyboard / $count;
        $mouseOnlyRatio = $heavyMouseNoKb / $count;

        $suspected = $keyboardRatio < self::MAX_KEYBOARD_RATIO
            && $mouseOnlyRatio >= self::MIN_MOUSE_ONLY_RATIO
            && $activityPercent <= self::MAX_ACTIVITY_PERCENT;

        return [
            'suspected' => $suspected,
            'mouse_only_ratio' => round($mouseOnlyRatio, 2),
            'keyboard_ratio' => round($keyboardRatio, 2),
            'active_samples' => $count,
        ];
    }
}
