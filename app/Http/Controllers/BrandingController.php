<?php

namespace App\Http\Controllers;

use App\Models\MonitoringSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Self-service app logo. Stored on the S3-backed avatars disk so the host's
 * deploy pruning can't wipe it, and swappable from the Developer page without
 * a code change.
 */
class BrandingController extends Controller
{
    /**
     * Serve the uploaded logo (public — it appears on the login page).
     * 404 when none is uploaded; the frontend falls back to the bundled logo.
     */
    public function logo(Request $request)
    {
        $path = MonitoringSetting::current()->branding_logo_path;

        abort_unless((bool) $path, 404);

        $etag = '"'.substr(md5($path), 0, 16).'"';
        if (trim((string) $request->header('If-None-Match')) === $etag) {
            return response('', 304, ['ETag' => $etag, 'Cache-Control' => 'public, max-age=604800']);
        }

        // Cache the bytes on the app server so we don't re-stream the logo
        // from S3 (Stockholm) on every page — that round-trip was ~2.7s.
        $bytes = Cache::remember('branding-logo-bytes:'.md5($path), now()->addDays(7), function () use ($path) {
            return Storage::disk('avatars')->exists($path)
                ? Storage::disk('avatars')->get($path)
                : false;
        });

        if ($bytes === false) {
            Cache::forget('branding-logo-bytes:'.md5($path));
            abort(404);
        }

        $mime = match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'png' => 'image/png',
            'webp' => 'image/webp',
            default => 'image/jpeg',
        };

        return response($bytes, 200, [
            'Content-Type' => $mime,
            'Cache-Control' => 'public, max-age=604800',
            'ETag' => $etag,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $request->validate([
            'logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:8192'],
        ]);

        $settings = MonitoringSetting::current();
        $old = $settings->branding_logo_path;

        $path = $request->file('logo')->store('branding', 'avatars');
        $settings->update(['branding_logo_path' => $path]);

        if ($old && $old !== $path) {
            Storage::disk('avatars')->delete($old);
        }

        Cache::forget('branding.shared');

        return back()->with('success', 'Logo updated. Browsers may show the old one for a moment until their cache refreshes.');
    }
}
