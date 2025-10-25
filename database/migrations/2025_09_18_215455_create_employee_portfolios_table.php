<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('employee_portfolios', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('title');
            $table->text('tagline')->nullable();
            $table->json('stats_json')->nullable(); // [{label, value}]
            $table->string('profile_image_path')->nullable();
            $table->longText('about');
            $table->json('services_json')->nullable(); // [{title, bullets[]}]
            $table->json('employment_json')->nullable(); // [{role, company, start, end, bullets[]}]
            $table->json('skills_json')->nullable(); // [{title, items[]}]
            $table->json('why_json')->nullable(); // [{title, description}]
            $table->json('contact_json')->nullable(); // {email, upwork, whatsapp, linkedin, instagram, website}
            $table->string('theme')->default('emerald');
            $table->boolean('is_draft')->default(true);
            $table->boolean('is_published')->default(false);
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index(['slug', 'is_published']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_portfolios');
    }
};
