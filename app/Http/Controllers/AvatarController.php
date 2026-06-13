<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Stable, cacheable avatar proxy. The old approach minted a fresh presigned
 * S3 URL on every render, so the browser could never cache an avatar and a
 * single team page fired ~50 simultaneous signed GETs to the bucket in
 * Stockholm — slow, and enough to trip S3's 503 throttling. This serves each
 * avatar from a stable URL with a week-long browser cache and a server-side
 * byte cache, so S3 is touched at most once per image until it changes.
 */
class AvatarController extends Controller
{
    public function show(Request $request, User $user)
    {
        $path = $user->avatar;

        // No avatar, or the file vanished — 404 so the frontend draws initials.
        if (! $path) {
            abort(404);
        }

        $etag = '"'.substr(md5($path), 0, 16).'"';

        // Conditional request: the URL carries ?v=<hash> and never changes for
        // a given image, so once the browser has it, it only revalidates.
        if (trim((string) $request->header('If-None-Match')) === $etag) {
            return response('', 304, ['ETag' => $etag, 'Cache-Control' => 'public, max-age=604800']);
        }

        $bytes = Cache::remember('avatar-bytes:'.md5($path), now()->addDays(7), function () use ($path) {
            return Storage::disk('avatars')->exists($path)
                ? Storage::disk('avatars')->get($path)
                : false;
        });

        if ($bytes === false) {
            // Don't cache the miss permanently — file may appear after upload.
            Cache::forget('avatar-bytes:'.md5($path));
            abort(404);
        }

        return response($bytes, 200, [
            'Content-Type' => $this->mimeFor($path),
            'Cache-Control' => 'public, max-age=604800',
            'ETag' => $etag,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function mimeFor(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            default => 'image/jpeg',
        };
    }
}
