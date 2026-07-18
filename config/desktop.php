<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Desktop installer storage path
    |--------------------------------------------------------------------------
    |
    | Absolute path to the directory holding the packaged desktop installers
    | (the .exe and .dmg). On Hostinger this MUST point outside the deployed
    | public_html tree, because git auto-deploy wipes untracked files there.
    | Leave null for local development to use the in-repo / storage fallbacks.
    |
    */

    'installers_path' => env('DESKTOP_INSTALLERS_PATH'),

    /*
    |--------------------------------------------------------------------------
    | Public installer CDN base URL (S3 / CloudFront)
    |--------------------------------------------------------------------------
    |
    | When set, requests for a desktop installer (.exe/.dmg/.zip) are 302'd to
    | this base instead of being streamed through PHP. Shared hosting cuts long
    | downloads of the ~90MB installer mid-transfer and electron-updater cannot
    | resume, so it restarted from 0 forever. S3 serves it reliably.
    |
    | No trailing slash, e.g. https://sparkingasia-timetracker-downloads.s3.eu-north-1.amazonaws.com
    | Leave null to keep serving installers from local disk.
    |
    */

    'downloads_base_url' => env('DESKTOP_DOWNLOADS_BASE_URL'),

];
