<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PortfolioUploadController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'file' => 'required|image|max:4096', // 4MB max
        ]);

        $file = $request->file('file');
        $userId = auth()->id();
        
        // Generate unique filename
        $extension = $file->getClientOriginalExtension();
        $filename = Str::uuid() . '.' . $extension;
        
        // Store in public disk under portfolio/{user_id}/
        $path = $file->storeAs("portfolio/{$userId}", $filename, 'public');
        
        return response()->json([
            'url' => Storage::url($path),
            'path' => $path,
        ]);
    }
}
