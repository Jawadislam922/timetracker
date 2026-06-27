import AuthenticatedLayout from '../Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import PageHeader from '../Components/Layout/PageHeader';
import PageShell from '../Components/Layout/PageShell';
import {
    Clock, Play, Coffee, NotebookPen, CalendarClock, ShieldCheck,
    HelpCircle, CheckCircle2, AlertTriangle, MonitorDown, Globe,
} from 'lucide-react';

function Section({ icon: Icon, title, children }) {
    return (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-orange-400">
                    <Icon className="h-4 w-4" />
                </span>
                {title}
            </h2>
            <div className="space-y-2 text-sm leading-relaxed text-slate-300">{children}</div>
        </section>
    );
}

function Step({ n, children }) {
    return (
        <li className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-[11px] font-bold text-orange-300">{n}</span>
            <span>{children}</span>
        </li>
    );
}

export default function Help({ auth }) {
    const isAdmin = auth?.user?.is_super_admin || (auth?.user?.permissions || []).length > 0;

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="How to use SA Track" />

            <PageShell width="max-w-4xl">
                <PageHeader
                    title="How to use SA Track"
                    description="Everything you need to track your time correctly. Takes about 3 minutes to read."
                />

                {/* The golden rules */}
                <section className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5">
                    <h2 className="mb-3 text-base font-bold text-white">The 3 rules that matter most</h2>
                    <ul className="space-y-2 text-sm text-slate-200">
                        <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span><b>Clock in when you start, clock out when you leave.</b> This is your “in office” time.</span></li>
                        <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span><b>You must be clocked in to track.</b> The tracker only runs while you’re clocked in and not on a break.</span></li>
                        <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span><b>Clock out when you’re done.</b> If you forget, the system closes your day at your shift end automatically — but clocking out yourself keeps your hours accurate.</span></li>
                    </ul>
                </section>

                <Section icon={Clock} title="Clocking in & out (your attendance)">
                    <p>Your <b>clock</b> records when you’re present at work. You can clock in/out from the <b>Dashboard</b> (web) or the <b>desktop app</b> — they’re the same clock.</p>
                    <ul className="ml-1 space-y-1.5">
                        <li>• <b>Clock In</b> — when you start your work day.</li>
                        <li>• <b>Clock Out</b> — when you finish for the day.</li>
                    </ul>
                    <p className="text-slate-400">“In Office” on the dashboard = the time between your clock-in and clock-out (minus breaks). It is <i>not</i> the same as tracked work time.</p>
                </Section>

                <Section icon={Play} title="Tracking your work (desktop app)">
                    <p>The desktop app records your active work — screenshots, activity %, and keystrokes/clicks — for the client and task you pick.</p>
                    <ul className="space-y-2">
                        <Step n="1">Open the desktop app and <b>Clock In</b> (the shift bar at the bottom).</Step>
                        <Step n="2">Pick a client, add a short description, and press the big <b>Start</b> button.</Step>
                        <Step n="3">Press <b>Stop</b> when you switch tasks or finish.</Step>
                    </ul>
                    <p className="flex items-start gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-slate-300">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        If the Start button is greyed out, it’ll say <b>“Clock in to start tracking.”</b> Clock in first (or end your break), then start.
                    </p>
                </Section>

                <Section icon={Coffee} title="Breaks">
                    <p>Going on a break? Press <b>Start Break</b> — this pauses tracking and your break time doesn’t count as work. Press <b>End Break</b> and then <b>Resume</b> when you’re back.</p>
                </Section>

                <Section icon={NotebookPen} title="Adding time manually (Work Diary)">
                    <p>For work the tracker didn’t capture (a meeting, offline work, a phone call), add it by hand in the <b>Work Diary</b>:</p>
                    <ul className="space-y-2">
                        <Step n="1">Go to <b>Work Diary → Add</b> (or the “Add Manual Time” button).</Step>
                        <Step n="2">Pick the client/work type, write what you did, and enter the <b>hours and minutes</b>.</Step>
                        <Step n="3">Save.</Step>
                    </ul>
                    <p className="text-slate-400">Note: time the desktop app tracked is <b>locked</b> — you can’t hand-edit those hours. If a tracked entry is wrong, remove the relevant screenshots from the Timeline instead.</p>
                </Section>

                <Section icon={CalendarClock} title="Changing your shift for one day (My Schedule)">
                    <p>Need a different shift on a specific day — e.g. start earlier on Friday because you’re off Saturday? If you have access, open <b>My Schedule</b>:</p>
                    <ul className="space-y-2">
                        <Step n="1">Pick the date (today or a future day).</Step>
                        <Step n="2">Set the new start time and/or length, and an optional reason.</Step>
                        <Step n="3">Save. That one day now uses your new shift; every other day stays normal.</Step>
                    </ul>
                    <p className="text-slate-400">This only moves your schedule for that day (when you’re expected in, and when a forgotten clock-out auto-closes). It never adds hours. Don’t have My Schedule? Ask an admin to enable it for you.</p>
                </Section>

                <Section icon={Globe} title="Times & time zones">
                    <p>Every time in SA Track is shown in <b>your</b> time zone — you choose which one, once:</p>
                    <ul className="space-y-2">
                        <Step n="1">Open <b>Profile</b> (top-right menu) → <b>Time zone &amp; format</b>.</Step>
                        <Step n="2">Pick your time zone and 12-hour / 24-hour format, then <b>Save</b>.</Step>
                    </ul>
                    <p className="text-slate-400">This only changes how times <i>display to you</i> — it never changes when something actually happened, and it works even if your computer&apos;s clock is set to the wrong time or zone. Two people in different countries see the same clock-in each in their own local time, and both are correct.</p>
                </Section>

                <Section icon={ShieldCheck} title="What the system does automatically">
                    <ul className="ml-1 space-y-1.5">
                        <li>• <b>Forgot to clock out?</b> The system closes your day at your <b>shift end + a short grace period</b>, so a forgotten clock-out doesn’t inflate your hours. If you’re genuinely still working (tracker running), it leaves you alone.</li>
                        <li>• <b>Still working late?</b> You may get a friendly Slack “still working?” check. Reply, or it’ll close your day after a few unanswered nudges.</li>
                        <li>• <b>Clocked out but tracker still on?</b> The tracker stops itself — you can’t record time outside a clock-in.</li>
                    </ul>
                </Section>

                <Section icon={MonitorDown} title="Getting the desktop app">
                    <p>Download the desktop app from the <b>Desktop Downloads</b> link in your profile menu (top-right). Install it, sign in with your SA Track email, and you’re ready to clock in and track.</p>
                </Section>

                <Section icon={HelpCircle} title="Quick answers">
                    <p><b>“Why did my tracker stop on its own?”</b> — Either you (or the system) clocked you out, or your session was closed at shift end. Clock in again to keep tracking.</p>
                    <p><b>“Why can’t I press Start?”</b> — You’re not clocked in, or you’re on a break. Clock in / end your break first.</p>
                    <p><b>“My in-office time looks too high.”</b> — You probably forgot to clock out on a previous day. Going forward, clock out when you leave; the system also auto-closes forgotten days at shift end.</p>
                    <p><b>“Tracked time vs in-office?”</b> — In-office = clock-in to clock-out (presence). Tracked = what the desktop app actually recorded. They’re different on purpose.</p>
                    <p><b>“The times look a few hours off.”</b> — Check <b>Profile → Time zone</b> is set to where you are. Times always display in your chosen zone, never your computer’s clock — so a wrong PC clock can’t throw them off.</p>
                </Section>

                {isAdmin && (
                    <Section icon={ShieldCheck} title="For admins & managers">
                        <ul className="ml-1 space-y-1.5">
                            <li>• <b>Fix someone’s clock times</b> — if an employee forgot to clock in/out, open <b>Attendance → Summary → Edit clock times</b> (needs the permission). Every edit is recorded in the audit history.</li>
                            <li>• <b>Change anyone’s shift for a day</b> — with “Change anyone’s shift” you can set or backdate a one-day shift for any employee.</li>
                            <li>• <b>Remote workers in another country</b> — set a person’s <b>Work timezone</b> on their <b>Users → Edit</b> page. Their work day, shift, and auto clock-out are then measured in their own country’s day, while you keep reading every time in your own time zone. Leave it on Asia/Karachi for local staff.</li>
                            <li>• <b>Grant access</b> — Super Admins enable features per person on the <b>Users</b> page (clock-time editing, My Schedule, reports, screenshots, etc.).</li>
                            <li>• <b>Reading the numbers</b> — the Dashboard team table shows In-Office vs Tracked vs Activity %. A big gap between in-office and tracked usually means present-but-not-tracking (meetings, offline work) or a forgotten clock-out.</li>
                        </ul>
                    </Section>
                )}

                <p className="pb-4 text-center text-xs text-slate-500">
                    Questions this guide didn’t answer? Ask your team lead or an admin.
                </p>
            </PageShell>
        </AuthenticatedLayout>
    );
}
