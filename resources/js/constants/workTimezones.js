// Home/work zones a worker's day + shift are measured in (separate from how a
// viewer reads times). Default Asia/Karachi keeps existing staff unchanged.
// Shared by the single-user form and the Users-list bulk-edit modal so the two
// pickers can never drift apart.
export const WORK_TIMEZONES = [
    'Asia/Karachi', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Manila',
    'Asia/Riyadh', 'Europe/London', 'Europe/Berlin', 'America/New_York',
    'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Australia/Sydney', 'UTC',
];
