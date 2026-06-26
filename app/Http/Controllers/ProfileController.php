<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Models\UserMonitoringSetting;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => session('status'),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $validatedData = $request->validated();

        // Handle avatar upload
        if ($request->hasFile('avatar')) {
            // Delete old avatar if exists
            if ($user->avatar) {
                Storage::disk('avatars')->delete($user->avatar);
            }

            // Store new avatar
            $avatarPath = $request->file('avatar')->store('avatars', 'avatars');
            $validatedData['avatar'] = $avatarPath;
        } elseif ($request->has('avatar') && $request->input('avatar') === null) {
            // Handle avatar removal
            if ($user->avatar) {
                Storage::disk('avatars')->delete($user->avatar);
            }
            $validatedData['avatar'] = null;
        }

        $user->fill($validatedData);

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        return Redirect::route('profile.edit')->with('success', 'Profile updated successfully.');
    }

    /**
     * Update the user's own display preferences (timezone + 12/24h). Self-service
     * — every employee can pick the zone they read times in; it only changes how
     * times DISPLAY, never the stored instant. Saved as a per-user override on
     * UserMonitoringSetting, which HandleInertiaRequests reads into the `display`
     * prop so every page re-renders in the chosen zone on the next request.
     */
    public function updateDisplay(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'display_timezone' => ['required', 'timezone'],
            'time_format' => ['required', Rule::in(['12', '24'])],
        ]);

        UserMonitoringSetting::updateOrCreate(
            ['user_id' => $request->user()->id],
            [
                'override_display' => true,
                'display_timezone' => $data['display_timezone'],
                'time_format' => $data['time_format'],
            ],
        );

        return Redirect::route('profile.edit')->with('success', 'Time zone updated.');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
