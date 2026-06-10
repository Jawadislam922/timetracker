<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\File;
use Inertia\Inertia;

class DesktopDownloadController extends Controller
{
    private const WINDOWS_INSTALLER = 'Timetracker Desktop Setup 0.1.0.exe';

    private const WINDOWS_VERSION = '0.1.0';

    private const MAC_VERSION = '0.1.0';

    /**
     * Accepted macOS artifact names, preferred first. The Mac build produces
     * an arm64 dmg on Apple Silicon; Intel/universal names are accepted too.
     */
    private const MAC_INSTALLERS = [
        'Timetracker Desktop-0.1.0-universal.dmg',
        'Timetracker Desktop-0.1.0-arm64.dmg',
        'Timetracker Desktop-0.1.0.dmg',
    ];

    public function index()
    {
        $windows = $this->windowsInstaller();
        $mac = $this->macInstaller();

        return Inertia::render('DesktopDownloads', [
            'downloads' => [
                'windows' => [
                    'available' => $windows !== null,
                    'version' => self::WINDOWS_VERSION,
                    'filename' => self::WINDOWS_INSTALLER,
                    'size' => $windows ? File::size($windows) : null,
                    'sha256' => $windows ? hash_file('sha256', $windows) : null,
                    'url' => $windows ? route('desktop-downloads.windows') : null,
                ],
                'mac' => [
                    'available' => $mac !== null,
                    'version' => $mac ? self::MAC_VERSION : null,
                    'filename' => $mac ? basename($mac) : null,
                    'size' => $mac ? File::size($mac) : null,
                    'sha256' => $mac ? hash_file('sha256', $mac) : null,
                    'url' => $mac ? route('desktop-downloads.mac') : null,
                ],
            ],
        ]);
    }

    public function windows()
    {
        $path = $this->windowsInstaller();

        abort_unless($path, 404);

        return response()->download($path, self::WINDOWS_INSTALLER, [
            'Content-Type' => 'application/vnd.microsoft.portable-executable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function mac()
    {
        $path = $this->macInstaller();

        abort_unless($path, 404);

        return response()->download($path, basename($path), [
            'Content-Type' => 'application/x-apple-diskimage',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function windowsInstaller(): ?string
    {
        $candidates = [
            storage_path('app/desktop-installers/'.self::WINDOWS_INSTALLER),
            base_path('desktop/dist-app/'.self::WINDOWS_INSTALLER),
        ];

        foreach ($candidates as $path) {
            if (File::isFile($path)) {
                return $path;
            }
        }

        return null;
    }

    private function macInstaller(): ?string
    {
        foreach (self::MAC_INSTALLERS as $name) {
            foreach ([storage_path('app/desktop-installers/'.$name), base_path('desktop/dist-app/'.$name)] as $path) {
                if (File::isFile($path)) {
                    return $path;
                }
            }
        }

        return null;
    }
}
