<?php

namespace App\Support;

/**
 * Signatures for tools that get an Upwork account flagged — auto-refresh /
 * bidding extensions, scrapers, and mouse jigglers / auto-clickers — plus
 * VPN/proxy and automation frameworks kept for review.
 *
 * Two design rules learned the hard way:
 *
 *  1. Match on the tool's NAME (and a program's publisher), never on the
 *     capabilities it requests. An earlier version folded each extension's
 *     manifest `permissions` into the searched text, so anything that merely
 *     asked for the "proxy" permission — Similarweb, IDM, ad blockers — was
 *     mislabelled a VPN. describe() now only sees identity fields.
 *
 *  2. Only the genuinely Upwork-banning categories ALERT (Slack). VPNs and
 *     automation frameworks are recorded and shown on the dashboard for review
 *     but never ping a channel — that is the owner's policy. See `alert`.
 *
 * Matching is deliberately for REVIEW, not automatic punishment: a hit surfaces
 * the machine on the compliance dashboard so a human confirms.
 *
 * @see MachineReport
 */
class AutomationBlocklist
{
    /**
     * category => ['severity' => .., 'alert' => bool, 'patterns' => [regex, ...]].
     * `alert` gates the Slack digest: true only for the tools Upwork bans for.
     */
    private const RULES = [
        'upwork_refresh_bid' => [
            'severity' => 'critical',
            'alert' => true,
            'patterns' => [
                'auto.?refresh', 'easy auto refresh', 'super.?refresh', 'auto.?bid', 'auto.?propos',
                'connects.?bot', 'upwork.?bot', 'upwork.?automat', 'upwork.?assist', 'freelanc.?bot',
                'job.?alert.?bot',
            ],
        ],
        'scraper' => [
            'severity' => 'critical',
            'alert' => true,
            'patterns' => [
                'instant data scraper', 'web.?scraper', 'data.?scraper', '\\bscraper\\b', 'scrape',
                'octoparse', 'parsehub', 'simplescraper', 'listly', 'webharvy',
            ],
        ],
        'jiggler_autoclicker' => [
            'severity' => 'critical',
            'alert' => true,
            'patterns' => [
                'mouse.?jiggl', '\\bjiggler\\b', 'move.?mouse', 'mouse.?mover', 'mouse.?wiggl',
                'auto.?click', 'autoclick', 'gs auto clicker', 'op auto clicker', 'tinytask', 'tiny task',
                'murgee', 'auto.?mouse', 'ghost.?mouse', 'mini.?mouse', 'clickermann', 'autohotkey',
                'macro.?record',
            ],
        ],
        // Recorded + shown, but never alerts (owner's policy: VPNs are review-only).
        'vpn_proxy' => [
            'severity' => 'high',
            'alert' => false,
            'patterns' => [
                '\\bvpn\\b', 'browsec', '\\bhola\\b', 'windscribe', 'nordvpn', 'expressvpn', 'proton.?vpn',
                'hotspot.?shield', 'urban.?vpn', '1click.?vpn', 'touch.?vpn', 'zenmate', 'tunnelbear',
                'setupvpn', 'betternet', 'psiphon', 'ultrasurf', 'surfshark', 'veepn', '\\buvpn\\b', '\\b1vpn\\b',
            ],
        ],
        'automation_framework' => [
            'severity' => 'medium',
            'alert' => false,
            'patterns' => [
                'selenium', 'puppeteer', 'playwright', 'uipath', 'power.?automate', 'automa\\b',
                'browserflow', 'axiom.?ai', 'bardeen', 'multilogin', 'gologin', 'dolphin.?anty',
                'antidetect', 'incogniton',
            ],
        ],
    ];

    /**
     * Known-safe tools whose NAME can contain a trigger word (or that used to
     * false-match). Lowercased substrings tested against the item's identity
     * text; a match suppresses the item entirely. Belt-and-suspenders now that
     * matching is name-only — an owner can grow this list from the dashboard's
     * "Ignore" action later.
     */
    private const ALLOWLIST = [
        'ublock origin', 'adguard adblocker', 'adblock plus', 'ghostery', 'privacy badger',
        'proxy switchyomega', 'switchyomega', 'modheader', 'postman',
        'idm integration module', 'internet download manager', 'free download manager',
        'similarweb', 'mozbar', 'ahrefs', 'seoquake', 'keywords everywhere',
        'skyline dataminer',
    ];

    /** Identity fields we search, per report kind. Never permissions/path/id/url. */
    private const IDENTITY_FIELDS = [
        'extensions' => ['name'],
        'programs' => ['name', 'publisher'],
        'processes' => ['process'],
        'network' => ['adapter', 'description'],
    ];

    private const IDENTITY_FALLBACK = ['name', 'title', 'publisher', 'process', 'adapter', 'description'];

    /**
     * Scan a list of inventory items for a given report kind.
     *
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>  matched items decorated with rule + severity + alert
     */
    public static function scan(array $items, ?string $kind = null): array
    {
        $hits = [];

        foreach ($items as $item) {
            $text = strtolower(self::describe($item, $kind));
            if ($text === '' || self::isAllowlisted($text)) {
                continue;
            }

            foreach (self::RULES as $category => $rule) {
                foreach ($rule['patterns'] as $pattern) {
                    if (preg_match('/'.$pattern.'/i', $text)) {
                        $hits[] = array_merge($item, [
                            'rule' => $category,
                            'severity' => $rule['severity'],
                            'alert' => $rule['alert'],
                            'matched' => $pattern,
                        ]);
                        continue 3; // one hit per item is enough
                    }
                }
            }
        }

        return $hits;
    }

    private static function isAllowlisted(string $text): bool
    {
        foreach (self::ALLOWLIST as $safe) {
            if (str_contains($text, $safe)) {
                return true;
            }
        }

        return false;
    }

    /** Flatten an item into the identity text we test — kind-aware, name-first. */
    private static function describe(array $item, ?string $kind): string
    {
        $fields = self::IDENTITY_FIELDS[$kind] ?? self::IDENTITY_FALLBACK;

        $parts = [];
        foreach ($fields as $k) {
            if (! empty($item[$k]) && is_string($item[$k])) {
                $parts[] = $item[$k];
            }
        }

        return trim(implode(' ', $parts));
    }
}
