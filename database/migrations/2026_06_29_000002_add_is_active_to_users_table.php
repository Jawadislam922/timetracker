<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets a user be DEACTIVATED when they leave the company. A deactivated user
 * (is_active = false) can no longer log in to the web app or the desktop
 * tracker, their existing desktop tokens are revoked, and they drop out of the
 * active directory / assignment / performance views — but all of their history
 * (attendance, work hours, reports) is preserved. Reversible. Defaults true so
 * every existing user stays active.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_active')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
