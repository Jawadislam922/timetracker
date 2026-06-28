<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The feedback / request inbox. When the Help search can't answer something (a
 * missing setting, a feature wish) the question is captured here instead of
 * lost, and managers triage it. `context` keeps what they were looking for
 * (search query, page) so a request is actionable without a back-and-forth.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feedback_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type')->default('question');  // question | feature_request | bug | missing_doc
            $table->string('subject');
            $table->text('message');
            $table->json('context')->nullable();          // { query, url }
            $table->string('status')->default('new');      // new | in_review | planned | done | declined
            $table->text('response')->nullable();          // manager reply
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('handled_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_items');
    }
};
