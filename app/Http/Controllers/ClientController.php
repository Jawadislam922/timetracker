<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\MonitoringSetting;
use App\Models\UpworkProfile;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ClientController extends Controller
{
    use Concerns\RedirectsToReturnPath;

    public function index(Request $request)
    {
        try {
            $perPage = $request->get('perPage', 10);
            $search = $request->get('search', '');
            $status = $request->get('status', 'active');

            // Validate perPage to ensure it's within reasonable limits
            if (! in_array($perPage, [10, 25, 50, 100])) {
                $perPage = 10;
            }

            // Validate status filter. Default is ACTIVE: with ~935 archived
            // (finished-contract) clients, opening on "all" buried the ~160
            // that matter under everything that doesn't.
            if (! in_array($status, ['all', 'active', 'archived'])) {
                $status = 'active';
            }

            // Weekly hours per client come from one correlated SUM on the
            // paginated query (not a query per row in the transform below).
            $startOfWeek = now()->startOfWeek(MonitoringSetting::weekStartDay())->format('Y-m-d');
            $endOfWeek = now()->endOfWeek(MonitoringSetting::weekEndDay())->format('Y-m-d');

            $query = Client::with(['upworkProfile', 'upworkProfiles'])
                ->withSum([
                    'workHours as weekly_hours_sum' => fn ($q) => $q->whereBetween('date', [$startOfWeek, $endOfWeek]),
                ], 'hours')
                ->orderBy('name');

            // Apply search filter if search term is provided
            if (! empty($search)) {
                $query->where('name', 'like', '%'.$search.'%');
            }

            // Apply status filter (default 'all' shows active + archived together)
            if ($status === 'active') {
                $query->active();
            } elseif ($status === 'archived') {
                $query->archived();
            }

            $clients = $query->paginate($perPage)->appends($request->query());

            $clients->getCollection()->transform(function ($client) {
                $weeklyHours = (float) ($client->weekly_hours_sum ?? 0);
                $hours = floor($weeklyHours);
                $minutes = round(($weeklyHours - $hours) * 60);

                $client->weekly_hours_worked = sprintf('%02d:%02d', $hours, $minutes);
                $client->is_active = (bool) $client->is_active;

                return $client;
            });

            return Inertia::render('ClientsList', [
                'clients' => $clients,
                'filters' => [
                    'search' => $search,
                    'perPage' => $perPage,
                    'status' => $status,
                ],
                'filterOptions' => [
                    'status' => [
                        ['value' => 'all', 'label' => 'All'],
                        ['value' => 'active', 'label' => 'Active'],
                        ['value' => 'archived', 'label' => 'Archived'],
                    ],
                ],
                'workTypes' => Client::getWorkTypes(),
                'preferredContacts' => Client::PREFERRED_CONTACTS,
                'profileOptions' => UpworkProfile::active()->orderBy('name')->get(['id', 'name']),
                // Every client name + status, for the add-modal's live duplicate
                // check. Optional (lazy): only loaded when the modal requests it
                // via a partial reload, so the normal page visit never pays for
                // shipping ~1,100 names.
                'allClients' => Inertia::lazy(
                    fn () => Client::orderBy('name')->get(['id', 'name', 'is_active'])
                ),
            ]);
        } catch (\Exception $e) {
            \Log::error('ClientController index error: '.$e->getMessage());

            return response()->json(['error' => $e->getMessage()], 500);
        }
    }


    public function store(Request $request)
    {
        $rules = [
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:40',
            'preferred_contact' => 'nullable|string|in:'.implode(',', array_keys(Client::PREFERRED_CONTACTS)),
            'contact_notes' => 'nullable|string|max:500',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'work_type' => 'required|string|in:'.implode(',', array_keys(Client::getWorkTypes())),
        ];

        // Make upwork_profile_ids conditionally required for multiple profiles
        if (Client::isProfileRequired($request->work_type)) {
            $rules['upwork_profile_ids'] = 'required|array|min:1';
            $rules['upwork_profile_ids.*'] = 'exists:upwork_profiles,id';
        } else {
            $rules['upwork_profile_ids'] = 'nullable|array';
            $rules['upwork_profile_ids.*'] = 'exists:upwork_profiles,id';
        }

        // Keep backward compatibility for single profile
        if ($request->has('upwork_profile_id') && ! $request->has('upwork_profile_ids')) {
            if (Client::isProfileRequired($request->work_type)) {
                $rules['upwork_profile_id'] = 'required|exists:upwork_profiles,id';
            } else {
                $rules['upwork_profile_id'] = 'nullable|exists:upwork_profiles,id';
            }
        }

        $validated = $request->validate($rules);

        // Duplicate guard: prod accumulated triple "Brad Pugh"s because nothing
        // ever checked. An exact name match (case-insensitive, trimmed) blocks
        // creation unless the user explicitly confirms it is a DIFFERENT client
        // who happens to share the name. Archived matches get a restore hint
        // instead of a second record.
        if (! $request->boolean('allow_duplicate')) {
            $existing = Client::whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower(trim($validated['name']))])->first();
            if ($existing) {
                throw ValidationException::withMessages([
                    'name' => $existing->is_active
                        ? "A client named \"{$existing->name}\" already exists. Select it instead — or tick \"different client with the same name\" if this really is someone else."
                        : "An archived client named \"{$existing->name}\" already exists. Restore it from the Archived filter instead of creating a duplicate.",
                ]);
            }
        }

        // Create the client first
        $clientData = [
            'name' => trim($validated['name']),
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'preferred_contact' => $validated['preferred_contact'] ?? null,
            'contact_notes' => $validated['contact_notes'] ?? null,
            'tags' => $validated['tags'] ?? [],
            'work_type' => $validated['work_type'],
            'upwork_profile_id' => $validated['upwork_profile_id'] ?? null, // Keep for backward compatibility
        ];

        $client = Client::create($clientData);

        // Attach multiple profiles if provided
        if (isset($validated['upwork_profile_ids']) && is_array($validated['upwork_profile_ids'])) {
            $client->upworkProfiles()->attach($validated['upwork_profile_ids']);
        }

        // Back to the list the user was on (page, search, filters intact).
        return $this->redirectToReturnPath($request, 'clients.index', [
            'success' => 'Client created.',
        ]);
    }


    public function update(Request $request, Client $client)
    {
        $rules = [
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:40',
            'preferred_contact' => 'nullable|string|in:'.implode(',', array_keys(Client::PREFERRED_CONTACTS)),
            'contact_notes' => 'nullable|string|max:500',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'work_type' => 'required|string|in:'.implode(',', array_keys(Client::getWorkTypes())),
        ];

        // Make upwork_profile_ids conditionally required for multiple profiles
        if (Client::isProfileRequired($request->work_type)) {
            $rules['upwork_profile_ids'] = 'required|array|min:1';
            $rules['upwork_profile_ids.*'] = 'exists:upwork_profiles,id';
        } else {
            $rules['upwork_profile_ids'] = 'nullable|array';
            $rules['upwork_profile_ids.*'] = 'exists:upwork_profiles,id';
        }

        // Keep backward compatibility for single profile
        if ($request->has('upwork_profile_id') && ! $request->has('upwork_profile_ids')) {
            if (Client::isProfileRequired($request->work_type)) {
                $rules['upwork_profile_id'] = 'required|exists:upwork_profiles,id';
            } else {
                $rules['upwork_profile_id'] = 'nullable|exists:upwork_profiles,id';
            }
        }

        $validated = $request->validate($rules);

        // Same duplicate guard as store(), excluding this client itself.
        if (! $request->boolean('allow_duplicate')) {
            $existing = Client::whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower(trim($validated['name']))])
                ->whereKeyNot($client->id)
                ->first();
            if ($existing) {
                throw ValidationException::withMessages([
                    'name' => "Another client named \"{$existing->name}\" already exists"
                        .($existing->is_active ? '.' : ' (archived).')
                        .' Tick "different client with the same name" if this rename is intentional.',
                ]);
            }
        }

        // Update ONLY the fields this request actually carried.
        //
        // Blanket `?? null` writes here silently destroyed data whenever a form
        // submitted a subset of the record: saving from the contact modal (which
        // sends no `tags`) wiped every tag, and saving from the old edit page
        // (which sent no contact fields) nulled email/phone/preferred contact.
        // An absent key now means "leave it alone"; an explicitly-sent empty
        // value still clears the field.
        $clientData = ['name' => trim($validated['name'])];
        foreach (['email', 'phone', 'preferred_contact', 'contact_notes', 'tags', 'work_type', 'upwork_profile_id'] as $field) {
            if (array_key_exists($field, $validated)) {
                $clientData[$field] = $validated[$field];
            }
        }

        $client->update($clientData);

        // Sync multiple profiles if provided
        if (isset($validated['upwork_profile_ids']) && is_array($validated['upwork_profile_ids'])) {
            $client->upworkProfiles()->sync($validated['upwork_profile_ids']);
        }

        return $this->redirectToReturnPath($request, 'clients.index', [
            'success' => 'Client updated.',
        ]);
    }

    public function destroy(Request $request, Client $client)
    {
        $client->delete();

        return $this->redirectToReturnPath($request, 'clients.index', [
            'success' => 'Client deleted.',
        ]);
    }

    public function bulkDestroy(Request $request)
    {
        $request->validate([
            'client_ids' => 'required|array',
            'client_ids.*' => 'exists:clients,id',
        ]);

        try {
            $deletedCount = Client::whereIn('id', $request->client_ids)->delete();

            return $this->redirectToReturnPath($request, 'clients.index', [
                'success' => "{$deletedCount} client(s) deleted successfully.",
            ]);
        } catch (\Exception $e) {
            \Log::error('Bulk delete error: '.$e->getMessage());

            return $this->redirectToReturnPath($request, 'clients.index', [
                'error' => 'Failed to delete selected clients.',
            ]);
        }
    }

    public function setStatus(Request $request, Client $client)
    {
        $validated = $request->validate([
            'is_active' => 'required|boolean',
        ]);

        $client->update(['is_active' => $request->boolean('is_active')]);

        return $this->redirectToReturnPath($request, 'clients.index', [
            'success' => $request->boolean('is_active') ? 'Client restored.' : 'Client archived.',
        ]);
    }

    public function bulkStatus(Request $request)
    {
        $request->validate([
            'is_active' => 'required|boolean',
            'ids' => 'nullable|array',
            'ids.*' => 'integer',
            'all_matching' => 'nullable|boolean',
            'search' => 'nullable|string',
            'status' => 'nullable|string',
        ]);

        try {
            if ($request->boolean('all_matching')) {
                // Rebuild the SAME query index() uses from the provided filters,
                // applying BOTH the search term AND the status scope, so the
                // affected set matches the count and rows the user saw.
                $search = $request->get('search', '');
                $status = $request->get('status', 'all');

                $query = Client::query();
                if (! empty($search)) {
                    $query->where('name', 'like', '%'.$search.'%');
                }

                // Apply the identical status scope index() used.
                if ($status === 'active') {
                    $query->active();
                } elseif ($status === 'archived') {
                    $query->archived();
                }

                $ids = $query->pluck('id')->all();
            } else {
                $ids = $request->input('ids', []);
            }

            $isActive = $request->boolean('is_active');
            $count = Client::whereIn('id', $ids)->update(['is_active' => $isActive]);

            $action = $isActive ? 'Restored' : 'Archived';

            return $this->redirectToReturnPath($request, 'clients.index', [
                'success' => "{$action} {$count} client(s).",
            ]);
        } catch (\Exception $e) {
            \Log::error('Bulk status update error: '.$e->getMessage());

            return $this->redirectToReturnPath($request, 'clients.index', [
                'error' => 'Failed to update selected clients.',
            ]);
        }
    }

    public function export()
    {
        try {
            $clients = Client::with(['upworkProfile', 'upworkProfiles'])->get();

            $csvData = [];
            $csvData[] = ['ID', 'Name', 'Work Type', 'Upwork Profiles', 'Tags', 'Created At']; // Header

            foreach ($clients as $client) {
                // Get all profiles (both single and multiple)
                $profileNames = [];
                if ($client->upworkProfiles && $client->upworkProfiles->count() > 0) {
                    $profileNames = $client->upworkProfiles->pluck('name')->toArray();
                } elseif ($client->upworkProfile) {
                    $profileNames = [$client->upworkProfile->name];
                }

                $csvData[] = [
                    $client->id,
                    $client->name,
                    Client::getWorkTypes()[$client->work_type] ?? $client->work_type,
                    implode('; ', $profileNames),
                    is_array($client->tags) ? implode(', ', $client->tags) : '',
                    $client->created_at->format('Y-m-d H:i:s'),
                ];
            }

            $filename = 'clients_export_'.date('Y-m-d_H-i-s').'.csv';

            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            ];

            $callback = function () use ($csvData) {
                $file = fopen('php://output', 'w');
                foreach ($csvData as $row) {
                    fputcsv($file, $row);
                }
                fclose($file);
            };

            return response()->stream($callback, 200, $headers);

        } catch (\Exception $e) {
            \Log::error('Client export error: '.$e->getMessage());

            return redirect()->back()->with('error', 'Failed to export clients.');
        }
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:2048',
        ]);

        try {
            $file = $request->file('file');
            $path = $file->getRealPath();

            // Read CSV file
            if (($handle = fopen($path, 'r')) !== false) {
                $header = fgetcsv($handle); // Skip header row
                $imported = 0;
                $skipped = 0;
                $errors = [];

                while (($data = fgetcsv($handle)) !== false) {
                    try {
                        // Expected CSV format: Name, Work Type, Upwork Profile, Tags
                        if (count($data) >= 2 && ! empty($data[0])) {
                            $workType = 'tracker_manual'; // Default
                            if (! empty($data[1])) {
                                // Try to match work type
                                $workTypes = array_flip(Client::getWorkTypes());
                                $workType = $workTypes[$data[1]] ?? 'tracker_manual';
                            }

                            $upworkProfileId = null;
                            if (! empty($data[2])) {
                                $profile = UpworkProfile::where('name', $data[2])->first();
                                $upworkProfileId = $profile ? $profile->id : null;
                            }

                            $tags = [];
                            if (! empty($data[3])) {
                                $tags = array_map('trim', explode(',', $data[3]));
                            }

                            // Skip names that already exist. This path calls
                            // Client::create() directly, so it bypasses the
                            // duplicate guard in store() — re-uploading the same
                            // CSV used to silently clone every client in it.
                            $name = trim((string) $data[0]);
                            $exists = Client::whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower($name)])->exists();
                            if ($exists) {
                                $skipped++;

                                continue;
                            }

                            $client = Client::create([
                                'name' => $name,
                                'work_type' => $workType,
                                'upwork_profile_id' => $upworkProfileId,
                                'tags' => $tags,
                            ]);

                            // Write the pivot too, not just the legacy column —
                            // otherwise imported clients open in the edit modal
                            // with an empty profile selector.
                            if ($upworkProfileId) {
                                $client->upworkProfiles()->attach($upworkProfileId);
                            }

                            $imported++;
                        }
                    } catch (\Exception $e) {
                        $errors[] = 'Row '.($imported + 2).': '.$e->getMessage();
                    }
                }
                fclose($handle);

                if ($imported > 0) {
                    $message = "Successfully imported {$imported} clients.";
                    if ($skipped > 0) {
                        $message .= " Skipped {$skipped} that already existed.";
                    }
                    if (count($errors) > 0) {
                        $message .= ' Errors: '.implode(', ', array_slice($errors, 0, 3));
                    }

                    return redirect()->back()->with('success', $message);
                } elseif ($skipped > 0) {
                    return redirect()->back()->with('success', "Nothing imported — all {$skipped} rows already exist as clients.");
                } else {
                    return redirect()->back()->with('error', 'No valid clients found in the file.');
                }
            }

        } catch (\Exception $e) {
            \Log::error('Client import error: '.$e->getMessage());

            return redirect()->back()->with('error', 'Failed to import clients: '.$e->getMessage());
        }
    }

}
