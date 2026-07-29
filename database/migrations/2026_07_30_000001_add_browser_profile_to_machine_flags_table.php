<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which browser profile a flagged extension lives in.
 *
 * People here run 20-30 Chrome profiles on one PC, often one per Upwork account,
 * so "a scraper on PC-VA-7" cannot be acted on — you need to know which profile,
 * and therefore which Upwork account, is carrying the ban risk.
 *
 * NULL means "the agent that reported this could not tell us" (anything older
 * than desktop 0.4.8, and every non-extension kind), NOT "no profile".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('machine_flags', function (Blueprint $table) {
            $table->string('browser_profile', 60)->nullable()->after('label');
        });
    }

    public function down(): void
    {
        Schema::table('machine_flags', function (Blueprint $table) {
            $table->dropColumn('browser_profile');
        });
    }
};
