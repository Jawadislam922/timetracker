<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeder.
     * 
     * Usage: php artisan db:seed --class=AdminUserSeeder
     */
    public function run(): void
    {
        // Check if admin already exists
        $adminExists = User::where('email', env('ADMIN_EMAIL', 'admin@example.com'))->exists();
        
        if ($adminExists) {
            $this->command->info('Admin user already exists. Skipping...');
            return;
        }

        User::create([
            'name' => env('ADMIN_NAME', 'Admin'),
            'email' => env('ADMIN_EMAIL', 'admin@example.com'),
            'role' => 'admin',
            'email_verified_at' => now(),
            'password' => Hash::make(env('ADMIN_PASSWORD', 'password')),
        ]);

        $this->command->info('Admin user created successfully!');
        $this->command->warn('Please update ADMIN_EMAIL and ADMIN_PASSWORD in your .env file');
    }
}
