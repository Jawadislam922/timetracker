<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\UpworkProfile;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        try {
            $perPage = $request->get('perPage', 10);
            $search = $request->get('search', '');
            
            // Validate perPage to ensure it's within reasonable limits
            if (!in_array($perPage, [10, 25, 50, 100])) {
                $perPage = 10;
            }
            
            $query = Client::with('upworkProfile')->orderBy('name');
            
            // Apply search filter if search term is provided
            if (!empty($search)) {
                $query->where('name', 'like', '%' . $search . '%');
            }
            
            $clients = $query->paginate($perPage)->appends($request->query());
            
            // Calculate weekly hours for each client and format as HH:MM
            $startOfWeek = now()->startOfWeek()->format('Y-m-d');
            $endOfWeek = now()->endOfWeek()->format('Y-m-d');
            
            $clients->getCollection()->transform(function ($client) use ($startOfWeek, $endOfWeek) {
                // Get the sum of hours for this week
                $weeklyHours = $client->workHours()
                    ->whereBetween('date', [$startOfWeek, $endOfWeek])
                    ->sum('hours');
                
                // Convert decimal hours to HH:MM format
                $hours = floor($weeklyHours);
                $minutes = round(($weeklyHours - $hours) * 60);
                
                // Format as HH:MM
                $client->weekly_hours_worked = sprintf('%02d:%02d', $hours, $minutes);
                
                return $client;
            });
                
            return Inertia::render('ClientsList', [
                'clients' => $clients,
                'filters' => [
                    'search' => $search,
                ],
                'workTypes' => Client::getWorkTypes(),
            ]);
        } catch (\Exception $e) {
            \Log::error('ClientController index error: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function create()
    {
        $upworkProfiles = UpworkProfile::active()->orderBy('name')->get();
        $workTypes = Client::getWorkTypes();
        
        return Inertia::render('ClientCreate', [
            'upworkProfiles' => $upworkProfiles,
            'workTypes' => $workTypes,
        ]);
    }

    public function store(Request $request)
    {
        $rules = [
            'name' => 'required|string|max:255',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'work_type' => 'required|string|in:' . implode(',', array_keys(Client::getWorkTypes())),
        ];
        
        // Make upwork_profile_id conditionally required
        if (Client::isProfileRequired($request->work_type)) {
            $rules['upwork_profile_id'] = 'required|exists:upwork_profiles,id';
        } else {
            $rules['upwork_profile_id'] = 'nullable|exists:upwork_profiles,id';
        }
        
        $validated = $request->validate($rules);
        
        Client::create($validated);
        return redirect()->route('clients.index')->with('success', 'Client created.');
    }

    public function edit(Client $client)
    {
        $upworkProfiles = UpworkProfile::active()->orderBy('name')->get();
        $workTypes = Client::getWorkTypes();
        
        return Inertia::render('ClientEdit', [
            'client' => $client->load('upworkProfile'),
            'upworkProfiles' => $upworkProfiles,
            'workTypes' => $workTypes,
        ]);
    }

    public function update(Request $request, Client $client)
    {
        $rules = [
            'name' => 'required|string|max:255',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'work_type' => 'required|string|in:' . implode(',', array_keys(Client::getWorkTypes())),
        ];
        
        // Make upwork_profile_id conditionally required
        if (Client::isProfileRequired($request->work_type)) {
            $rules['upwork_profile_id'] = 'required|exists:upwork_profiles,id';
        } else {
            $rules['upwork_profile_id'] = 'nullable|exists:upwork_profiles,id';
        }
        
        $validated = $request->validate($rules);
        
        $client->update($validated);
        return redirect()->route('clients.index')->with('success', 'Client updated.');
    }

    public function destroy(Client $client)
    {
        $client->delete();
        return redirect()->route('clients.index')->with('success', 'Client deleted.');
    }

    public function bulkDestroy(Request $request)
    {
        $request->validate([
            'client_ids' => 'required|array',
            'client_ids.*' => 'exists:clients,id'
        ]);

        try {
            $deletedCount = Client::whereIn('id', $request->client_ids)->delete();
            
            return redirect()->route('clients.index')->with('success', "{$deletedCount} client(s) deleted successfully.");
        } catch (\Exception $e) {
            \Log::error('Bulk delete error: ' . $e->getMessage());
            return redirect()->route('clients.index')->with('error', 'Failed to delete selected clients.');
        }
    }

    public function export()
    {
        try {
            $clients = Client::with('upworkProfile')->get();
            
            $csvData = [];
            $csvData[] = ['ID', 'Name', 'Work Type', 'Upwork Profile', 'Tags', 'Created At']; // Header
            
            foreach ($clients as $client) {
                $csvData[] = [
                    $client->id,
                    $client->name,
                    Client::getWorkTypes()[$client->work_type] ?? $client->work_type,
                    $client->upworkProfile->name ?? '',
                    is_array($client->tags) ? implode(', ', $client->tags) : '',
                    $client->created_at->format('Y-m-d H:i:s')
                ];
            }
            
            $filename = 'clients_export_' . date('Y-m-d_H-i-s') . '.csv';
            
            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            ];
            
            $callback = function() use ($csvData) {
                $file = fopen('php://output', 'w');
                foreach ($csvData as $row) {
                    fputcsv($file, $row);
                }
                fclose($file);
            };
            
            return response()->stream($callback, 200, $headers);
            
        } catch (\Exception $e) {
            \Log::error('Client export error: ' . $e->getMessage());
            return redirect()->back()->with('error', 'Failed to export clients.');
        }
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt,xlsx,xls|max:2048'
        ]);

        try {
            $file = $request->file('file');
            $path = $file->getRealPath();
            
            // Read CSV file
            if (($handle = fopen($path, 'r')) !== FALSE) {
                $header = fgetcsv($handle); // Skip header row
                $imported = 0;
                $errors = [];
                
                while (($data = fgetcsv($handle)) !== FALSE) {
                    try {
                        // Expected CSV format: Name, Work Type, Upwork Profile, Tags
                        if (count($data) >= 2 && !empty($data[0])) {
                            $workType = 'tracker_manual'; // Default
                            if (!empty($data[1])) {
                                // Try to match work type
                                $workTypes = array_flip(Client::getWorkTypes());
                                $workType = $workTypes[$data[1]] ?? 'tracker_manual';
                            }
                            
                            $upworkProfileId = null;
                            if (!empty($data[2])) {
                                $profile = \App\Models\UpworkProfile::where('name', $data[2])->first();
                                $upworkProfileId = $profile ? $profile->id : null;
                            }
                            
                            $tags = [];
                            if (!empty($data[3])) {
                                $tags = array_map('trim', explode(',', $data[3]));
                            }
                            
                            Client::create([
                                'name' => $data[0],
                                'work_type' => $workType,
                                'upwork_profile_id' => $upworkProfileId,
                                'tags' => $tags
                            ]);
                            
                            $imported++;
                        }
                    } catch (\Exception $e) {
                        $errors[] = "Row " . ($imported + 2) . ": " . $e->getMessage();
                    }
                }
                fclose($handle);
                
                if ($imported > 0) {
                    $message = "Successfully imported {$imported} clients.";
                    if (count($errors) > 0) {
                        $message .= " Errors: " . implode(', ', array_slice($errors, 0, 3));
                    }
                    return redirect()->back()->with('success', $message);
                } else {
                    return redirect()->back()->with('error', 'No valid clients found in the file.');
                }
            }
            
        } catch (\Exception $e) {
            \Log::error('Client import error: ' . $e->getMessage());
            return redirect()->back()->with('error', 'Failed to import clients: ' . $e->getMessage());
        }
    }
}
