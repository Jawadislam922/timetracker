export default function PageShell({ children, width = 'max-w-none', className = '' }) {
    return (
        <div className="min-h-screen bg-slate-950">
            <div className={`mx-auto ${width} space-y-4 px-4 py-5 sm:px-6 lg:px-8 ${className}`}>
                {children}
            </div>
        </div>
    );
}
