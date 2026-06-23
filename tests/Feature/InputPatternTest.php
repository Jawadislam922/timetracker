<?php

namespace Tests\Feature;

use App\Support\InputPattern;
use Illuminate\Support\Collection;
use PHPUnit\Framework\TestCase;

class InputPatternTest extends TestCase
{
    private function samples(array $rows): Collection
    {
        return collect($rows)->map(fn ($r) => (object) ['keyboard_count' => $r[0], 'mouse_count' => $r[1]]);
    }

    public function test_flags_heavy_mouse_no_keyboard_low_activity(): void
    {
        // 20 samples, all heavy mouse, never a keypress — the jiggler signature.
        $samples = $this->samples(array_fill(0, 20, [0, 900]));

        $result = InputPattern::suspectedAutomation($samples, 6);

        $this->assertTrue($result['suspected']);
        $this->assertSame(0.0, $result['keyboard_ratio']);
    }

    public function test_does_not_flag_when_user_types(): void
    {
        // Same heavy mouse, but the user types in a quarter of the samples.
        $rows = array_fill(0, 15, [0, 900]);
        $rows = array_merge($rows, array_fill(0, 5, [40, 300]));

        $result = InputPattern::suspectedAutomation($this->samples($rows), 6);

        $this->assertFalse($result['suspected']);
    }

    public function test_does_not_flag_high_activity_mouse_work(): void
    {
        // Mouse-heavy but genuine (e.g. design work): the activity score is high.
        $samples = $this->samples(array_fill(0, 20, [0, 900]));

        $this->assertFalse(InputPattern::suspectedAutomation($samples, 75)['suspected']);
    }

    public function test_ignores_too_few_samples(): void
    {
        $samples = $this->samples(array_fill(0, 5, [0, 900]));

        $this->assertFalse(InputPattern::suspectedAutomation($samples, 6)['suspected']);
    }

    public function test_idle_samples_do_not_count_as_active(): void
    {
        // Mostly idle (no input) with only a few heavy-mouse samples → not enough
        // active samples to judge, so no flag.
        $rows = array_merge(array_fill(0, 30, [0, 0]), array_fill(0, 4, [0, 900]));

        $this->assertFalse(InputPattern::suspectedAutomation($this->samples($rows), 6)['suspected']);
    }
}
