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
    public function logo()
    {
        $path = MonitoringSetting::current()->branding_logo_path;

        abort_unless($path && Storage::disk('avatars')->exists($path), 404);

        return Storage::disk('avatars')->response($path, null, [
            'Cache-Control' => 'public, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $request->validate([
            'logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:1024'],
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
