<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets a client be ARCHIVED when its contract is finished. Archived clients
 * (is_active = false) disappear from the pickers used to log NEW work, but all
 * historical hours, reports, and timeline entries that reference them keep
 * showing. Reversible — flip the flag back to re-activate. Defaults true so
 * every existing client stays active.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->index();
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
