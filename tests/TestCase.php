<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    protected function setUp(): void
    {
        parent::setUp();

        // The shift-history availability check is memoised on the class, so it
        // survives between tests while RefreshDatabase rebuilds the schema
        // underneath it. Clearing it each test stops one test's view of the
        // database (a dropped table, say) leaking into the next.
        User::forgetShiftHistoryAvailability();
    }
}
