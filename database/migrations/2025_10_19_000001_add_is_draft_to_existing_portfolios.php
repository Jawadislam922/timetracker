<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This migration adds the is_draft column to existing employee_portfolios tables.
     * Only run this if you already have the employee_portfolios table without is_draft.
     */
    public function up(): void
    {
        if (Schema::hasTable('employee_portfolios') && !Schema::hasColumn('employee_portfolios', 'is_draft')) {
            Schema::table('employee_portfolios', function (Blueprint $table) {
                $table->boolean('is_draft')->default(true)->after('theme');
            });
            
            // Update existing records: if is_published = true, set is_draft = false
            DB::table('employee_portfolios')
                ->where('is_published', true)
                ->update(['is_draft' => false]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('employee_portfolios', 'is_draft')) {
            Schema::table('employee_portfolios', function (Blueprint $table) {
                $table->dropColumn('is_draft');
            });
        }
    }
};
