<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->get('perPage', 10);
        
        // Validate perPage to ensure it's within reasonable limits
        if (!in_array($perPage, [10, 25, 50, 100])) {
            $perPage = 10;
        }
        
        // Start building the query
        $query = User::query();
        
        // Apply search filter
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                  ->orWhere('email', 'like', '%' . $search . '%');
            });
        }
        
        // Apply shift filter (designation field stores shift information)
        if ($request->filled('designation')) {
            $designation = $request->get('designation');
            if ($designation === 'no_designation') {
                $query->where(function($q) {
                    $q->whereNull('designation')
                      ->orWhere('designation', '');
                });
            } elseif ($designation !== 'all') {
                $query->where('designation', $designation);
            }
        }
        
        // Apply role filter
        if ($request->filled('role') && $request->get('role') !== 'all') {
            $query->where('role', $request->get('role'));
        }
        
        $users = $query->orderBy('name')
            ->paginate($perPage)
            ->appends($request->query());
        
        // Calculate weekly hours for each user and format as HH:MM
        $startOfWeek = now()->startOfWeek()->format('Y-m-d');
        $endOfWeek = now()->endOfWeek()->format('Y-m-d');
        
        $users->getCollection()->transform(function ($user) use ($startOfWeek, $endOfWeek) {
            // Get the sum of hours for this week
            $weeklyHours = $user->workHours()
                ->whereBetween('date', [$startOfWeek, $endOfWeek])
                ->sum('hours');
            
            // Convert decimal hours to HH:MM format
            $hours = floor($weeklyHours);
            $minutes = round(($weeklyHours - $hours) * 60);
            
            // Format as HH:MM
            $user->weekly_hours_worked = sprintf('%02d:%02d', $hours, $minutes);
            
            return $user;
        });
            
        // Get all unique shifts (stored as designations) and roles for filter dropdowns
        $allDesignations = User::whereNotNull('designation')
            ->where('designation', '!=', '')
            ->distinct()
            ->pluck('designation')
            ->sort()
            ->values();
            
        $allRoles = User::distinct()
            ->pluck('role')
            ->sort()
            ->values();
            
        return Inertia::render('UsersList', [
            'users' => $users,
            'filters' => [
                'search' => $request->get('search', ''),
                'designation' => $request->get('designation', 'all'),
                'role' => $request->get('role', 'all'),
            ],
            'filterOptions' => [
                'designations' => $allDesignations,
                'roles' => $allRoles,
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('UserCreate');
    }

    public function store(Request $request)
    {
        $rules = [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'required|in:admin,employee',
            'designation' => 'nullable|string|max:255',
        ];
        
        // Only add avatar validation if file is present
        if ($request->hasFile('avatar')) {
            $rules['avatar'] = 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048';
        }

        $validated = $request->validate($rules);

        $avatarPath = null;
        if ($request->hasFile('avatar')) {
            $avatarPath = $request->file('avatar')->store('avatars', 'public');
        }

        $userData = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'designation' => $validated['designation'] ?? null,
        ];
        
        // Only add avatar if we have one
        if ($avatarPath) {
            $userData['avatar'] = $avatarPath;
        }

        User::create($userData);
        
        return redirect()->route('users.index')->with('success', 'User created successfully!');
    }

    public function edit(User $user)
    {
        return Inertia::render('UserEdit', [
            'user' => $user,
        ]);
    }

    public function update(Request $request, User $user)
    {
        $rules = [
            'name' => 'required|string|max:255',
            'email' => [
                'required',
                'email',
                Rule::unique('users')->ignore($user->id),
            ],
            'password' => 'nullable|string|min:8',
            'role' => 'required|in:admin,employee',
            'designation' => 'nullable|string|max:255',
        ];
        
        // Only add avatar validation if file is present
        if ($request->hasFile('avatar')) {
            $rules['avatar'] = 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048';
        }

        $validated = $request->validate($rules);

        $user->name = $validated['name'];
        $user->email = $validated['email'];
        $user->role = $validated['role'];
        $user->designation = $validated['designation'] ?? null;
        
        // Only update password if it's provided and not empty
        if (!empty($validated['password']) && $validated['password'] !== '') {
            $user->password = Hash::make($validated['password']);
        }

        if ($request->hasFile('avatar')) {
            // Delete old avatar if exists
            if ($user->avatar && \Illuminate\Support\Facades\Storage::disk('public')->exists($user->avatar)) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($user->avatar);
            }
            $user->avatar = $request->file('avatar')->store('avatars', 'public');
        }

        $user->save();
        
        return redirect()->route('users.index')->with('success', 'User updated successfully!');
    }

    public function destroy(User $user)
    {
        $user->delete();
        return redirect()->route('users.index');
    }
}
