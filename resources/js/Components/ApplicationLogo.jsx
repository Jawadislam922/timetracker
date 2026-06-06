export default function ApplicationLogo({ size = "40" }) {
    const dimension = `${Number(size) * 0.25}rem`;

    return (
        <div className="flex justify-center" style={{ width: dimension, height: dimension }}>
            <img 
                src="/images/sparking-asia-logo.png?v=2" 
                className="h-full w-full object-contain drop-shadow-lg"
                alt="Sparking Asia Logo"
                onError={(e) => {
                    console.error('Logo failed to load:', e.target.src);
                    e.target.style.display = 'none';
                }}
            />
        </div>
    );
}
