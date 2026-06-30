<?php

namespace Tests\Unit;

use App\Support\ShiftBand;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

class ShiftBandTest extends TestCase
{
    public function test_classifies_by_start_hour(): void
    {
        $this->assertSame(ShiftBand::DAY, ShiftBand::classify('08:00'));
        $this->assertSame(ShiftBand::DAY, ShiftBand::classify('09:00'));
        $this->assertSame(ShiftBand::DAY, ShiftBand::classify('11:00'));
        $this->assertSame(ShiftBand::DAY, ShiftBand::classify('15:59'));

        $this->assertSame(ShiftBand::EVENING, ShiftBand::classify('16:00'));
        $this->assertSame(ShiftBand::EVENING, ShiftBand::classify('21:00'));
        $this->assertSame(ShiftBand::EVENING, ShiftBand::classify('23:59'));

        $this->assertSame(ShiftBand::NIGHT, ShiftBand::classify('00:00'));
        $this->assertSame(ShiftBand::NIGHT, ShiftBand::classify('07:59'));

        $this->assertSame(ShiftBand::UNSCHEDULED, ShiftBand::classify(null));
        $this->assertSame(ShiftBand::UNSCHEDULED, ShiftBand::classify(''));
    }

    public function test_accepts_a_carbon_time(): void
    {
        $this->assertSame(ShiftBand::EVENING, ShiftBand::classify(Carbon::parse('16:30')));
        $this->assertSame(ShiftBand::NIGHT, ShiftBand::classify(Carbon::parse('00:15')));
        $this->assertSame(ShiftBand::DAY, ShiftBand::classify(Carbon::parse('08:00')));
    }
}
