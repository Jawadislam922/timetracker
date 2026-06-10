<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack_reports' => [
        'webhook_url' => env('SLACK_REPORT_WEBHOOK_URL'),
        'weekly_enabled' => (bool) env('SLACK_WEEKLY_REPORT_ENABLED', false),
        'daily_digest_enabled' => (bool) env('SLACK_DAILY_DIGEST_ENABLED', false),
        'daily_digest_time' => env('SLACK_DAILY_DIGEST_TIME', '09:00'),
        'timezone' => env('SLACK_REPORT_TIMEZONE', 'Asia/Karachi'),
    ],

];
