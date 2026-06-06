export default function PageHeader({ title, description, actions = null }) {
    return (
        <section className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
                {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </section>
    );
}
