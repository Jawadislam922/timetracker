import { useState } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Apple, CheckCircle2, Copy, Download, Laptop, MonitorDown, ShieldAlert } from 'lucide-react';

const MAC_QUARANTINE_CMD = 'xattr -dr com.apple.quarantine "/Applications/Timetracker Desktop.app"';

function MacInstallHelp() {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(MAC_QUARANTINE_CMD);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard may be blocked; user can select manually */
        }
    };

    return (
        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
                <Apple className="h-5 w-5 text-slate-700" />
                <h2 className="text-base font-semibold text-slate-950">Opening the app on macOS (first launch)</h2>
            </div>
            <p className="text-sm leading-6 text-slate-600">
                The Mac build is not yet signed with an Apple Developer ID, so on first launch macOS shows
                <span className="font-medium text-slate-800"> “Apple could not verify… Not Opened.”</span> This is expected.
                <span className="font-semibold text-rose-600"> Do not click “Move to Bin.”</span> Unblock it once per Mac:
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Option A — Terminal (most reliable)</div>
                    <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-700">
                        <li>Drag <span className="font-medium">Timetracker Desktop</span> into <span className="font-medium">Applications</span>.</li>
                        <li>Open <span className="font-medium">Terminal</span> and run the command below.</li>
                        <li>Double-click the app in Applications — it opens normally.</li>
                    </ol>
                    <div className="mt-3 flex items-stretch gap-2">
                        <code className="min-w-0 flex-1 overflow-x-auto rounded bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-200">
                            {MAC_QUARANTINE_CMD}
                        </code>
                        <button
                            type="button"
                            onClick={copy}
                            className="inline-flex shrink-0 items-center gap-1 rounded bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Option B — No Terminal</div>
                    <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-700">
                        <li>Click <span className="font-medium">Done</span> on the warning (not “Move to Bin”).</li>
                        <li>Open  → <span className="font-medium">System Settings</span> → <span className="font-medium">Privacy &amp; Security</span>.</li>
                        <li>Scroll down — click <span className="font-medium">Open Anyway</span> next to “Timetracker Desktop”.</li>
                        <li>Launch the app again and click <span className="font-medium">Open</span>.</li>
                    </ol>
                    <p className="mt-3 text-xs text-slate-500">
                        After opening once, approve the prompts for Screen Recording, Accessibility, and Automation (per browser, for URL capture).
                    </p>
                </div>
            </div>
        </div>
    );
}

function formatBytes(bytes) {
    if (!bytes) {
        return null;
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unit = 0;

    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }

    return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function DownloadCard({ title, subtitle, icon: Icon, accent, download }) {
    const available = download?.available;

    return (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${accent}`}>
                        <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
                        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
                    </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {available ? 'Available' : 'Pending'}
                </span>
            </div>

            <div className="mt-5 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                    <div className="text-xs font-semibold uppercase text-slate-400">Version</div>
                    <div className="mt-1 font-medium text-slate-900">{download?.version || 'Not built'}</div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase text-slate-400">Size</div>
                    <div className="mt-1 font-medium text-slate-900">{formatBytes(download?.size) || '-'}</div>
                </div>
                <div className="sm:col-span-2">
                    <div className="text-xs font-semibold uppercase text-slate-400">SHA256</div>
                    <div className="mt-1 break-all font-mono text-xs text-slate-700">{download?.sha256 || '-'}</div>
                </div>
            </div>

            <div className="mt-5">
                {available ? (
                    <a
                        href={download.url}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
                    >
                        <Download className="h-4 w-4" />
                        Download
                    </a>
                ) : (
                    <button
                        type="button"
                        disabled
                        className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500 sm:w-auto"
                    >
                        <Download className="h-4 w-4" />
                        Download
                    </button>
                )}
            </div>
        </section>
    );
}

export default function DesktopDownloads({ auth, downloads }) {
    return (
        <AuthenticatedLayout user={auth.user} header="Desktop App">
            <Head title="Desktop App" />

            <div className="min-h-screen bg-slate-950">
            <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
                <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-semibold uppercase text-blue-600">
                                <MonitorDown className="h-4 w-4" />
                                Employee tracker
                            </div>
                            <h1 className="mt-2 text-2xl font-bold text-slate-950">Download Timetracker Desktop</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                                Install the desktop tracker on company machines for screenshot capture, activity sampling,
                                and automatic report entries.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            <ShieldAlert className="h-5 w-5 shrink-0" />
                            Unsigned local build
                        </div>
                    </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    <DownloadCard
                        title="Windows PC"
                        subtitle="Windows 10 or later, 64-bit"
                        icon={Laptop}
                        accent="bg-blue-50 text-blue-700"
                        download={downloads.windows}
                    />
                    <DownloadCard
                        title="macOS"
                        subtitle="Apple Silicon (M1/M2/M3), macOS 12 or later"
                        icon={Apple}
                        accent="bg-slate-100 text-slate-700"
                        download={downloads.mac}
                    />
                </div>

                {downloads.mac?.available && <MacInstallHelp />}

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                        <div className="mb-2 flex items-center gap-2 font-semibold">
                            <CheckCircle2 className="h-4 w-4" />
                            Sign in with web credentials
                        </div>
                        <p className="leading-6">Employees use the same Timetracker account after installation.</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                        <div className="mb-2 font-semibold text-slate-900">Server URL</div>
                        <p className="leading-6">Use the company Timetracker URL when the desktop app asks for the server.</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                        <div className="mb-2 font-semibold text-slate-900">Company rollout</div>
                        <p className="leading-6">For managed installs, distribute the Windows installer through your IT tool.</p>
                    </div>
                </div>
            </div>
            </div>
        </AuthenticatedLayout>
    );
}
