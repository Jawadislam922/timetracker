import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import EmployeeAnalytics from '@/Components/EmployeeAnalytics';
import AdminAnalytics from '@/Components/AdminAnalytics';

// Animated Spider Web Background Component
const AnimatedBackground = () => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [particles, setParticles] = useState([]);

    useEffect(() => {
        // Initialize web nodes (particles)
        const initialParticles = Array.from({ length: 80 }, (_, i) => ({
            id: i,
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            size: Math.random() * 3 + 2,
            speedX: (Math.random() - 0.5) * 0.3,
            speedY: (Math.random() - 0.5) * 0.3,
            opacity: Math.random() * 0.6 + 0.2,
        }));
        setParticles(initialParticles);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        const animateParticles = () => {
            setParticles(prevParticles =>
                prevParticles.map(particle => {
                    let newX = particle.x + particle.speedX;
                    let newY = particle.y + particle.speedY;

                    // Mouse interaction - stronger attraction for web effect
                    const dx = mousePosition.x - newX;
                    const dy = mousePosition.y - newY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 150) {
                        newX += dx * 0.003;
                        newY += dy * 0.003;
                    }

                    // Bounce off edges
                    if (newX <= 0 || newX >= window.innerWidth) particle.speedX *= -1;
                    if (newY <= 0 || newY >= window.innerHeight) particle.speedY *= -1;

                    return {
                        ...particle,
                        x: newX,
                        y: newY,
                    };
                })
            );
        };

        const interval = setInterval(animateParticles, 16);
        return () => clearInterval(interval);
    }, [mousePosition]);

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ backgroundColor: '#282a2a' }}>
            {/* Web nodes (particles) */}
            <div className="absolute inset-0">
                {particles.map(particle => (
                    <div
                        key={particle.id}
                        className="absolute rounded-full"
                        style={{
                            left: `${particle.x}px`,
                            top: `${particle.y}px`,
                            width: `${particle.size}px`,
                            height: `${particle.size}px`,
                            backgroundColor: '#ffffff',
                            opacity: particle.opacity * 0.8,
                            transform: `translate(-50%, -50%)`,
                            transition: 'all 0.1s ease-out',
                            boxShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
                        }}
                    />
                ))}
            </div>

            {/* Spider web lines */}
            <svg className="absolute inset-0 w-full h-full">
                {particles.map((particle, index) => {
                    return particles.slice(index + 1).map((otherParticle, otherIndex) => {
                        const distance = Math.sqrt(
                            Math.pow(particle.x - otherParticle.x, 2) + 
                            Math.pow(particle.y - otherParticle.y, 2)
                        );
                        
                        if (distance < 120) {
                            const opacity = Math.max(0.1, 1 - (distance / 120));
                            return (
                                <line
                                    key={`web-${index}-${otherIndex}`}
                                    x1={particle.x}
                                    y1={particle.y}
                                    x2={otherParticle.x}
                                    y2={otherParticle.y}
                                    stroke="rgba(255, 255, 255, 0.3)"
                                    strokeWidth="1"
                                    opacity={opacity * 0.5}
                                />
                            );
                        }
                        return null;
                    });
                })}
                
                {/* Additional radial web lines from mouse */}
                {particles.slice(0, 15).map((particle, index) => {
                    const distance = Math.sqrt(
                        Math.pow(particle.x - mousePosition.x, 2) + 
                        Math.pow(particle.y - mousePosition.y, 2)
                    );
                    
                    if (distance < 200 && mousePosition.x > 0 && mousePosition.y > 0) {
                        const opacity = Math.max(0.1, 1 - (distance / 200));
                        return (
                            <line
                                key={`mouse-web-${index}`}
                                x1={mousePosition.x}
                                y1={mousePosition.y}
                                x2={particle.x}
                                y2={particle.y}
                                stroke="rgba(16, 185, 129, 0.4)"
                                strokeWidth="1.5"
                                opacity={opacity * 0.6}
                            />
                        );
                    }
                    return null;
                })}
            </svg>

            {/* Mouse cursor web center */}
            <div
                className="absolute w-20 h-20 rounded-full border-2 border-white/20 pointer-events-none"
                style={{
                    left: mousePosition.x - 40,
                    top: mousePosition.y - 40,
                    transition: 'all 0.1s ease-out',
                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)',
                }}
            />
        </div>
    );
};

