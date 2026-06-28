<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Knowledge-base articles that power the searchable Help page. Content lives in
 * the DB (not hard-coded JSX) so it can grow and be edited without a deploy, and
 * so a plain scored search over title/keywords/body answers "how do I…" without
 * spending AI credit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('help_articles', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('category')->default('General');
            $table->text('body');                       // markdown-ish: paragraphs, "- " bullets, "1." steps
            $table->string('keywords')->nullable();     // extra search synonyms, space/comma separated
            $table->boolean('admin_only')->default(false); // manager-only guidance
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_published')->default(true);
            $table->timestamps();

            $table->index(['is_published', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('help_articles');
    }
};
