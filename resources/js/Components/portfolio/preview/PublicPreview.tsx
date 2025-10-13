import React from 'react';
import { PortfolioFormInput } from '@/Components/portfolio/schema';

export default function PublicPreview({ data }: { data: PortfolioFormInput }) {
  const theme = data.theme || 'sparkingasia';
  const themeColors = {
    sparkingasia: {
      primary: 'text-yellow-700',
      bg: 'bg-gradient-to-br from-yellow-100 via-yellow-50 to-green-100',
      accent: 'bg-yellow-600',
      border: 'border-yellow-300',
      secondary: 'text-green-800',
      secondaryBg: 'bg-green-200',
      highlight: 'bg-gradient-to-r from-yellow-500 to-green-600',
      cardBg: 'bg-white',
      cardBorder: 'border-yellow-200',
      textStrong: 'text-gray-900'
    },
    lime: {
      primary: 'text-lime-700',
      bg: 'bg-gradient-to-br from-lime-100 via-lime-50 to-green-100',
      accent: 'bg-lime-600',
      border: 'border-lime-300',
      secondary: 'text-green-900',
      secondaryBg: 'bg-green-200',
      highlight: 'bg-gradient-to-r from-lime-500 to-green-600',
      cardBg: 'bg-white',
      cardBorder: 'border-lime-200',
      textStrong: 'text-gray-900'
    },
    emerald: {
      primary: 'text-emerald-600',
      bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50',
      accent: 'bg-emerald-600',
      border: 'border-emerald-200'
    },
    indigo: {
      primary: 'text-indigo-600',
      bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100/50',
      accent: 'bg-indigo-600',
      border: 'border-indigo-200'
    },
    rose: {
      primary: 'text-rose-600',
      bg: 'bg-gradient-to-br from-rose-50 to-rose-100/50',
      accent: 'bg-rose-600',
      border: 'border-rose-200'
    },
    amber: {
      primary: 'text-amber-600',
      bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50',
      accent: 'bg-amber-600',
      border: 'border-amber-200'
    },
  }[theme];

  return (
    <div className={`min-h-screen ${themeColors.bg}`}>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-transparent"></div>
        {/* Decorative elements for SparkingAsia theme */}
        {(theme === 'sparkingasia' || theme === 'lime') && (
          <>
            <div className="absolute top-10 right-10 w-32 h-32 bg-yellow-400/30 rounded-full blur-2xl"></div>
            <div className="absolute bottom-10 left-10 w-40 h-40 bg-green-400/30 rounded-full blur-2xl"></div>
            <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-yellow-300/20 rounded-full blur-xl"></div>
          </>
        )}
        <div className="relative px-8 py-12">
          <div className="max-w-4xl mx-auto text-center">
            {data.profile_image_path && (
              <div className="mb-6">
                <img 
                  src={data.profile_image_path.startsWith('/storage') ? data.profile_image_path : `/storage/${data.profile_image_path}`} 
                  alt="Profile" 
                  className={`w-24 h-24 rounded-full object-cover mx-auto shadow-xl border-4 ${
                    theme === 'sparkingasia' ? 'border-yellow-300' : 
                    theme === 'lime' ? 'border-lime-300' : 'border-white'
                  }`} 
                />
              </div>
            )}
            <h1 className={`text-5xl font-extrabold mb-4 ${
              theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-600 via-yellow-700 to-green-700 bg-clip-text text-transparent' :
              theme === 'lime' ? 'bg-gradient-to-r from-lime-600 via-lime-700 to-green-800 bg-clip-text text-transparent' :
              themeColors.primary
            }`}>
              {data.name || 'Your Name'}
            </h1>
            <p className={`text-2xl font-semibold mb-4 ${themeColors.secondary || 'text-slate-700'}`}>{data.title || 'Your Title'}</p>
            {data.tagline && (
              <p className="text-lg text-gray-700 max-w-2xl mx-auto font-medium">{data.tagline}</p>
            )}
            {/* Enhanced CTA buttons for yellow-green themes */}
            {(theme === 'sparkingasia' || theme === 'lime') && (
              <div className="mt-8 flex flex-wrap justify-center gap-6">
                <button className={`px-8 py-4 ${themeColors.highlight} text-white font-bold text-lg rounded-xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 hover:-translate-y-1`}>
                  🚀 Hire Me Now
                </button>
                <button className={`px-8 py-4 border-3 border-green-600 ${themeColors.secondary} bg-white hover:bg-green-50 font-bold text-lg rounded-xl transition-all transform hover:scale-105 shadow-lg`}>
                  📁 View Portfolio
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 pb-12">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Stats */}
          {(data.stats_json ?? []).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {(data.stats_json ?? []).map((s, i) => (
                <div key={i} className={`text-center p-8 ${themeColors.cardBg} rounded-2xl shadow-xl border-2 ${themeColors.cardBorder} hover:shadow-2xl transition-all transform hover:scale-110 hover:-translate-y-2 relative overflow-hidden`}>
                  {/* Background accent */}
                  <div className={`absolute top-0 left-0 w-full h-2 ${themeColors.highlight}`}></div>
                  <div className={`text-5xl font-black mb-4 ${
                    theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-600 to-green-600 bg-clip-text text-transparent' :
                    theme === 'lime' ? 'bg-gradient-to-r from-lime-600 to-green-700 bg-clip-text text-transparent' :
                    themeColors.primary
                  }`}>{s.value}</div>
                  <div className="text-gray-700 font-bold text-lg">{s.label}</div>
                  {/* Add accent dot for yellow-green themes */}
                  {(theme === 'sparkingasia' || theme === 'lime') && (
                    <div className={`w-4 h-4 ${themeColors.accent} rounded-full mx-auto mt-4 shadow-lg`}></div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* About */}
          {data.about && (
            <div className={`${themeColors.cardBg} rounded-2xl shadow-xl p-10 border-2 ${themeColors.cardBorder} relative overflow-hidden`}>
              {/* Decorative background pattern */}
              {(theme === 'sparkingasia' || theme === 'lime') && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-200/20 to-green-200/20 rounded-full -translate-y-16 translate-x-16"></div>
              )}
              <div className="relative">
                <h2 className={`text-4xl font-bold mb-6 ${
                  theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-700 to-green-700 bg-clip-text text-transparent' :
                  theme === 'lime' ? 'bg-gradient-to-r from-lime-700 to-green-800 bg-clip-text text-transparent' :
                  themeColors.primary
                }`}>About Me</h2>
                <div className="prose prose-lg max-w-none">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-line text-lg font-medium">{data.about}</p>
                </div>
              </div>
            </div>
          )}

          {/* Services */}
          {(data.services_json ?? []).length > 0 && (
            <div className={`${themeColors.cardBg} rounded-2xl shadow-xl p-10 border-2 ${themeColors.cardBorder}`}>
              <h2 className={`text-4xl font-bold mb-8 text-center ${
                theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-700 to-green-700 bg-clip-text text-transparent' :
                theme === 'lime' ? 'bg-gradient-to-r from-lime-700 to-green-800 bg-clip-text text-transparent' :
                themeColors.primary
              }`}>What I Offer</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {(data.services_json ?? []).map((s, i) => (
                  <div key={i} className={`p-6 rounded-xl border-2 ${themeColors.border} hover:shadow-lg transition-all transform hover:scale-105 bg-gradient-to-br ${
                    theme === 'sparkingasia' ? 'from-yellow-50 to-green-50' :
                    theme === 'lime' ? 'from-lime-50 to-green-50' :
                    'from-gray-50 to-gray-100'
                  }`}>
                    <div className="flex items-center mb-4">
                      <div className={`w-3 h-3 ${themeColors.accent} rounded-full mr-3`}></div>
                      <h3 className="font-bold text-xl text-gray-900">{s.title}</h3>
                    </div>
                    {s.description && <p className="text-gray-700 text-base font-medium">{s.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio Items */}
          {(data.items ?? []).length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className={`text-2xl font-bold mb-6 ${themeColors.primary}`}>Portfolio</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(data.items ?? []).map((it, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    {it.image_path && (
                      <img 
                        src={it.image_path.startsWith('/storage') ? it.image_path : `/storage/${it.image_path}`} 
                        alt={it.title} 
                        className="w-full h-48 object-cover" 
                      />
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-slate-900 mb-2">{it.title}</h3>
                      {it.description && <p className="text-slate-600 text-sm">{it.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className={`text-2xl font-bold mb-6 ${themeColors.primary}`}>Contact</h2>
            
            {/* SparkingAsia Default Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${themeColors.accent}`}></div>
                <span className="text-slate-700">Email: sparkingasia@gmail.com</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${themeColors.accent}`}></div>
                <span className="text-slate-700">Phone: +92 340 8989196</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${themeColors.accent}`}></div>
                <span className="text-slate-700">Website: www.sparkingasia.com</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${themeColors.accent}`}></div>
                <span className="text-slate-700">Location: Asia Pacific Region</span>
              </div>
            </div>

            {/* Custom Upwork Profile */}
            {data.contact_json?.upwork_profile && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Professional Profile</h3>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-slate-700">
                    Upwork: 
                    <a 
                      href={data.contact_json.upwork_profile} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-1 text-blue-600 hover:text-blue-800 underline"
                    >
                      View Profile
                    </a>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
