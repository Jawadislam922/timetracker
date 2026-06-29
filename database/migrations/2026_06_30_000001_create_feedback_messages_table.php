<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Turns each feedback request into a threaded conversation: the original request
 * stays on feedback_items (subject/message/status), and every reply — from the
 * submitter or a manager — becomes a feedback_messages row. Read state is two
 * timestamps on the item: response_seen_at (when the SUBMITTER last read the
 * thread) and manager_seen_at (when a MANAGER last read it), which drive the
 * unread badges and the "Seen / not read yet" receipts in both directions.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feedback_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('feedback_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body');
            $table->timestamps();
            $table->index(['feedback_item_id', 'created_at']);
        });

        Schema::table('feedback_items', function (Blueprint $table) {
            $table->timestamp('manager_seen_at')->nullable()->after('response_seen_at');
        });

        // Backfill: fold each existing single `response` into the thread as the
        // first reply, authored by whoever handled it, so prior replies survive.
        foreach (DB::table('feedback_items')->whereNotNull('response')->where('response', '<>', '')->get() as $item) {
            $when = $item->handled_at ?? $item->updated_at ?? now();
            DB::table('feedback_messages')->insert([
                'feedback_item_id' => $item->id,
                'user_id' => $item->handled_by,
                'body' => $item->response,
                'created_at' => $when,
                'updated_at' => $when,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('feedback_items', function (Blueprint $table) {
            $table->dropColumn('manager_seen_at');
        });
        Schema::dropIfExists('feedback_messages');
    }
};
