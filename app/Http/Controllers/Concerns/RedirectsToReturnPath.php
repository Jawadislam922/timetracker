<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Send the user back to the exact list they came from.
 *
 * Index pages carry page number, search term, filters and page size in the
 * query string. A plain `redirect()->route('x.index')` after a save throws all
 * of that away and drops the user on page 1 — infuriating on a list of a
 * thousand clients. Forms and row actions therefore submit a `return_to` path
 * (the list's `pathname + search`), and every mutation redirects through here.
 *
 * `return_to` is attacker-controllable, so only a same-origin ABSOLUTE PATH is
 * honoured: it must start with a single "/" (a leading "//" would be a
 * protocol-relative URL pointing at another host). Anything else falls back to
 * the named route.
 */
trait RedirectsToReturnPath
{
    /**
     * @param  array<string, string>  $with  flash data for the redirect
     */
    protected function redirectToReturnPath(Request $request, string $fallbackRoute, array $with = []): RedirectResponse
    {
        $returnTo = $request->input('return_to');

        $redirect = is_string($returnTo)
            && str_starts_with($returnTo, '/')
            && ! str_starts_with($returnTo, '//')
                ? redirect($returnTo)
                : redirect()->route($fallbackRoute);

        foreach ($with as $key => $value) {
            $redirect->with($key, $value);
        }

        return $redirect;
    }
}
