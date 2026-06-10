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
     * Accepted macOS artifact names, preferred first. A DMG is preferred, but
     * a zipped .app bundle is a perfectly valid distribution too (download,
     * unzip, drag to Applications).
     */
    private const MAC_INSTALLERS = [
        'Timetracker Desktop-0.1.0-universal.dmg',
        'Timetracker Desktop-0.1.0-arm64.dmg',
        'Timetracker Desktop-0.1.0.dmg',
        'Timetracker Desktop-0.1.0-arm64-mac.zip',
        'Timetracker Desktop-0.1.0-mac.zip',
        'Timetracker Desktop.app.zip',
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

        $contentType = str_ends_with(strtolower($path), '.zip')
            ? 'application/zip'
            : 'application/x-apple-diskimage';

        return response()->download($path, basename($path), [
            'Content-Type' => $contentType,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Directories searched for installer artifacts, in priority order.
     *
     * The first is an absolute path set via DESKTOP_INSTALLERS_PATH — used in
     * production because Hostinger's git auto-deploy wipes untracked files
     * inside the deployed tree (including storage/app), so installers must
     * live OUTSIDE the working tree to survive a deploy. The remaining paths
     * are local-dev fallbacks.
     */
    private function searchDirs(): array
    {
        return array_filter([
            config('desktop.installers_path'),
            storage_path('app/desktop-installers'),
            base_path('desktop/dist-app'),
        ]);
    }

    private function windowsInstaller(): ?string
    {
        return $this->findInstaller([self::WINDOWS_INSTALLER]);
    }

    private function macInstaller(): ?string
    {
        return $this->findInstaller(self::MAC_INSTALLERS);
    }

    /**
     * @param  string[]  $filenames
     */
    private function findInstaller(array $filenames): ?string
    {
        foreach ($this->searchDirs() as $dir) {
            foreach ($filenames as $name) {
                $path = rtrim($dir, '/').'/'.$name;
                if (File::isFile($path)) {
                    return $path;
                }
            }
        }

        return null;
    }
}
