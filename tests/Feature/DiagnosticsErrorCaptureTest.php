<?php

namespace Tests\Feature;

use App\Support\Diagnostics;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

/**
 * The app-wide error capture must snapshot real server errors and stay quiet
 * for everyday non-errors (404s, auth) so the store is signal, not noise.
 */
class DiagnosticsErrorCaptureTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        File::deleteDirectory(Diagnostics::dir('errors'));
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(Diagnostics::dir('errors'));
        parent::tearDown();
    }

    public function test_a_real_error_is_captured_with_context(): void
    {
        Diagnostics::captureException(new \RuntimeException('database exploded'));

        $files = File::files(Diagnostics::dir('errors'));
        $this->assertCount(1, $files);
        $snap = json_decode(File::get($files[0]->getPathname()), true);
        $this->assertSame(\RuntimeException::class, $snap['exception']['class']);
        $this->assertStringContainsString('database exploded', $snap['summary']);
        $this->assertArrayHasKey('request', $snap);
    }

    public function test_everyday_non_errors_are_not_captured(): void
    {
        Diagnostics::captureException(new NotFoundHttpException('nope'));
        Diagnostics::captureException(new AuthenticationException('unauthenticated'));

        $this->assertFalse(
            File::isDirectory(Diagnostics::dir('errors')) && count(File::files(Diagnostics::dir('errors'))) > 0,
            '404 / auth exceptions should be treated as noise, not captured'
        );
    }

    public function test_the_unified_viewer_lists_categories(): void
    {
        Diagnostics::captureException(new \RuntimeException('boom'));

        $this->artisan('diagnostics')->assertExitCode(0);
        $this->artisan('diagnostics', ['category' => 'errors'])->assertExitCode(0);
    }
}
