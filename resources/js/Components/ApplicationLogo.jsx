export default function ApplicationLogo({ size = "40" }) {
    return (
        <div className="flex justify-center">
            <img 
                src="/images/sparking-asia-logo.png?v=2" 
                className={`w-${size} h-${size} object-contain filter drop-shadow-lg`} 
                alt="Sparking Asia Logo"
                onError={(e) => {
                    console.error('Logo failed to load:', e.target.src);
                    e.target.style.display = 'none';
                }}
            />
        </div>
    );
}
