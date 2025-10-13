<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\EmployeePortfolio;

class MigrateSkills extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'portfolio:migrate-skills';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Migrate portfolio skills from old format to new grouped format';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $portfolios = EmployeePortfolio::whereNotNull('skills_json')->get();
        
        foreach ($portfolios as $portfolio) {
            $oldSkills = $portfolio->skills_json;
            
            // Check if already in new format
            if (is_array($oldSkills) && !empty($oldSkills) && isset($oldSkills[0]['title'])) {
                $this->info("Portfolio {$portfolio->slug} already in new format");
                continue;
            }
            
            // Convert old format to new format
            if (is_array($oldSkills) && !empty($oldSkills)) {
                $skillNames = array_column($oldSkills, 'name');
                
                $newSkills = [
                    [
                        'title' => 'Frontend Technologies',
                        'items' => array_filter($skillNames, function($skill) {
                            return stripos($skill, 'javascript') !== false || 
                                   stripos($skill, 'html') !== false || 
                                   stripos($skill, 'css') !== false ||
                                   stripos($skill, 'react') !== false;
                        })
                    ],
                    [
                        'title' => 'Backend Development',
                        'items' => array_filter($skillNames, function($skill) {
                            return stripos($skill, 'python') !== false || 
                                   stripos($skill, 'api') !== false ||
                                   stripos($skill, 'django') !== false ||
                                   stripos($skill, 'flask') !== false;
                        })
                    ],
                    [
                        'title' => 'Database & Cloud',
                        'items' => array_filter($skillNames, function($skill) {
                            return stripos($skill, 'sql') !== false || 
                                   stripos($skill, 'database') !== false ||
                                   stripos($skill, 'cloud') !== false ||
                                   stripos($skill, 'aws') !== false;
                        })
                    ],
                    [
                        'title' => 'DevOps & Tools',
                        'items' => array_filter($skillNames, function($skill) {
                            return stripos($skill, 'git') !== false || 
                                   stripos($skill, 'docker') !== false ||
                                   stripos($skill, 'devops') !== false ||
                                   stripos($skill, 'version') !== false;
                        })
                    ],
                    [
                        'title' => 'Design & Management',
                        'items' => array_filter($skillNames, function($skill) {
                            return stripos($skill, 'figma') !== false || 
                                   stripos($skill, 'design') !== false ||
                                   stripos($skill, 'agile') !== false ||
                                   stripos($skill, 'ui') !== false ||
                                   stripos($skill, 'ux') !== false;
                        })
                    ]
                ];
                
                // Remove empty categories and reindex arrays
                $newSkills = array_filter($newSkills, function($category) {
                    return !empty($category['items']);
                });
                
                foreach ($newSkills as &$category) {
                    $category['items'] = array_values($category['items']);
                }
                
                // Add any remaining skills to a general category
                $categorizedSkills = array_merge(...array_column($newSkills, 'items'));
                $remainingSkills = array_diff($skillNames, $categorizedSkills);
                
                if (!empty($remainingSkills)) {
                    $newSkills[] = [
                        'title' => 'Other Skills',
                        'items' => array_values($remainingSkills)
                    ];
                }
                
                $portfolio->skills_json = array_values($newSkills);
                $portfolio->save();
                
                $this->info("Migrated portfolio: {$portfolio->slug}");
            } else {
                $this->warn("Portfolio {$portfolio->slug} has no skills to migrate");
            }
        }
        
        $this->info('Skills migration completed!');
        return 0;
    }
}