export default function Dashboard({ auth, stats, userRole, analytics, employees }) {
    return (
        <AuthenticatedLayout
            user={auth.user}
            header="Dashboard"
        >
            <Head title="Dashboard" />

            <div className="relative min-h-screen overflow-hidden">
                <AnimatedBackground />
                
                {/* Main Content */}
                <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-8">
                    {/* Hero Section */}
                    <div className="max-w-7xl mx-auto mb-12">
                        <div className="text-center mb-16">
                            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-md border border-white/20 mb-6">
                                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                                <span className="text-white/80 text-sm font-medium">
                                    Welcome back, {auth.user?.name} ({userRole === 'admin' ? 'Admin' : 'Employee'})
                                </span>
                            </div>
                            
                            <h1 className="text-4xl md:text-6xl font-bold mb-6">
                                <span className="bg-gradient-to-r from-white via-green-200 to-blue-200 bg-clip-text text-transparent">
                                    Sparking Asia
                                </span>
                                <br />
                                <span className="bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                                    Time Tracker
                                </span>
                            </h1>
                            
                            <p className="text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
                                {userRole === 'admin' 
                                    ? 'Monitor team productivity, track performance metrics, and manage your workforce effectively.'
                                    : 'Transform your productivity with intelligent time tracking and comprehensive personal analytics.'
                                }
                            </p>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-16">
                            {userRole === 'admin' ? (
                                <>
                                    <div className="group">
                                        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 hover:border-green-400/50 transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/20">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg">
                                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-white">{stats?.totalHours?.value || '0h'}</div>
                                                    <div className="text-sm text-white/60">{stats?.totalHours?.label || 'Total Hours'}</div>
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-semibold text-white mb-1">Total Hours</h3>
                                            <p className="text-sm text-white/60">Team worked today</p>
                                        </div>
                                    </div>

                                    <div className="group">
                                        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 hover:border-blue-400/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                    </svg>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-white">{stats?.activeEmployees?.value || '0'}</div>
                                                    <div className="text-sm text-white/60">{stats?.activeEmployees?.label || 'Employees'}</div>
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-semibold text-white mb-1">Employees</h3>
                                            <p className="text-sm text-white/60">Total team members</p>
                                        </div>
                                    </div>

                                    <div className="group">
                                        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 hover:border-purple-400/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
                                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                    </svg>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-white">{stats?.totalClients?.value || '0'}</div>
                                                    <div className="text-sm text-white/60">{stats?.totalClients?.label || 'Clients'}</div>
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-semibold text-white mb-1">Clients</h3>
                                            <p className="text-sm text-white/60">Total clients</p>
                                        </div>
                                    </div>

                                    <div className="group">
                                        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 hover:border-yellow-400/50 transition-all duration-300 hover:shadow-2xl hover:shadow-yellow-500/20">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg">
                                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-white">{stats?.teamEfficiency?.value || '0%'}</div>
                                                    <div className="text-sm text-white/60">{stats?.teamEfficiency?.label || 'Efficiency'}</div>
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-semibold text-white mb-1">Efficiency</h3>
                                            <p className="text-sm text-white/60">Team performance</p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="group">
                                        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 hover:border-green-400/50 transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/20">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg">
                                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-white">{stats?.weekHours?.value || '0h'}</div>
                                                    <div className="text-sm text-white/60">{stats?.weekHours?.label || 'This Week'}</div>
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-semibold text-white mb-1">Active Hours</h3>
                                            <p className="text-sm text-white/60">{stats?.weekHours?.changeLabel || 'No data yet'}</p>
                                        </div>
                                    </div>

                                    <div className="group">
                                        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 hover:border-blue-400/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                    </svg>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-white">{stats?.activeClients?.value || '0'}</div>
                                                    <div className="text-sm text-white/60">{stats?.activeClients?.label || 'Active'}</div>
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-semibold text-white mb-1">Clients</h3>
                                            <p className="text-sm text-white/60">{stats?.activeClients?.changeLabel || 'No clients yet'}</p>
                                        </div>
                                    </div>

                                    <div className="group">
                                        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 hover:border-purple-400/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
                                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                    </svg>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-white">{stats?.efficiency?.value || '0%'}</div>
                                                    <div className="text-sm text-white/60">{stats?.efficiency?.label || 'Efficiency'}</div>
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-semibold text-white mb-1">Performance</h3>
                                            <p className="text-sm text-white/60">{stats?.efficiency?.changeLabel || 'No data yet'}</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Analytics Section - Always show for better UX */}
                        <div className="mb-16">
                            {userRole === 'admin' ? (
                                <AdminAnalytics 
                                    analytics={analytics || {}} 
                                    employees={employees || []} 
                                />
                            ) : (
                                <EmployeeAnalytics 
                                    analytics={analytics || {}} 
                                    user={auth.user} 
                                />
                            )}
                        </div>

                        {/* Quick Actions - Floating Action Bar */}
                        <div className="mb-16">
                            <div className="max-w-4xl mx-auto">
                                <div className="bg-gradient-to-r from-white/10 via-white/5 to-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
                                    <h2 className="text-2xl font-bold text-white mb-6 text-center">Quick Actions</h2>
                                    <div className="flex flex-wrap justify-center gap-4">
                                        <Link href={route('work-hours.create')} className="group flex-1 min-w-[200px] max-w-[250px]">
                                            <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-md p-6 rounded-xl border border-green-400/30 hover:border-green-400/60 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/20 hover:scale-105">
                                                <div className="text-center">
                                                    <div className="p-4 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg mb-4 mx-auto w-fit">
                                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                        </svg>
                                                    </div>
                                                    <h3 className="text-lg font-semibold text-white mb-2">Start Tracking</h3>
                                                    <p className="text-sm text-white/70">Begin a new work session</p>
                                                </div>
                                            </div>
                                        </Link>

                                        {auth.user?.role === 'admin' && (
                                            <>
                                                <Link href={route('clients.create')} className="group flex-1 min-w-[200px] max-w-[250px]">
                                                    <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-md p-6 rounded-xl border border-blue-400/30 hover:border-blue-400/60 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 hover:scale-105">
                                                        <div className="text-center">
                                                            <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-4 mx-auto w-fit">
                                                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                                </svg>
                                                            </div>
                                                            <h3 className="text-lg font-semibold text-white mb-2">New Client</h3>
                                                            <p className="text-sm text-white/70">Create a client</p>
                                                        </div>
                                                    </div>
                                                </Link>

                                                <Link href={route('users.create')} className="group flex-1 min-w-[200px] max-w-[250px]">
                                                    <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-md p-6 rounded-xl border border-purple-400/30 hover:border-purple-400/60 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 hover:scale-105">
                                                        <div className="text-center">
                                                            <div className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg mb-4 mx-auto w-fit">
                                                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                                </svg>
                                                            </div>
                                                            <h3 className="text-lg font-semibold text-white mb-2">Add User</h3>
                                                            <p className="text-sm text-white/70">Manage users</p>
                                                        </div>
                                                    </div>
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Cards */}
                        <div className="max-w-6xl mx-auto">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-white mb-4">Management Hub</h2>
                                <p className="text-white/70 text-lg">Access all your productivity tools in one place</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <Link href={route('work-hours.index')} className="group">
                                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl p-8 rounded-2xl border border-white/10 hover:border-green-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-green-500/20 hover:scale-105 hover:-translate-y-2">
                                        <div className="text-center">
                                            ```
                                                                                        <div className="p-4 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg mb-6 mx-auto w-fit group-hover:shadow-green-500/50 transition-all duration-300"></div>
                                                                                        <h3 className="text-lg font-semibold text-white mb-2">Work Hours</h3>
                                                                                        <p className="text-sm text-white/70">View and manage your work sessions</p>
                                                                                    </div>
                                                                                </div>
                                                                            </Link>
                                                                            {/* Add other navigation cards here as needed */}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </AuthenticatedLayout>
                                                );
                                            }