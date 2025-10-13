<?php

namespace App\Http\Controllers;

use App\Models\EmployeePortfolio;
use App\Models\EmployeePortfolioItem;
use App\Http\Requests\PortfolioRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class PortfolioController extends Controller
{
    public function index()
    {
        $portfolios = EmployeePortfolio::where('user_id', Auth::id())
            ->withCount('items')
            ->orderBy('updated_at', 'desc')
            ->get();

        return Inertia::render('Portfolio/List', [
            'portfolios' => $portfolios,
        ]);
    }

    public function create()
    {
        $defaultData = [
            'slug' => '',
            'name' => auth()->user()->name ?? '',
            'title' => '',
            'tagline' => '',
            'stats_json' => [
                ['label' => 'Projects Delivered', 'value' => '50+'],
                ['label' => 'Years Experience', 'value' => '5+'],
                ['label' => 'Client Satisfaction', 'value' => '100%'],
                ['label' => 'Technologies Mastered', 'value' => '15+'],
            ],
            'about' => '',
            'services_json' => [
                [
                    'title' => 'Full-Stack Web Development',
                    'description' => 'Custom web applications built with modern frameworks and best practices'
                ],
                [
                    'title' => 'Mobile App Development',
                    'description' => 'Native and cross-platform mobile solutions for iOS and Android'
                ],
                [
                    'title' => 'UI/UX Design',
                    'description' => 'User-centered design that drives engagement and conversions'
                ],
                [
                    'title' => 'Performance Optimization',
                    'description' => 'Speed optimization and scalability improvements for existing systems'
                ]
            ],
            'employment_json' => [],
            'skills_json' => [
                [
                    'title' => 'Frontend Technologies',
                    'items' => ['React', 'Vue.js', 'TypeScript', 'Tailwind CSS', 'Next.js']
                ],
                [
                    'title' => 'Backend Development',
                    'items' => ['PHP', 'Laravel', 'Node.js', 'Python', 'PostgreSQL']
                ],
                [
                    'title' => 'DevOps & Tools',
                    'items' => ['Docker', 'AWS', 'Git', 'CI/CD', 'Linux']
                ]
            ],
            'why_json' => [
                ['title' => '⚡ Lightning Fast Delivery', 'description' => 'Quick turnaround times without compromising on quality or attention to detail.'],
                ['title' => '🏆 Premium Quality Code', 'description' => 'Clean, maintainable, and scalable code following industry best practices.'],
                ['title' => '🤝 Excellent Communication', 'description' => 'Regular updates and clear communication throughout the entire project lifecycle.'],
                ['title' => '🎯 Results-Driven Approach', 'description' => 'Focused on delivering solutions that drive real business value and growth.'],
            ],
            'contact_json' => [
                'upwork_profile' => '',
            ],
            'theme' => 'sparkingasia',
        ];

        return Inertia::render('Portfolio/Editor', [
            'portfolio' => null,
            'defaultData' => array_merge($defaultData, [
                'slug' => request()->get('slug', $defaultData['slug'] ?? ''),
            ]),
        ]);
    }

    public function store(PortfolioRequest $request)
    {
        $validated = $request->validated();

        $portfolio = EmployeePortfolio::create([
            'user_id' => Auth::id(),
            'slug' => $validated['slug'],
            'name' => $validated['name'],
            'title' => $validated['title'],
            'tagline' => $validated['tagline'] ?? null,
            'stats_json' => $validated['stats_json'] ?? [],
            'profile_image_path' => $validated['profile_image_path'] ?? null,
            'about' => $validated['about'],
            'services_json' => $validated['services_json'] ?? [],
            'employment_json' => $validated['employment_json'] ?? [],
            'skills_json' => $validated['skills_json'] ?? [],
            'why_json' => $validated['why_json'] ?? [],
            'contact_json' => $validated['contact_json'] ?? [],
            'theme' => $validated['theme'] ?? 'emerald',
            'is_draft' => $validated['is_draft'] ?? true,
            'is_published' => !($validated['is_draft'] ?? true),
        ]);

        // Handle portfolio items
        if (isset($validated['items']) && is_array($validated['items'])) {
            foreach ($validated['items'] as $itemData) {
                $portfolio->items()->create([
                    'title' => $itemData['title'],
                    'description' => $itemData['description'] ?? null,
                    'image_path' => $itemData['image_path'] ?? null,
                    'link' => $itemData['link'] ?? null,
                    'sort_order' => $itemData['sort_order'] ?? 0,
                ]);
            }
        }

        $response = ['success' => 'Portfolio created successfully!'];
        
        // If portfolio is published, include public URL
        if ($portfolio->is_published) {
            $response['publicUrl'] = url("/portfolio/{$portfolio->slug}");
        }

        return redirect()->route('portfolio.edit', $portfolio->id)->with($response);
    }

    public function edit($id)
    {
        $portfolio = EmployeePortfolio::with('items')->findOrFail($id);
        
        // Check authorization using policy
        $this->authorize('update', $portfolio);

        return Inertia::render('Portfolio/Editor', [
            'portfolio' => $portfolio,
            'defaultData' => null,
        ]);
    }

    public function editBySlug($slug)
    {
        $portfolio = EmployeePortfolio::with('items')
            ->where('slug', $slug)
            ->where('user_id', Auth::id())
            ->first();
        
        if (!$portfolio) {
            // If portfolio doesn't exist, redirect to create with pre-filled slug
            return redirect()->route('portfolio.create')->with('slug', $slug);
        }

        // Check authorization using policy
        $this->authorize('update', $portfolio);

        return Inertia::render('Portfolio/Editor', [
            'portfolio' => $portfolio,
            'defaultData' => null,
        ]);
    }

    public function update(PortfolioRequest $request, $id)
    {
        $portfolio = EmployeePortfolio::findOrFail($id);
        
        // Check authorization using policy
        $this->authorize('update', $portfolio);

        $validated = $request->validated();
        
        // Update is_published based on is_draft
        $validated['is_published'] = !($validated['is_draft'] ?? true);

        $portfolio->update($validated);

        // Handle portfolio items - delete existing and recreate
        $portfolio->items()->delete();
        
        if (isset($validated['items']) && is_array($validated['items'])) {
            foreach ($validated['items'] as $itemData) {
                $portfolio->items()->create([
                    'title' => $itemData['title'],
                    'description' => $itemData['description'] ?? null,
                    'image_path' => $itemData['image_path'] ?? null,
                    'link' => $itemData['link'] ?? null,
                    'sort_order' => $itemData['sort_order'] ?? 0,
                ]);
            }
        }

        $response = ['success' => 'Portfolio updated successfully!'];
        
        // If portfolio is published, include public URL
        if ($portfolio->is_published) {
            $response['publicUrl'] = url("/portfolio/{$portfolio->slug}");
        }

        return back()->with($response);
    }

    public function showPublic($slug)
    {
        $portfolio = EmployeePortfolio::with('items')
            ->where('slug', $slug)
            ->where('is_published', true)
            ->firstOrFail();

        return Inertia::render('Portfolio/Public', [
            'portfolio' => $portfolio,
            'assetBase' => asset('storage'),
        ]);
    }
}
