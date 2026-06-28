<?php

namespace App\Services\Concerns;

/**
 * Shared Slack Block Kit cell + hours formatting, used by both the work-hours
 * and attendance digest services so the two can't drift (PR5 — these were
 * byte-for-byte duplicated).
 */
trait FormatsSlackBlocks
{
    private function tableTextCell(string $text): array
    {
        return [
            'type' => 'raw_text',
            'text' => $text,
        ];
    }

    private function tableBoldCell(string $text): array
    {
        return [
            'type' => 'rich_text',
            'elements' => [[
                'type' => 'rich_text_section',
                'elements' => [[
                    'type' => 'text',
                    'text' => $text,
                    'style' => ['bold' => true],
                ]],
            ]],
        ];
    }

    private function formatHours(float $hours): string
    {
        return rtrim(rtrim(number_format($hours, 2, '.', ''), '0'), '.');
    }
}
