<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When the submitter last SAW the handled state of their request. A request a
 * manager replied to / re-statused AFTER this timestamp (or that was never
 * seen) counts as an unseen reply — that's what drives the submitter's "you
 * have a reply" Inbox badge, which clears the moment they open the inbox.
 * (Reusable unread pattern: seen_at vs handled_at.)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('feedback_items', function (Blueprint $table) {
            $table->timestamp('response_seen_at')->nullable()->after('handled_at');
        });
    }

    public function down(): void
    {
        Schema::table('feedback_items', function (Blueprint $table) {
            $table->dropColumn('response_seen_at');
        });
    }
};
