<?php

namespace App\Support;

/**
 * Signatures for tools that get an Upwork account flagged — auto-refresh /
 * bidding extensions, scrapers, mouse jigglers / auto-clickers / macro tools,
 * and VPN/proxy software. Matching is deliberately for REVIEW, not automatic
 * punishment: a hit surfaces the machine on the compliance dashboard so a human
 * confirms. Patterns are lowercase substrings/regex tested against each
 * inventory item's descriptive text.
 *
 * @see MachineReport
 */
class AutomationBlocklist
{
    /**
     * category => ['severity' => .., 'patterns' => [regex, ...]].
     * Severity: 'critical' (Upwork-banning), 'high', 'warn'.
     */
    private const RULES = [
        'upwork_refresh_bid' => [
            'severity' => 'critical',
            'patterns' => [
                'auto.?refresh', 'easy auto refresh', 'tab.?reload', 'page.?refresh', 'super.?refresh',
                'reloader', 'auto.?bid', 'bidder', 'auto.?apply', 'auto.?propos', 'connects.?bot',
                'upwork.?bot', 'upwork.?automat', 'upwork.?assist', 'freelanc.?bot', 'job.?alert.?bot',
            ],
        ],
        'scraper' => [
            'severity' => 'critical',
            'patterns' => [
                'instant data scraper', 'web.?scraper', 'data.?miner', 'data.?scraper', '\\bscraper\\b',
                'scrape', 'crawler', 'listly', 'octoparse', 'parsehub', 'simplescraper',
            ],
        ],
        'jiggler_autoclicker' => [
            'severity' => 'critical',
            'patterns' => [
                'mouse.?jiggl', '\\bjiggler\\b', 'move.?mouse', 'movemouse', 'mouse.?mover', 'mouse.?wiggl',
                'auto.?click', 'autoclick', 'gs auto clicker', 'op auto clicker', 'tinytask', 'tiny task',
                'auto.?hotkey', 'autohotkey', '\\bahk\\b', 'macro.?record', 'macro.?recorder', 'pulover',
                'murgee', 'auto.?mouse', 'anti.?idle', 'keep.?awake', 'presentation assistant', 'caffeine',
                'nircmd', 'autoit', 'sikuli', 'ghost.?mouse', 'mini.?mouse', 'actiona', 'xdotool',
            ],
        ],
        'vpn_proxy' => [
            'severity' => 'high',
            'patterns' => [
                '\\bvpn\\b', 'browsec', 'hola', 'windscribe', 'nordvpn', 'expressvpn', 'proton.?vpn',
                'hotspot.?shield', 'urban.?vpn', '1click.?vpn', 'touch.?vpn', 'zenmate', 'tunnelbear',
                'setupvpn', 'betternet', 'psiphon', 'ultrasurf', '\\bproxy\\b', 'proxy.?switch',
            ],
        ],
        'automation_framework' => [
            'severity' => 'high',
            'patterns' => [
                'selenium', 'puppeteer', 'playwright', 'uipath', 'power.?automate', 'automa\\b',
                'browserflow', 'axiom.?ai', 'bardeen', 'multilogin', 'gologin', 'dolphin.?anty',
                'antidetect', 'incogniton',
            ],
        ],
    ];

    /**
     * Scan a list of inventory items for a given report kind.
     *
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>  matched items decorated with rule + severity
     */
    public static function scan(array $items): array
    {
        $hits = [];

        foreach ($items as $item) {
            $text = strtolower(self::describe($item));
            if ($text === '') {
                continue;
            }

            foreach (self::RULES as $category => $rule) {
                foreach ($rule['patterns'] as $pattern) {
                    if (preg_match('/'.$pattern.'/i', $text)) {
                        $hits[] = array_merge($item, [
                            'rule' => $category,
                            'severity' => $rule['severity'],
                            'matched' => $pattern,
                        ]);
                        continue 3; // one hit per item is enough
                    }
                }
            }
        }

        return $hits;
    }

    /** Flatten an item into the text we test — tolerant of every kind's shape. */
    private static function describe(array $item): string
    {
        $parts = [];
        foreach (['name', 'title', 'publisher', 'path', 'id', 'description', 'adapter', 'process', 'url', 'domain'] as $k) {
            if (! empty($item[$k]) && is_string($item[$k])) {
                $parts[] = $item[$k];
            }
        }
        if (! empty($item['permissions']) && is_array($item['permissions'])) {
            $parts[] = implode(' ', array_filter($item['permissions'], 'is_string'));
        }

        return trim(implode(' ', $parts));
    }
}
