<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\File;
use Inertia\Inertia;

class DesktopDownloadController extends Controller
{
    private const WINDOWS_INSTALLER = 'Timetracker Desktop Setup 0.1.0.exe';
    private const WINDOWS_VERSION = '0.1.0';

    public function index()
    {
        $windows = $this->windowsInstaller();

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
                    'available' => false,
                    'version' => null,
                    'filename' => null,
                    'size' => null,
                    'sha256' => null,
                    'url' => null,
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
}
