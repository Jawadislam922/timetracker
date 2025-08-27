<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\UpworkProfile;

class UpworkProfileSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $trackers = config('workhours.trackers', []);
        
        foreach ($trackers as $tracker) {
            UpworkProfile::firstOrCreate(
                ['name' => $tracker],
                [
                    'name' => $tracker,
                    'is_active' => true,
                    'description' => 'Migrated from config',
                ]
            );
        }
    }
}
