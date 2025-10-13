<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\EmployeePortfolio;

class MigrateContactData extends Command
{
    protected $signature = 'portfolio:migrate-contact';
    protected $description = 'Migrate portfolio contact data to new structure';

    public function handle()
    {
        $portfolios = EmployeePortfolio::whereNotNull('contact_json')->get();
        
        foreach ($portfolios as $portfolio) {
            $oldContact = $portfolio->contact_json;
            
            // Check if already in new format
            if (is_array($oldContact) && isset($oldContact['upwork_profile']) && !isset($oldContact['email'])) {
                $this->info("Portfolio {$portfolio->slug} already in new format");
                continue;
            }
            
            // Convert old format to new format
            $newContact = [
                'upwork_profile' => $oldContact['upwork'] ?? $oldContact['upwork_profile'] ?? ''
            ];
            
            $portfolio->contact_json = $newContact;
            $portfolio->save();
            
            $this->info("Migrated contact data for portfolio: {$portfolio->slug}");
        }
        
        $this->info('Contact data migration completed!');
        return 0;
    }
}
