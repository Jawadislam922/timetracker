<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Durable ledger of flagged tools, one row per (user, device, tool-signature).
 * Replaces the ephemeral file-cache dedup that re-announced every 24h and after
 * every `cache:clear` on deploy. A tool now alerts exactly ONCE when it first
 * appears (a real install), stays quiet while present, auto-resolves when it
 * disappears, and re-alerts only if it comes back. Managers can Acknowledge
 * (seen, stay quiet) or Ignore (never alert on this machine again).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('machine_flags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_name', 120)->nullable();
            $table->string('kind', 32);                 // extensions|programs|processes|network
            $table->string('rule', 40);                 // blocklist category
            $table->string('severity', 16);             // critical|high|medium|low
            $table->boolean('alert')->default(false);   // does this category ping Slack
            $table->string('label', 200);               // display name of the tool
            $table->string('signature', 64);            // md5(rule | canonical identity)
            $table->string('status', 16)->default('open'); // open|acknowledged|ignored|resolved
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('alerted_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acknowledged_at')->nullable();
            $table->string('note', 500)->nullable();
            $table->string('app_version', 20)->nullable();
            $table->string('platform', 20)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'device_name', 'signature']);
            $table->index(['status', 'severity']);
            $table->index('rule');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_flags');
    }
};
