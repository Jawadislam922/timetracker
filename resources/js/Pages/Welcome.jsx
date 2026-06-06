import { Link, Head } from "@inertiajs/react";

export default function Welcome({ auth, laravelVersion, phpVersion }) {
    return (
        <>
            <Head title="Sparking Asia" />
            
            {/* Navigation - Outside the main container */}
            <nav className="sticky top-0 z-30 p-6 bg-black/20 backdrop-blur-xl border-b border-gray-600/20">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white/20 backdrop-blur-lg rounded-xl shadow-lg">
                            <img 
                                src="/images/sparking-asia-logo.png?v=2" 
                                className="w-10 h-10 object-contain"
                                alt="Sparking Asia Logo"
                                onError={(e) => {
                                    console.error('Logo failed to load');
                                    e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><text y="20" font-size="20">SA</text></svg>';
                                }}
                            />
                        </div>
                        <span className="text-gray-100 font-bold text-xl hidden sm:block">
                            TimeTracker
                        </span>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                        {auth.user ? (
                            <Link
                                href={route("dashboard")}
                                className="bg-orange-500/90 backdrop-blur-lg text-white font-semibold px-6 py-3 rounded-xl hover:bg-orange-600/90 transition-all duration-200 shadow-lg border border-orange-400/50"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <Link
                                href={route("login")}
                                className="bg-orange-500/90 backdrop-blur-lg text-white font-semibold px-6 py-3 rounded-xl hover:bg-orange-600/90 transition-all duration-200 shadow-lg border border-orange-400/50"
                            >
                                Sign In
                            </Link>
                        )}
                    </div>
                </div>
            </nav>

            <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 relative overflow-hidden" style={{background: 'linear-gradient(135deg, #282a2a 0%, #1f2020 50%, #161717 100%)'}}>
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full opacity-20 animate-float"></div>
                    <div className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full opacity-30 animate-float-delayed" style={{background: 'linear-gradient(45deg, #282a2a, #1f2020)'}}></div>
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-yellow-300 to-orange-400 rounded-full opacity-10 animate-bounce"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 animate-bounce delay-500" style={{background: 'linear-gradient(135deg, #282a2a, #404343)'}}></div>
                    <div className="absolute top-3/4 left-1/2 w-64 h-64 bg-gradient-to-r from-orange-300 to-yellow-400 rounded-full opacity-20 animate-pulse"></div>
                </div>

                {/* Main Content */}
                <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-12 pb-20">
                    {/* Hero Section */}
                    <div className="text-center mb-16">
                        {/* Logo Section */}
                        <div className="flex justify-center mb-8">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-3xl blur-xl opacity-60 animate-pulse"></div>
                                <div className="relative glass-effect rounded-3xl p-8 shadow-2xl">
                                    <img 
                                        src="/images/sparking-asia-logo.png?v=2" 
                                        className="w-32 h-32 object-contain mx-auto animate-float" 
                                        alt="Sparking Asia Logo"
                                        onError={(e) => {
                                            console.error('Hero logo failed to load');
                                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><text y="70" x="20" font-size="40">SA</text></svg>';
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Title and Description */}
                        <div className="space-y-6">
                            <h1 className="text-5xl md:text-7xl font-bold text-gray-100 mb-6 leading-tight">
                                <span className="block">Welcome to</span>
                                <span className="block bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
                                    Sparking Asia
                                </span>
                                <span className="block text-4xl md:text-5xl mt-2 text-gray-100">
                                    TimeTracker
                                </span>
                            </h1>
                            
                            <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
                                Revolutionize your productivity with our cutting-edge time tracking solution, 
                                designed specifically for the dynamic Sparking Asia team.
                            </p>
                        </div>

                        {/* Call-to-Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-6 justify-center mt-12">
                            {!auth.user && (
                                <>
                                    <Link
                                        href={route("login")}
                                        className="btn-primary bg-gradient-to-r from-orange-400 to-yellow-500 hover:from-orange-500 hover:to-yellow-600 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-2xl text-lg"
                                    >
                                        <div className="flex items-center justify-center space-x-2">
                                            <span>Get Started</span>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                        </div>
                                    </Link>
                                    <button className="bg-gray-600/80 backdrop-blur-lg text-gray-100 font-semibold px-8 py-4 rounded-2xl hover:bg-gray-500/80 transition-all duration-300 border border-gray-400/50 text-lg">
                                        Learn More
                                    </button>
                                </>
                            )}
                            {auth.user && (
                                <Link
                                    href={route("dashboard")}
                                    className="btn-primary bg-gradient-to-r from-orange-400 to-yellow-500 hover:from-orange-500 hover:to-yellow-600 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-2xl text-lg"
                                >
                                    <div className="flex items-center justify-center space-x-2">
                                        <span>Go to Dashboard</span>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </div>
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Features Section */}
                    <div className="grid md:grid-cols-3 gap-8 mt-20">
                        {/* Feature 1 */}
                        <div className="bg-gray-800/70 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-gray-600/30 hover:bg-gray-700/70 transition-all duration-300 transform hover:scale-105">
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg" style={{background: 'linear-gradient(135deg, #282a2a, #404343)'}}>
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-100 mb-3">Smart Time Tracking</h3>
                                <p className="text-gray-300">
                                    Effortlessly track your work hours with our intelligent timing system that adapts to your workflow.
                                </p>
                            </div>
                        </div>

                        {/* Feature 2 */}
                        <div className="bg-gray-800/70 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-gray-600/30 hover:bg-gray-700/70 transition-all duration-300 transform hover:scale-105">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-100 mb-3">Analytics & Reports</h3>
                                <p className="text-gray-300">
                                    Get detailed insights into your productivity with comprehensive analytics and beautiful reports.
                                </p>
                            </div>
                        </div>

                        {/* Feature 3 */}
                        <div className="bg-gray-800/70 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-gray-600/30 hover:bg-gray-700/70 transition-all duration-300 transform hover:scale-105">
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg" style={{background: 'linear-gradient(135deg, #282a2a, #3a3d3d)'}}>
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-100 mb-3">Team Collaboration</h3>
                                <p className="text-gray-300">
                                    Seamlessly collaborate with your team members and manage projects with ease and efficiency.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="text-center mt-20">
                        <p className="text-gray-400 text-sm">
                            © {new Date().getFullYear()} Sparking Asia. Crafted with ❤️ for productivity.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
