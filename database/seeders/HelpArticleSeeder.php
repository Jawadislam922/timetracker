<?php

namespace Database\Seeders;

use App\Models\HelpArticle;
use Illuminate\Database\Seeder;

/**
 * Seeds the Help knowledge base from the original hand-written guide. Idempotent
 * (keyed by slug) so it can be re-run after edits without duplicating. Body uses
 * a tiny markup the Help page renders: blank-line paragraphs, "- " bullets,
 * "1." numbered steps, and **bold**.
 */
class HelpArticleSeeder extends Seeder
{
    public function run(): void
    {
        $articles = [
            [
                'category' => 'Getting started',
                'title' => 'The 3 rules that matter most',
                'keywords' => 'rules basics start here onboarding golden',
                'body' => "Three habits keep your hours accurate:\n\n- **Clock in when you start, clock out when you leave.** This is your \"in office\" time.\n- **You must be clocked in to track.** The tracker only runs while you're clocked in and not on a break.\n- **Clock out when you're done.** If you forget, the system closes your day at your shift end automatically — but clocking out yourself keeps your hours accurate.",
            ],
            [
                'category' => 'Attendance',
                'title' => 'Clocking in and out (your attendance)',
                'keywords' => 'clock in clock out attendance present in office punch',
                'body' => "Your clock records when you're present at work. You can clock in and out from the **Dashboard** (web) or the **desktop app** — they're the same clock.\n\n- **Clock In** — when you start your work day.\n- **Clock Out** — when you finish for the day.\n\n\"In Office\" on the dashboard is the time between your clock-in and clock-out (minus breaks). It is not the same as tracked work time.",
            ],
            [
                'category' => 'Tracking',
                'title' => 'Tracking your work (desktop app)',
                'keywords' => 'track tracking desktop app start stop session screenshots activity',
                'body' => "The desktop app records your active work — screenshots, activity %, and keystrokes/clicks — for the client and task you pick.\n\n1. Open the desktop app and **Clock In** (the shift bar at the bottom).\n2. Pick a client, add a short description, and press the big **Start** button.\n3. Press **Stop** when you switch tasks or finish.\n\nIf the Start button is greyed out, it'll say \"Clock in to start tracking.\" Clock in first (or end your break), then start.",
            ],
            [
                'category' => 'Tracking',
                'title' => 'Breaks',
                'keywords' => 'break lunch pause start break end break resume',
                'body' => "Going on a break? Press **Start Break** — this pauses tracking and your break time doesn't count as work. Press **End Break** and then **Resume** when you're back.",
            ],
            [
                'category' => 'Tracking',
                'title' => 'Understanding your Activity %',
                'keywords' => 'activity percent level low activity how is activity calculated keys clicks keyboard mouse idle keep activity up score',
                'body' => "**Activity %** is simply how much of your tracked time you were actively using your keyboard or mouse. The desktop app checks every few seconds whether you've had input, and the percentage is the share of your tracked time that was **active** rather than **idle**.\n\nIt is **not** a measure of how hard you work, and it does not reward fast typing or extra clicks. The keys and clicks shown on a screenshot are just the raw counts for that window — the % is about how much of the *time* you were active.\n\n**100% is not the goal.** A healthy range for real work is about **50–70%**. Reading, thinking, meetings, and phone calls all count as idle time — that's completely normal.\n\nTo keep your activity healthy:\n\n- Stay hands-on while you work — scroll or highlight while reading, take notes while on a call.\n- When you genuinely step away, take a **break** or let the tracker auto-pause (it pauses after a few minutes idle). Breaks stop the clock instead of lowering your score.\n- Don't use mouse-jigglers or auto-clickers — the system flags automated input for a manager to review.",
            ],
            [
                'category' => 'Work Diary',
                'title' => 'Adding time manually (Work Diary)',
                'keywords' => 'manual time work diary add hours meeting offline phone call log time',
                'body' => "For work the tracker didn't capture (a meeting, offline work, a phone call), add it by hand in the **Work Diary**:\n\n1. Go to **Work Diary → Add** (or the \"Add Manual Time\" button).\n2. Pick the client / work type, write what you did, and enter the **hours and minutes**.\n3. Save.\n\nTime the desktop app tracked is locked — you can't hand-edit those hours. If a tracked entry is wrong, remove the relevant screenshots from the Timeline instead.",
            ],
            [
                'category' => 'Schedule',
                'title' => 'Changing your shift for one day (My Schedule)',
                'keywords' => 'schedule shift change shift timing start time my schedule one day override change my schedule different hours',
                'body' => "Need a different shift on a specific day — e.g. start earlier on Friday because you're off Saturday? If you have access, open **My Schedule**:\n\n1. Pick the date (today or a future day).\n2. Set the new start time and/or length, and an optional reason.\n3. Save. That one day now uses your new shift; every other day stays normal.\n\nThis only moves your schedule for that day (when you're expected in, and when a forgotten clock-out auto-closes). It never adds hours. Don't have My Schedule? Ask an admin to enable it for you.",
            ],
            [
                'category' => 'Time zones',
                'title' => 'Times and time zones',
                'keywords' => 'timezone time zone clock format 12 hour 24 hour times off wrong time country',
                'body' => "Every time in SA Track is shown in **your** time zone — you choose which one, once:\n\n1. Open **Profile** (top-right menu) → **Time zone & format**.\n2. Pick your time zone and 12-hour / 24-hour format, then **Save**.\n\nThis only changes how times display to you — it never changes when something actually happened, and it works even if your computer's clock is wrong. Two people in different countries see the same clock-in each in their own local time, and both are correct.",
            ],
            [
                'category' => 'How it works',
                'title' => 'What the system does automatically',
                'keywords' => 'automatic auto clock out forgot shift end grace still working slack nudge',
                'body' => "- **Forgot to clock out?** The system closes your day at your shift end + a short grace period, so a forgotten clock-out doesn't inflate your hours. If you're genuinely still working (tracker running), it leaves you alone.\n- **Still working late?** You may get a friendly Slack \"still working?\" check. Reply, or it'll close your day after a few unanswered nudges.\n- **Clocked out but tracker still on?** The tracker stops itself — you can't record time outside a clock-in.",
            ],
            [
                'category' => 'Desktop app',
                'title' => 'Getting the desktop app',
                'keywords' => 'download desktop app install mac windows setup update auto-update version',
                'body' => "Download the desktop app from the **Desktop Downloads** link in your profile menu (top-right). Install it, sign in with your SA Track email, and you're ready to clock in and track.\n\nYou only install it once — the app **updates itself** in the background when a new version is released, so you don't need to re-download it. If you're ever asked to restart it to finish an update, just close and reopen it.",
            ],
            [
                'category' => 'Desktop app',
                'title' => 'Using SA Track on a shared computer',
                'keywords' => 'shared computer shared pc multiple people same machine bidding pc sign in switch user separate whose time',
                'body' => "Several people using the same PC? That's fine — SA Track keeps each person separate:\n\n1. **Always sign in as yourself.** If someone else is signed in, sign them out first (profile menu → **Sign out**), then sign in with your own email.\n2. **Clock in as you, and stop/clock out when you're done** so the next person starts clean.\n3. Each signed-in person gets their **own private space** on that machine — your queued time and screenshots are never mixed with a co-worker's.\n\nThe one thing to get right on a shared PC is **who is signed in** — the hours always follow the signed-in account, not the computer.",
            ],
            [
                'category' => 'Troubleshooting',
                'title' => 'Why did my tracker stop on its own?',
                'keywords' => 'tracker stopped stopped on its own why stopped not tracking',
                'body' => "Either you (or the system) clocked you out, or your session was closed at shift end. Clock in again to keep tracking.",
            ],
            [
                'category' => 'Troubleshooting',
                'title' => "Why can't I press Start? (Start is greyed out)",
                'keywords' => 'start greyed out cant start disabled clock in to start',
                'body' => "You're not clocked in, or you're on a break. Clock in or end your break first, then press Start.",
            ],
            [
                'category' => 'Troubleshooting',
                'title' => 'My in-office time looks too high',
                'keywords' => 'in office too high wrong hours inflated forgot clock out',
                'body' => "You probably forgot to clock out on a previous day. Going forward, clock out when you leave; the system also auto-closes forgotten days at shift end.",
            ],
            [
                'category' => 'Troubleshooting',
                'title' => "Tracked time vs in-office — what's the difference?",
                'keywords' => 'tracked vs in office difference gap presence meaning',
                'body' => "In-office = clock-in to clock-out (your presence). Tracked = what the desktop app actually recorded. They're different on purpose: you can be present (in a meeting, offline) without the tracker running.",
            ],
            [
                'category' => 'Troubleshooting',
                'title' => 'The times look a few hours off',
                'keywords' => 'times off hours off wrong timezone 5 hours off shifted',
                'body' => "Check **Profile → Time zone** is set to where you are. Times always display in your chosen zone, never your computer's clock — so a wrong PC clock can't throw them off.",
            ],
            [
                'category' => 'How it works',
                'title' => 'How your dashboard numbers are calculated',
                'keywords' => 'dashboard numbers tracked work today yesterday week month calculation confusing dont match different why less midnight night shift in office attendance',
                'body' => "The dashboard measures **tracked work** — what the desktop tracker recorded (plus manual Work Diary hours). One simple rule everywhere:\n\n**A tracked day is a calendar day.** The same number appears on your Dashboard, your Timeline, and in the desktop app — always. Work after midnight counts on the **next** date, on all three.\n\nThe team table shows, per person:\n\n- **Tracked today** — tracker time since midnight. Matches the Timeline exactly.\n- **Yesterday** — yesterday's full tracked total. Night team: your evening work lands here after midnight — it's not lost, it's on yesterday's date, same as your Timeline.\n- **This week** — tracked since **Monday**. **This month** — tracked since the **1st**.\n- **Activity %** — the share of tracked time with keyboard/mouse input.\n\n**\"Why is This week bigger than This month?\"** In the first days of a month this is correct: the week can include days from the end of last month, which the month column doesn't count. It evens out within a few days.\n\n**Where did In Office and Break go?** To the **Attendance** section (Summary and the Monthly grid), where clock-ins, breaks, and late codes live. Attendance follows your **shift day** (a night shift's clock time doesn't reset at midnight). Tracked time and in-office time are different measurements answering different questions — that's why they're no longer shown side by side.",
            ],
            [
                'category' => 'How it works',
                'title' => 'What SA Track records — and who can see it',
                'keywords' => 'privacy what is recorded screenshots data who can see private tracked data stored where security webcam',
                'body' => "SA Track is a **work** tracker, so it's clear about what it records:\n\n- **While you're tracking** (clocked in and Start pressed), it takes periodic **screenshots** of your screen and counts keyboard/mouse activity for the client and task you picked.\n- It records the **active app / window title** so your work can be grouped by what you were doing.\n- It does **not** use your webcam, read your files, or log what you type (only *how much* you type — a count, not the keys).\n\n**When you're not tracking — on a break, clocked out, or the tracker stopped — nothing is captured.**\n\nEverything is sent to the company's own private SA Track server over a secure connection. Your screenshots and activity are visible to **you** and to **authorized managers** only — not to co-workers.",
            ],
            [
                'category' => 'For managers',
                'title' => 'For admins and managers',
                'admin_only' => true,
                'keywords' => 'admin manager fix clock times grant access remote worker work timezone manage permissions',
                'body' => "- **Fix someone's clock times** — if an employee forgot to clock in/out, open **Attendance → Summary → Edit clock times** (needs the permission). Every edit is recorded in the audit history.\n- **Change anyone's shift for a day** — with \"Change anyone's shift\" you can set or backdate a one-day shift for any employee.\n- **Remote workers in another country** — set a person's **Work timezone** on their **Users → Edit** page. Their work day, shift, and auto clock-out are then measured in their own country's day, while you keep reading every time in your own zone. Leave it on Asia/Karachi for local staff.\n- **Grant access** — Super Admins enable features per person on the **Users** page (clock-time editing, My Schedule, reports, screenshots, etc.).\n- **Reading the numbers** — the Dashboard team table shows In-Office vs Tracked vs Activity %. A big gap between in-office and tracked usually means present-but-not-tracking (meetings, offline work) or a forgotten clock-out.",
            ],
        ];

        foreach ($articles as $i => $article) {
            HelpArticle::updateOrCreate(
                ['slug' => \Illuminate\Support\Str::slug($article['title'])],
                [
                    'title' => $article['title'],
                    'category' => $article['category'],
                    'body' => $article['body'],
                    'keywords' => $article['keywords'] ?? null,
                    'admin_only' => $article['admin_only'] ?? false,
                    'sort_order' => $i,
                    'is_published' => true,
                ],
            );
        }
    }
}
