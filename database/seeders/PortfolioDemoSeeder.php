<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\EmployeePortfolio;
use App\Models\EmployeePortfolioItem;
use App\Models\User;

class PortfolioDemoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Find or create a demo user
        $user = User::firstOrCreate(
            ['email' => 'basit.ahmad@example.com'],
            [
                'name' => 'Basit Ahmad',
                'email_verified_at' => now(),
                'password' => bcrypt('password'),
            ]
        );

        // Create a demo portfolio
        $portfolio = EmployeePortfolio::create([
            'user_id' => $user->id,
            'slug' => 'basit-ahmad',
            'name' => 'Basit Ahmad',
            'title' => 'Full Stack Developer & UI/UX Designer',
            'tagline' => 'Creating digital experiences that convert visitors into customers',
            'stats_json' => [
                ['label' => 'Projects Completed', 'value' => '150+'],
                ['label' => 'Years Experience', 'value' => '8+'],
                ['label' => 'Satisfied Clients', 'value' => '100%'],
                ['label' => 'Countries Served', 'value' => '25+'],
            ],
            'about' => "I'm a passionate Full Stack Developer with over 8 years of experience in creating robust web applications and stunning user interfaces. My expertise spans across modern technologies including React, Laravel, Node.js, and more.\n\nI believe in writing clean, maintainable code and creating user experiences that not only look great but also drive business results. Whether you need a complex web application, an e-commerce solution, or a simple landing page, I bring both technical expertise and creative vision to every project.\n\nWhen I'm not coding, you'll find me exploring new technologies, contributing to open-source projects, or mentoring junior developers in the community.",
            'services_json' => [
                [
                    'title' => 'Web Development',
                    'bullets' => [
                        'Custom Website Development',
                        'E-commerce Solutions',
                        'Web Application Development',
                        'API Development & Integration',
                        'Performance Optimization'
                    ]
                ],
                [
                    'title' => 'Frontend Development',
                    'bullets' => [
                        'React & Vue.js Applications',
                        'Responsive Web Design',
                        'Single Page Applications (SPA)',
                        'Progressive Web Apps (PWA)',
                        'UI/UX Implementation'
                    ]
                ],
                [
                    'title' => 'Backend Development',
                    'bullets' => [
                        'Laravel & PHP Development',
                        'Node.js & Express Applications',
                        'Database Design & Optimization',
                        'RESTful API Development',
                        'Server Configuration & Deployment'
                    ]
                ],
                [
                    'title' => 'Digital Solutions',
                    'bullets' => [
                        'Business Process Automation',
                        'Third-party Integrations',
                        'Data Migration & Analytics',
                        'Performance Monitoring',
                        'Technical Consulting'
                    ]
                ]
            ],
            'employment_json' => [
                [
                    'role' => 'Senior Full Stack Developer',
                    'company' => 'Tech Innovations Ltd',
                    'start' => 'Jan 2022',
                    'end' => null,
                    'bullets' => [
                        'Led development of enterprise-level web applications serving 100K+ users',
                        'Architected microservices infrastructure reducing server costs by 40%',
                        'Mentored a team of 5 junior developers and established coding standards',
                        'Implemented CI/CD pipelines improving deployment frequency by 300%'
                    ]
                ],
                [
                    'role' => 'Full Stack Developer',
                    'company' => 'Digital Agency Pro',
                    'start' => 'Mar 2020',
                    'end' => 'Dec 2021',
                    'bullets' => [
                        'Developed 20+ client websites and web applications using Laravel and React',
                        'Collaborated with design team to create pixel-perfect implementations',
                        'Optimized application performance resulting in 50% faster load times',
                        'Managed client relationships and technical project requirements'
                    ]
                ],
                [
                    'role' => 'Web Developer',
                    'company' => 'Freelance',
                    'start' => 'Jan 2018',
                    'end' => 'Feb 2020',
                    'bullets' => [
                        'Built custom solutions for 30+ small to medium businesses',
                        'Specialized in e-commerce platforms and business automation tools',
                        'Maintained 99.9% client satisfaction rate with on-time project delivery',
                        'Developed expertise in multiple programming languages and frameworks'
                    ]
                ]
            ],
            'skills_json' => [
                [
                    'title' => 'Frontend',
                    'items' => ['React', 'Vue.js', 'JavaScript', 'TypeScript', 'HTML5', 'CSS3', 'Tailwind CSS', 'Bootstrap']
                ],
                [
                    'title' => 'Backend',
                    'items' => ['Laravel', 'PHP', 'Node.js', 'Express.js', 'Python', 'Django', 'RESTful APIs', 'GraphQL']
                ],
                [
                    'title' => 'Database',
                    'items' => ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Database Design']
                ],
                [
                    'title' => 'DevOps & Tools',
                    'items' => ['Git', 'Docker', 'AWS', 'Linux', 'CI/CD', 'Webpack', 'Vite', 'Composer']
                ],
                [
                    'title' => 'Design & UX',
                    'items' => ['Figma', 'Adobe XD', 'Photoshop', 'Wireframing', 'Prototyping', 'User Research']
                ],
                [
                    'title' => 'Project Management',
                    'items' => ['Agile', 'Scrum', 'Jira', 'Trello', 'Slack', 'Team Leadership']
                ]
            ],
            'why_json' => [
                [
                    'title' => 'Full Stack Expertise',
                    'description' => 'Complete end-to-end development capabilities from frontend to backend, database design to deployment.'
                ],
                [
                    'title' => 'Quality Focused',
                    'description' => 'Committed to writing clean, maintainable code and delivering bug-free applications with comprehensive testing.'
                ],
                [
                    'title' => 'Fast Delivery',
                    'description' => 'Efficient development process with agile methodologies ensuring quick turnaround times without compromising quality.'
                ],
                [
                    'title' => 'Great Communication',
                    'description' => 'Clear, regular communication throughout the project lifecycle with detailed progress reports and transparent timelines.'
                ]
            ],
            'contact_json' => [
                'email' => 'basit.ahmad@example.com',
                'upwork' => 'https://upwork.com/freelancers/basitahmad',
                'whatsapp' => 'https://wa.me/1234567890',
                'linkedin' => 'https://linkedin.com/in/basitahmad',
                'instagram' => 'https://instagram.com/basitahmad_dev',
                'website' => 'https://basitahmad.dev',
            ],
            'theme' => 'emerald',
            'is_published' => true,
        ]);

        // Create some portfolio items
        $portfolioItems = [
            [
                'title' => 'E-commerce Platform',
                'description' => 'Full-featured online store with payment integration, inventory management, and admin dashboard built with Laravel and React.',
                'link' => 'https://github.com/basitahmad/ecommerce-platform',
                'sort_order' => 1,
            ],
            [
                'title' => 'Task Management App',
                'description' => 'Collaborative project management tool with real-time updates, file sharing, and team communication features.',
                'link' => 'https://github.com/basitahmad/task-manager',
                'sort_order' => 2,
            ],
            [
                'title' => 'Restaurant Booking System',
                'description' => 'Online reservation system with table management, customer notifications, and analytics dashboard for restaurant owners.',
                'link' => 'https://github.com/basitahmad/restaurant-booking',
                'sort_order' => 3,
            ],
            [
                'title' => 'Learning Management System',
                'description' => 'Educational platform with course creation, student progress tracking, and interactive learning modules.',
                'link' => 'https://github.com/basitahmad/lms-platform',
                'sort_order' => 4,
            ],
            [
                'title' => 'Real Estate Portal',
                'description' => 'Property listing website with advanced search filters, virtual tours, and agent management system.',
                'link' => 'https://github.com/basitahmad/real-estate-portal',
                'sort_order' => 5,
            ],
            [
                'title' => 'Social Media Dashboard',
                'description' => 'Analytics and management tool for multiple social media platforms with automated posting and engagement tracking.',
                'link' => 'https://github.com/basitahmad/social-dashboard',
                'sort_order' => 6,
            ],
        ];

        foreach ($portfolioItems as $item) {
            $portfolio->items()->create($item);
        }

        $this->command->info('Demo portfolio created successfully for ' . $user->name);
        $this->command->info('Portfolio URL: /portfolio/' . $portfolio->slug);
    }
}
