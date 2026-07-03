<?php

namespace Tests\Feature;

use App\Http\Controllers\TimelineController;
use App\Models\TrackingScreenshot;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use ReflectionClass;
use ReflectionMethod;
use Tests\TestCase;

/**
 * The O(n) rewrite of screenshotInput must produce byte-identical output to the
 * old O(n²) version. We run both on random shot/sample layouts and assert they
 * agree — a pure-performance change with no behaviour drift.
 */
class ScreenshotInputEquivalenceTest extends TestCase
{
    /** The original nested-loop algorithm, kept here as the reference oracle. */
    private function naive(Collection $shots, Collection $samples, ?Carbon $blockStart): array
    {
        $sorted = $shots->filter(fn ($s) => $s->captured_at)
            ->sortBy(fn ($s) => $s->captured_at->getTimestamp())->values();
        $out = [];
        $prev = $blockStart;
        foreach ($sorted as $shot) {
            $until = $shot->captured_at;
            $keys = 0;
            $clicks = 0;
            foreach ($samples as $smp) {
                $t = $smp->captured_at;
                if (! $t) {
                    continue;
                }
                if (($prev === null || $t->greaterThan($prev)) && $t->lessThanOrEqualTo($until)) {
                    $keys += (int) $smp->keyboard_count;
                    $clicks += (int) ($smp->mouse_clicks ?? 0);
                }
            }
            $out[$shot->id] = ['keystrokes' => $keys, 'clicks' => $clicks];
            $prev = $until;
        }

        return $out;
    }

    private function fast(Collection $shots, Collection $samples, ?Carbon $blockStart): array
    {
        $controller = (new ReflectionClass(TimelineController::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod($controller, 'screenshotInput');
        $method->setAccessible(true);

        return $method->invoke($controller, $shots, $samples, $blockStart);
    }

    public function test_optimized_matches_naive_on_random_data(): void
    {
        mt_srand(4242);
        for ($trial = 0; $trial < 25; $trial++) {
            $base = Carbon::parse('2026-07-03 08:00:00');

            $shots = collect();
            $t = 0;
            $shotCount = mt_rand(1, 8);
            for ($i = 0; $i < $shotCount; $i++) {
                $t += mt_rand(20, 300);
                $shot = new TrackingScreenshot();
                $shot->id = $i + 1;
                $shot->captured_at = $base->copy()->addSeconds($t);
                $shots->push($shot);
            }

            $samples = collect();
            $sampleCount = mt_rand(0, 300);
            for ($j = 0; $j < $sampleCount; $j++) {
                $samples->push((object) [
                    'captured_at' => $base->copy()->addSeconds(mt_rand(-30, $t + 90)),
                    'keyboard_count' => mt_rand(0, 80),
                    'mouse_clicks' => mt_rand(0, 15),
                ]);
            }

            $blockStart = (mt_rand(0, 1) === 1) ? $base->copy() : null;

            $this->assertSame(
                $this->naive($shots, $samples, $blockStart),
                $this->fast($shots, $samples, $blockStart),
                "screenshotInput mismatch on trial {$trial}",
            );
        }
    }
}
