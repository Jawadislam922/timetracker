import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import { useForm, usePage } from '@inertiajs/react';
import { Transition } from '@headlessui/react';

// Common business zones (Pakistan + Gulf/South-Asia, Europe, US, AU, UTC). The
// list a person picks from for how times display to them.
const TIMEZONES = [
    'Asia/Karachi', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Riyadh',
    'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago',
    'America/Denver', 'America/Los_Angeles', 'Australia/Sydney', 'UTC',
];

export default function UpdateDisplayPreferencesForm({ className = '' }) {
    const display = usePage().props.display || {};

    const { data, setData, patch, processing, recentlySuccessful } = useForm({
        display_timezone: display.timezone || 'Asia/Karachi',
        time_format: String(display.format) === '24' ? '24' : '12',
    });

    const submit = (e) => {
        e.preventDefault();
        patch(route('profile.display'), { preserveScroll: true });
    };

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-slate-900">Time zone &amp; format</h2>
                <p className="mt-1 text-sm text-slate-600">
                    Choose the time zone you want all times shown in. This only changes how times
                    <strong> display to you</strong> — it never changes when anything actually happened, and
                    it works regardless of your computer&apos;s clock settings.
                </p>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-6">
                <div>
                    <InputLabel htmlFor="display_timezone" value="Time zone" />
                    <select
                        id="display_timezone"
                        value={data.display_timezone}
                        onChange={(e) => setData('display_timezone', e.target.value)}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    >
                        {TIMEZONES.map((tz) => (
                            <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <InputLabel value="Time format" />
                    <div className="mt-2 flex gap-6">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                                type="radio"
                                name="time_format"
                                value="12"
                                checked={data.time_format === '12'}
                                onChange={() => setData('time_format', '12')}
                                className="text-orange-600 focus:ring-orange-500"
                            />
                            12-hour (3:45 PM)
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                                type="radio"
                                name="time_format"
                                value="24"
                                checked={data.time_format === '24'}
                                onChange={() => setData('time_format', '24')}
                                className="text-orange-600 focus:ring-orange-500"
                            />
                            24-hour (15:45)
                        </label>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <PrimaryButton disabled={processing}>Save</PrimaryButton>
                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-slate-600">Saved.</p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
