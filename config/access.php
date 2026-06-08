<?php

return [
    'roles' => [
        'super_admin' => [
            'label' => 'Super Admin',
            'description' => 'Full system access, including roles and permissions.',
        ],
        'admin' => [
            'label' => 'Admin',
            'description' => 'Management access selected by a Super Admin.',
        ],
        'member' => [
            'label' => 'Member',
            'description' => 'Personal time tracking with optional selected access.',
        ],
    ],

    'permissions' => [
        'Dashboard' => [
            'dashboard.view_team' => 'View team activity and team dashboard data',
        ],
        'Users' => [
            'users.view' => 'View the user directory',
            'users.manage' => 'Create and update ordinary user accounts',
            'users.delete' => 'Delete ordinary user accounts',
        ],
        'Clients' => [
            'clients.view' => 'View clients',
            'clients.manage' => 'Create, edit, and delete clients',
            'clients.import_export' => 'Import and export clients',
        ],
        'Profiles' => [
            'profiles.view' => 'View Upwork profiles',
            'profiles.manage' => 'Create, edit, and delete Upwork profiles',
        ],
        'Attendance' => [
            'attendance.view' => 'View team attendance',
            'attendance.manual_mark' => 'Manually mark and correct attendance statuses',
            'attendance.export' => 'Export attendance data',
        ],
        'Reports' => [
            'reports.view' => 'View team work-hour reports',
            'reports.export' => 'Export team work-hour reports',
            'reports.send_slack' => 'Send work-hour reports to Slack',
        ],
        'Work Diary' => [
            'work_hours.manage_all' => 'Edit and delete work entries belonging to other users',
        ],
    ],
];
