<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Inertia\Inertia;

class DesktopDownloadController extends Controller
{
    // Fallback only. The live version + installer are read from the auto-update
    // feed's latest.yml (see activeWindowsRelease) so the download page can never
    // drift behind the updater again; these constants are used only if the
    // manifest can't be read.
    private const WINDOWS_INSTALLER = 'SA Track Setup 0.4.2.exe';

    private const WINDOWS_VERSION = '0.4.2';

    private const MAC_VERSION = '0.3.9';

    /**
     * Accepted macOS artifact names, preferred first. A DMG is preferred, but
     * a zipped .app bundle is a perfectly valid distribution too (download,
     * unzip, drag to Applications). The SA Track-branded 0.3.9 build is the
     * current one; older names are kept as fallbacks.
     */
    private const MAC_INSTALLERS = [
        'SA Track-0.3.9-arm64.dmg',
        'SA Track-0.3.9-arm64-mac.zip',
        'SA Track-0.3.3-arm64.dmg',
        'SA Track-0.3.3-arm64-mac.zip',
        'SA Track-0.3.2-arm64.dmg',
        'SA Track-0.3.2-universal.dmg',
        'SA Track-0.3.2-arm64-mac.zip',
        'Timetracker Desktop-0.2.0-arm64.dmg',
        'Timetracker Desktop-0.1.0-arm64.dmg',
        'Timetracker Desktop-0.1.0-arm64-mac.zip',
        'Timetracker Desktop.app.zip',
    ];

    public function index()
    {
        $release = $this->activeWindowsRelease();
        $windows = $this->installerMeta($this->windowsInstaller());
        $mac = $this->installerMeta($this->macInstaller());

        return Inertia::render('DesktopDownloads', [
            'downloads' => [
                'windows' => [
                    'available' => $windows !== null,
                    'version' => $release['version'],
                    'filename' => $release['installer'],
                    'size' => $windows['size'] ?? null,
                    'sha256' => $windows['sha256'] ?? null,
                    'url' => $windows ? route('desktop-downloads.windows') : null,
                ],
                'mac' => [
                    'available' => $mac !== null,
                    'version' => $mac ? ($this->versionFromFilename(basename($mac['path'])) ?? self::MAC_VERSION) : null,
                    'filename' => $mac ? basename($mac['path']) : null,
                    'size' => $mac['size'] ?? null,
                    'sha256' => $mac['sha256'] ?? null,
                    'url' => $mac ? route('desktop-downloads.mac') : null,
                ],
            ],
        ]);
    }

    /**
     * Size + SHA-256 for an installer, cached keyed by path and mtime.
     *
     * Hashing the ~100MB artifacts on every page view is what made this the
     * slowest page in the app; the mtime in the key means a re-uploaded
     * installer invalidates its entry automatically.
     *
     * @return array{path: string, size: int, sha256: string}|null
     */
    private function installerMeta(?string $path): ?array
    {
        if (! $path) {
            return null;
        }

        $mtime = File::lastModified($path);

        return Cache::rememberForever('installer-meta:'.md5($path).':'.$mtime, fn () => [
            'path' => $path,
            'size' => File::size($path),
            'sha256' => hash_file('sha256', $path),
        ]);
    }

    public function windows()
    {
        $path = $this->windowsInstaller();

        abort_unless($path, 404);

        // Same offload for the manual download button — a browser pulling 90MB
        // through PHP hits the same shared-hosting cut-off.
        if ($redirect = $this->cdnUrlFor(basename($path))) {
            return redirect()->away($redirect, 302);
        }

        return response()->download($path, basename($path), [
            'Content-Type' => 'application/vnd.microsoft.portable-executable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * electron-updater feed: latest.yml plus the artifacts it references.
     * Public — the desktop updater has no web session. Single path segment
     * only; the patterns below block traversal and non-update files.
     */
    public function updates(string $file)
    {
        abort_unless(preg_match('/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/', $file) === 1, 404);
        abort_unless(preg_match('/\.(yml|exe|blockmap|dmg|zip)$/i', $file) === 1, 404);

        // Hand the big binaries off to S3/CloudFront when configured. latest.yml
        // stays local (tiny, and it is what points here). Shared hosting cuts the
        // ~90MB stream mid-download and electron-updater cannot resume; S3 can.
        if ($redirect = $this->cdnUrlFor($file)) {
            return redirect()->away($redirect, 302);
        }

        foreach ($this->searchDirs() as $dir) {
            $path = rtrim($dir, '/').'/'.$file;
            if (File::isFile($path)) {
                // A ~90MB installer over a slow link streams for minutes; don't let
                // the PHP execution-time limit kill it mid-download (the "reaches
                // X%, vanishes, restarts" bug — electron-updater can't resume).
                @set_time_limit(0);

                return response()->file($path, [
                    'Cache-Control' => 'no-cache',
                    'X-Content-Type-Options' => 'nosniff',
                    'Accept-Ranges' => 'bytes',
                ]);
            }
        }

        abort(404);
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
    /**
     * Public CDN URL for an installer binary, or null to serve it locally.
     * Only the large artifacts are offloaded — never latest.yml.
     */
    private function cdnUrlFor(string $file): ?string
    {
        $base = config('desktop.downloads_base_url');
        if (! $base || ! preg_match('/\.(exe|dmg|zip)$/i', $file)) {
            return null;
        }

        return rtrim($base, '/').'/'.rawurlencode($file);
    }

    private function searchDirs(): array
    {
        return array_filter([
            config('desktop.installers_path'),
            storage_path('app/desktop-installers'),
            base_path('desktop/dist-app'),
        ]);
    }

    private function versionFromFilename(string $name): ?string
    {
        return preg_match('/(\d+\.\d+\.\d+)/', $name, $m) ? $m[1] : null;
    }

    private function windowsInstaller(): ?string
    {
        $release = $this->activeWindowsRelease();

        // Prefer the installer the update feed points at; fall back to the
        // compiled-in name so a downloadable build is always offered.
        return $this->findInstaller([$release['installer'], self::WINDOWS_INSTALLER]);
    }

    /**
     * The Windows release the auto-update feed is currently serving, read from
     * latest.yml. Keeping the download page sourced from the SAME manifest the
     * updater uses means the two can never disagree (the 0.4.1-vs-0.4.2 drift
     * that shipped stale installs). Falls back to the constants if the manifest
     * is missing/unparseable or its installer isn't actually on disk.
     *
     * @return array{version: string, installer: string}
     */
    private function activeWindowsRelease(): array
    {
        foreach ($this->searchDirs() as $dir) {
            $manifest = rtrim($dir, '/').'/latest.yml';
            if (! File::isFile($manifest)) {
                continue;
            }

            $yml = File::get($manifest);
            $version = preg_match('/^version:\s*(\S+)/m', $yml, $m) ? trim($m[1]) : null;
            $installer = preg_match('/^path:\s*(.+?)\s*$/m', $yml, $p) ? trim($p[1]) : null;

            // Only trust the manifest if its installer really exists — never
            // advertise a version whose .exe we can't actually serve.
            if ($version && $installer && File::isFile(rtrim($dir, '/').'/'.$installer)) {
                return ['version' => $version, 'installer' => $installer];
            }
        }

        return ['version' => self::WINDOWS_VERSION, 'installer' => self::WINDOWS_INSTALLER];
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
