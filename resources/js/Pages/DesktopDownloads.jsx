import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Apple, CheckCircle2, Download, Laptop, MonitorDown, ShieldAlert } from 'lucide-react';

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
                        subtitle="Mac build will appear here after it is packaged and signed"
                        icon={Apple}
                        accent="bg-slate-100 text-slate-700"
                        download={downloads.mac}
                    />
                </div>

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
        </AuthenticatedLayout>
    );
}
