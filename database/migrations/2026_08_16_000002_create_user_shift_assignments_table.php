<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Effective-dated history of each user's standing shift.
 *
 * Shift timing lived only on mutable `users` columns, so editing someone's
 * shift — or moving them to another one — silently re-judged their ENTIRE past:
 * days they had arrived on time started reading as "late" because the historical
 * date was compared against the shift they hold today. HR changes shifts
 * routinely, so the attendance record drifted every time.
 *
 * Each row is a complete SNAPSHOT of the shift config that took effect on
 * `effective_from`. Resolution for a date D is "the latest row with
 * effective_from <= D", so eras need no end date and there are no gap/overlap
 * invariants to maintain. One-day exceptions stay in `user_shift_overrides` and
 * still win over the era for their exact date.
 *
 * The `users.*` columns remain as the current-value cache and are still written
 * on every change; they are also the fallback when no row covers a date.
 */
return new class extends Migration
{
    /**
     * Deliberately far in the past so the seeded era covers every historical
     * punch — including any that predate a user's recorded joining date.
     */
    private const HISTORY_FLOOR = '2000-01-01';

    public function up(): void
    {
        Schema::create('user_shift_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('effective_from');
            $table->time('shift_start_time')->nullable();
            $table->unsignedSmallInteger('shift_grace_minutes')->nullable();
            $table->decimal('shift_hours', 4, 2)->nullable();
            $table->string('work_timezone', 64)->nullable();
            $table->foreignId('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->string('reason', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // One era per user per start date — a second edit on the same day
            // updates that era instead of stacking rows.
            $table->unique(['user_id', 'effective_from']);
            $table->index(['user_id', 'effective_from']);
        });

        // Seed one era per existing user carrying their CURRENT values, so every
        // historical date resolves to exactly what it resolves to today. This
        // migration changes no attendance status at deploy; it only stops the
        // drift from here on.
        $now = now();
        DB::table('users')->orderBy('id')->chunkById(200, function ($users) use ($now) {
            $rows = [];
            foreach ($users as $user) {
                $rows[] = [
                    'user_id' => $user->id,
                    'effective_from' => self::HISTORY_FLOOR,
                    'shift_start_time' => $user->shift_start_time,
                    'shift_grace_minutes' => $user->shift_grace_minutes,
                    'shift_hours' => $user->shift_hours,
                    'work_timezone' => $user->work_timezone,
                    'shift_id' => $user->shift_id ?? null,
                    'reason' => 'Backfill: standing shift at history cutover',
                    'created_by' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            if ($rows) {
                DB::table('user_shift_assignments')->insert($rows);
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_shift_assignments');
    }
};
