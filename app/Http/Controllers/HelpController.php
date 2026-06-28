<?php

namespace App\Http\Controllers;

use App\Models\HelpArticle;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The searchable Help knowledge base. Articles live in the DB (HelpArticleSeeder
 * ports the original guide) so they can grow without a deploy and be searched
 * with no AI cost. The whole visible set is handed to the page, which does
 * instant client-side ranked search — the KB is small enough that a round-trip
 * per keystroke would be pure latency. Manager-only articles are filtered here,
 * never shipped to a regular member.
 */
class HelpController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isManager = $user->isSuperAdmin() || count((array) $user->permissions) > 0;

        $articles = HelpArticle::published()
            ->visibleTo($isManager)
            ->orderBy('sort_order')
            ->get(['id', 'title', 'slug', 'category', 'body', 'keywords', 'admin_only']);

        return Inertia::render('Help', [
            'articles' => $articles,
            'isManager' => $isManager,
        ]);
    }
}
