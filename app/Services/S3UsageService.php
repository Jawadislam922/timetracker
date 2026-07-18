<?php

namespace App\Services;

use Aws\CloudWatch\CloudWatchClient;
use Aws\CostExplorer\CostExplorerClient;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Reports how much space the screenshots S3 bucket uses and roughly what it
 * costs, for the admin Storage panel. Size/objects come from CloudWatch daily
 * metrics (one cheap call — never a list-objects sweep of a huge bucket); the
 * cost is a price estimate, optionally backed by real Cost Explorer spend.
 *
 * The IAM user needs cloudwatch:GetMetricStatistics (and ce:GetCostAndUsage for
 * the real-cost line). Failures degrade to a clear "needs permission" message.
 */
class S3UsageService
{
    // eu-north-1 (Stockholm) S3 Standard ≈ $0.023 per GB-month at time of writing.
    private const USD_PER_GB_MONTH = 0.023;

    private const CACHE_KEY = 's3-usage';

    public function usage(bool $withRealCost = false, bool $fresh = false): array
    {
        if (! $fresh && ($cached = Cache::get(self::CACHE_KEY))) {
            return $cached;
        }

        $result = $this->compute($withRealCost);

        // Only cache good results, so a re-check works right after IAM is fixed.
        if (($result['configured'] ?? false) && empty($result['error'])) {
            Cache::put(self::CACHE_KEY, $result, now()->addHours(6));
        }

        return $result;
    }

    private function compute(bool $withRealCost): array
    {
        $disk = config('filesystems.disks.screenshots');
        $bucket = $disk['bucket'] ?? null;
        $region = $disk['region'] ?? config('filesystems.disks.s3.region');
        $key = $disk['key'] ?? null;
        $secret = $disk['secret'] ?? null;

        if (! $bucket || ! $key) {
            return ['configured' => false, 'message' => 'Screenshots are not on S3 (no bucket configured).'];
        }

        $creds = ['key' => $key, 'secret' => $secret];

        try {
            $cw = new CloudWatchClient(['version' => 'latest', 'region' => $region, 'credentials' => $creds]);
            $bytes = $this->metric($cw, $bucket, 'BucketSizeBytes', 'StandardStorage');
            $objects = $this->metric($cw, $bucket, 'NumberOfObjects', 'AllStorageTypes');
        } catch (\Throwable $e) {
            return ['configured' => true, 'bucket' => $bucket, 'region' => $region, 'error' => $this->friendlyError($e)];
        }

        $gb = $bytes !== null ? $bytes / 1073741824 : null;

        $out = [
            'configured' => true,
            'bucket' => $bucket,
            'region' => $region,
            'bytes' => $bytes,
            'gb' => $gb !== null ? round($gb, 3) : null,
            'objects' => $objects !== null ? (int) $objects : null,
            'estimated_monthly_usd' => $gb !== null ? round($gb * self::USD_PER_GB_MONTH, 2) : null,
            'price_per_gb_month' => self::USD_PER_GB_MONTH,
            'as_of' => now()->toDateTimeString(),
        ];

        if ($withRealCost) {
            $out['real_cost'] = $this->realCost($creds);
        }

        return $out;
    }

    /** Latest daily datapoint for an S3 CloudWatch metric, or null if none yet. */
    private function metric(CloudWatchClient $cw, string $bucket, string $metric, string $storageType): ?float
    {
        $res = $cw->getMetricStatistics([
            'Namespace' => 'AWS/S3',
            'MetricName' => $metric,
            'Dimensions' => [
                ['Name' => 'BucketName', 'Value' => $bucket],
                ['Name' => 'StorageType', 'Value' => $storageType],
            ],
            'StartTime' => Carbon::now()->subDays(3)->toIso8601String(),
            'EndTime' => Carbon::now()->toIso8601String(),
            'Period' => 86400,
            'Statistics' => ['Average'],
        ]);

        $points = $res['Datapoints'] ?? [];
        if (! $points) {
            return null;
        }
        usort($points, fn ($a, $b) => $a['Timestamp'] <=> $b['Timestamp']);

        return (float) end($points)['Average'];
    }

    /** Month-to-date actual S3 spend from Cost Explorer (needs it enabled). */
    private function realCost(array $creds): array
    {
        try {
            // Cost Explorer is a global service; its endpoint lives in us-east-1.
            $ce = new CostExplorerClient(['version' => 'latest', 'region' => 'us-east-1', 'credentials' => $creds]);
            $res = $ce->getCostAndUsage([
                'TimePeriod' => ['Start' => now()->startOfMonth()->toDateString(), 'End' => now()->addDay()->toDateString()],
                'Granularity' => 'MONTHLY',
                'Metrics' => ['UnblendedCost'],
                'Filter' => ['Dimensions' => ['Key' => 'SERVICE', 'Values' => ['Amazon Simple Storage Service']]],
            ]);
            $total = $res['ResultsByTime'][0]['Total']['UnblendedCost'] ?? null;

            return [
                'amount' => isset($total['Amount']) ? round((float) $total['Amount'], 2) : null,
                'unit' => $total['Unit'] ?? 'USD',
                'period' => 'month-to-date',
            ];
        } catch (\Throwable $e) {
            return ['error' => $this->friendlyError($e)];
        }
    }

    private function friendlyError(\Throwable $e): string
    {
        $msg = $e->getMessage();
        if (str_contains($msg, 'AccessDenied') || str_contains($msg, 'not authorized') || str_contains($msg, 'authorization')) {
            return 'AWS denied access — the IAM user needs cloudwatch:GetMetricStatistics (and ce:GetCostAndUsage for real cost).';
        }

        return 'AWS error: '.mb_substr($msg, 0, 180);
    }
}
