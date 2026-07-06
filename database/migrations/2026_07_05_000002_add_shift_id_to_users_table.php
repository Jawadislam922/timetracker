<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Assign each user a curated shift (shifts.id). nullOnDelete so deleting a shift
 * from the managed list automatically clears it from everyone who had it (the
 * owner's chosen "just clear it from them"). Backfills existing users from their
 * shift start hour into the matching seeded shift; admins refine afterwards.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'shift_id')) {
                $table->foreignId('shift_id')->nullable()->after('shift_start_time')
                    ->constrained('shifts')->nullOnDelete();
            }
        });

        $shiftIdByName = DB::table('shifts')->pluck('id', 'name');
        $bandName = function (int $hour): string {
            if ($hour >= 5 && $hour <= 11) {
                return 'Morning';
            }
            if ($hour >= 12 && $hour <= 15) {
                return 'Noon';
            }
            if ($hour >= 16 && $hour <= 20) {
                return 'Evening';
            }

            return 'Night'; // 21–23 and 00–04
        };

        DB::table('users')
            ->whereNotNull('shift_start_time')
            ->select('id', 'shift_start_time')
            ->orderBy('id')
            ->chunk(200, function ($users) use ($shiftIdByName, $bandName) {
                foreach ($users as $u) {
                    $hour = (int) substr((string) $u->shift_start_time, 0, 2);
                    $shiftId = $shiftIdByName[$bandName($hour)] ?? null;
                    if ($shiftId) {
                        DB::table('users')->where('id', $u->id)->update(['shift_id' => $shiftId]);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'shift_id')) {
                $table->dropConstrainedForeignId('shift_id');
            }
        });
    }
};
