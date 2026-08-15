<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM-ify the client record: how to reach them and how they prefer to be
 * approached. The client list stopped being a bare name list the day the
 * company started managing ~1,100 of them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('email')->nullable()->after('name');
            $table->string('phone', 40)->nullable()->after('email');
            // upwork | email | phone | whatsapp | slack — free string so a new
            // channel doesn't need a migration; the UI offers the known set.
            $table->string('preferred_contact', 20)->nullable()->after('phone');
            $table->string('contact_notes', 500)->nullable()->after('preferred_contact');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['email', 'phone', 'preferred_contact', 'contact_notes']);
        });
    }
};
