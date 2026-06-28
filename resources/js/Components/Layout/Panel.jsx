export default function Panel({ children, className = '' }) {
    return (
        <section className={`rounded-lg border border-slate-800 bg-slate-900 shadow-sm ${className}`}>
            {children}
        </section>
    );
}
