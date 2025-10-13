import React from 'react';
import { Head } from '@inertiajs/react';
import { Mail, ExternalLink, MapPin, Calendar, Star, ArrowRight, Phone, Globe, Facebook, Instagram, Linkedin, Youtube, Twitter, MessageCircle, Briefcase, Clock } from 'lucide-react';

export default function Public({ portfolio, assetBase }) {
  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${assetBase}/${path}`;
  };

  const getThemeClasses = (theme) => {
    const themes = {
      sparkingasia: {
        primary: 'bg-gradient-to-r from-yellow-600 to-green-700 hover:from-yellow-700 hover:to-green-800',
        primaryOutline: 'border-2 border-yellow-600 text-green-800 hover:bg-yellow-50 font-bold',
        text: 'text-green-800',
        accent: 'bg-yellow-200',
        gradient: 'bg-gradient-to-br from-yellow-100 to-green-100',
        highlight: 'bg-yellow-600',
        secondary: 'text-yellow-700',
        cardBorder: 'ring-yellow-200',
        textGradient: 'bg-gradient-to-r from-yellow-700 to-green-800 bg-clip-text text-transparent'
      },
      lime: {
        primary: 'bg-gradient-to-r from-lime-600 to-green-700 hover:from-lime-700 hover:to-green-800',
        primaryOutline: 'border-2 border-lime-600 text-green-900 hover:bg-lime-50 font-bold',
        text: 'text-green-900',
        accent: 'bg-lime-200',
        gradient: 'bg-gradient-to-br from-lime-100 to-green-100',
        highlight: 'bg-lime-600',
        secondary: 'text-lime-700',
        cardBorder: 'ring-lime-200',
        textGradient: 'bg-gradient-to-r from-lime-700 to-green-900 bg-clip-text text-transparent'
      },
      emerald: {
        primary: 'bg-emerald-600 hover:bg-emerald-700',
        primaryOutline: 'border-emerald-600 text-emerald-700 hover:bg-emerald-50',
        text: 'text-emerald-700',
        accent: 'bg-emerald-50',
        gradient: 'bg-gradient-to-br from-emerald-100 to-emerald-50',
      },
      indigo: {
        primary: 'bg-indigo-600 hover:bg-indigo-700',
        primaryOutline: 'border-indigo-600 text-indigo-700 hover:bg-indigo-50',
        text: 'text-indigo-700',
        accent: 'bg-indigo-50',
        gradient: 'bg-gradient-to-br from-indigo-100 to-indigo-50',
      },
      rose: {
        primary: 'bg-rose-600 hover:bg-rose-700',
        primaryOutline: 'border-rose-600 text-rose-700 hover:bg-rose-50',
        text: 'text-rose-700',
        accent: 'bg-rose-50',
        gradient: 'bg-gradient-to-br from-rose-100 to-rose-50',
      },
      amber: {
        primary: 'bg-amber-600 hover:bg-amber-700',
        primaryOutline: 'border-amber-600 text-amber-700 hover:bg-amber-50',
        text: 'text-amber-700',
        accent: 'bg-amber-50',
        gradient: 'bg-gradient-to-br from-amber-100 to-amber-50',
      },
    };
    return themes[theme] || themes.sparkingasia;
  };

  const theme = getThemeClasses(portfolio.theme);
  const profileImage = getImageUrl(portfolio.profile_image_path);

  return (
    <div className={`min-h-screen ${portfolio.theme === 'sparkingasia' || portfolio.theme === 'lime' ? 'bg-gradient-to-br from-yellow-50 via-white to-green-50' : 'bg-gray-50'}`}>
      <Head title={`${portfolio.name} - ${portfolio.title}`} />

      {/* Header Section */}
      <header className={`${portfolio.theme === 'sparkingasia' || portfolio.theme === 'lime' ? 'bg-gradient-to-r from-white to-yellow-50/30' : 'bg-white'} border-b border-gray-200 relative overflow-hidden`}>
        {/* Decorative elements for yellow-green themes */}
        {(portfolio.theme === 'sparkingasia' || portfolio.theme === 'lime') && (
          <>
            <div className="absolute top-0 right-0 w-80 h-80 bg-yellow-300/20 rounded-full -translate-y-40 translate-x-40"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-300/20 rounded-full translate-y-32 -translate-x-32"></div>
            <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-yellow-400/15 rounded-full"></div>
          </>
        )}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
          <div className="text-center">
            {profileImage && (
              <div className="mb-6">
                <img
                  src={profileImage}
                  alt={portfolio.name}
                  className={`w-32 h-32 rounded-full mx-auto object-cover shadow-lg ${
                    portfolio.theme === 'sparkingasia' ? 'border-4 border-yellow-300' :
                    portfolio.theme === 'lime' ? 'border-4 border-lime-300' :
                    'border-4 border-white'
                  }`}
                />
              </div>
            )}
            <h1 className={`text-5xl font-black mb-4 ${
              portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-700 via-yellow-800 to-green-800 bg-clip-text text-transparent' :
              portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-700 via-lime-800 to-green-900 bg-clip-text text-transparent' :
              'text-gray-900'
            }`}>
              {portfolio.name}
            </h1>
            <p className={`text-2xl font-bold mb-6 ${theme.secondary || 'text-gray-600'}`}>
              {portfolio.title}
            </p>
            {portfolio.tagline && (
              <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto font-semibold">
                {portfolio.tagline}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-6">
              <button className={`px-8 py-4 text-white font-bold text-lg rounded-xl transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1 ${theme.primary}`}>
                🚀 Hire Me Now
              </button>
              <button className={`px-8 py-4 border-3 font-bold text-lg rounded-xl transition-all transform hover:scale-105 shadow-lg ${theme.primaryOutline}`}>
                📞 Get In Touch
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Section */}
      {portfolio.stats_json && Array.isArray(portfolio.stats_json) && portfolio.stats_json.length > 0 && (
        <section className={`py-16 ${(portfolio.theme === 'sparkingasia' || portfolio.theme === 'lime') ? 'bg-white' : 'bg-white'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {portfolio.stats_json.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className={`bg-white rounded-2xl shadow-xl ring-2 p-8 transition-all hover:shadow-2xl hover:scale-110 hover:-translate-y-3 relative overflow-hidden ${
                    portfolio.theme === 'sparkingasia' ? 'ring-yellow-200 hover:ring-yellow-300' :
                    portfolio.theme === 'lime' ? 'ring-lime-200 hover:ring-lime-300' :
                    'ring-gray-100'
                  }`}>
                    {/* Top accent bar */}
                    <div className={`absolute top-0 left-0 w-full h-3 ${
                      portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-500 to-green-600' :
                      portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-500 to-green-600' :
                      theme.highlight
                    }`}></div>
                    <div className={`text-5xl font-black mb-4 ${
                      portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-700 to-green-700 bg-clip-text text-transparent' :
                      portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-700 to-green-800 bg-clip-text text-transparent' :
                      theme.text
                    }`}>
                      {stat.value}
                    </div>
                    <div className="text-lg font-bold text-gray-800">{stat.label}</div>
                    {(portfolio.theme === 'sparkingasia' || portfolio.theme === 'lime') && (
                      <div className={`w-6 h-6 ${theme.highlight} rounded-full mx-auto mt-4 shadow-lg`}></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About Section */}
      <section id="about" className={`py-20 ${
        portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-br from-yellow-50/50 to-green-50/50' :
        portfolio.theme === 'lime' ? 'bg-gradient-to-br from-lime-50/50 to-green-50/50' :
        'bg-gray-50'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className={`text-4xl font-black mb-6 ${
              portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-700 to-green-800 bg-clip-text text-transparent' :
              portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-700 to-green-900 bg-clip-text text-transparent' :
              'text-gray-900'
            }`}>About Me</h2>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className={`bg-white rounded-3xl shadow-xl ring-2 p-12 relative overflow-hidden ${
              portfolio.theme === 'sparkingasia' ? 'ring-yellow-200' :
              portfolio.theme === 'lime' ? 'ring-lime-200' :
              'ring-gray-100'
            }`}>
              {/* Decorative background */}
              {(portfolio.theme === 'sparkingasia' || portfolio.theme === 'lime') && (
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-yellow-200/20 to-green-200/20 rounded-full -translate-y-20 translate-x-20"></div>
              )}
              <div className="relative prose prose-xl max-w-none text-gray-800">
                {(portfolio.about || '').split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-6 last:mb-0 text-lg leading-relaxed font-medium">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      {portfolio.services_json && Array.isArray(portfolio.services_json) && portfolio.services_json.length > 0 && (
        <section id="services" className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className={`text-4xl font-black mb-6 ${
                portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-700 to-green-800 bg-clip-text text-transparent' :
                portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-700 to-green-900 bg-clip-text text-transparent' :
                'text-gray-900'
              }`}>What I Offer</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {portfolio.services_json.map((service, index) => (
                <div key={index} className={`bg-white rounded-3xl shadow-xl ring-2 p-8 transition-all hover:shadow-2xl hover:scale-105 hover:-translate-y-2 relative overflow-hidden ${
                  portfolio.theme === 'sparkingasia' ? 'ring-yellow-200 hover:ring-yellow-300' :
                  portfolio.theme === 'lime' ? 'ring-lime-200 hover:ring-lime-300' :
                  'ring-gray-100'
                }`}>
                  {/* Top accent */}
                  <div className={`absolute top-0 left-0 w-full h-2 ${
                    portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-500 to-green-600' :
                    portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-500 to-green-600' :
                    'bg-gray-400'
                  }`}></div>
                  <div className="flex items-center mb-4">
                    <div className={`w-4 h-4 rounded-full mr-4 ${
                      portfolio.theme === 'sparkingasia' ? 'bg-yellow-500' :
                      portfolio.theme === 'lime' ? 'bg-lime-500' :
                      'bg-gray-400'
                    }`}></div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {service.title}
                    </h3>
                  </div>
                  {service.description && (
                    <p className="text-gray-700 text-lg font-medium leading-relaxed">{service.description}</p>
                  )}
                  <ul className="space-y-3 mt-6">
                    {(service.bullets || []).map((bullet, bulletIndex) => (
                      <li key={bulletIndex} className="flex items-start">
                        <ArrowRight className={`h-5 w-5 mr-3 mt-1 flex-shrink-0 ${theme.text}`} />
                        <span className="text-gray-700 font-medium">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Employment Section */}
      {portfolio.employment_json && Array.isArray(portfolio.employment_json) && portfolio.employment_json.length > 0 && (
        <section id="experience" className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Employment History</h2>
            </div>
            <div className="space-y-8">
              {portfolio.employment_json.map((job, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {job.role}
                      </h3>
                      <p className={`text-lg font-medium ${theme.text}`}>
                        {job.company}
                      </p>
                    </div>
                    <div className="flex items-center text-gray-500 mt-2 md:mt-0">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span className="text-sm">
                        {job.start} - {job.end || 'Present'}
                      </span>
                    </div>
                  </div>
                  {job.bullets && Array.isArray(job.bullets) && job.bullets.length > 0 && (
                    <ul className="space-y-2">
                      {job.bullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="flex items-start">
                          <ArrowRight className={`h-4 w-4 mr-2 mt-1 flex-shrink-0 ${theme.text}`} />
                          <span className="text-gray-600">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Skills Section */}
      {portfolio.skills_json && Array.isArray(portfolio.skills_json) && portfolio.skills_json.length > 0 && (
        <section id="skills" className={`py-16 ${(portfolio.theme === 'sparkingasia' || portfolio.theme === 'lime') ? 'bg-gradient-to-br from-yellow-50/30 to-green-50/30' : 'bg-white'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className={`text-3xl font-bold mb-4 ${
                portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-600 to-green-700 bg-clip-text text-transparent' :
                portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-600 to-green-800 bg-clip-text text-transparent' :
                'text-gray-900'
              }`}>Software Expertise</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {portfolio.skills_json.map((skillGroup, index) => (
                <div key={index} className={`bg-white rounded-2xl shadow-sm ring-1 p-6 transition-all hover:shadow-md hover:scale-105 ${
                  portfolio.theme === 'sparkingasia' ? 'ring-yellow-100 hover:ring-yellow-200' :
                  portfolio.theme === 'lime' ? 'ring-lime-100 hover:ring-lime-200' :
                  'ring-gray-100'
                }`}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {skillGroup.title}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(skillGroup.items || []).map((skill, skillIndex) => (
                      <span
                        key={skillIndex}
                        className={`px-3 py-1 text-sm font-medium rounded-full transition-all hover:scale-105 ${
                          portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-100 to-green-100 text-green-800' :
                          portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-100 to-green-100 text-green-900' :
                          `${theme.accent} ${theme.text}`
                        }`}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Portfolio Items Section */}
      {portfolio.items && Array.isArray(portfolio.items) && portfolio.items.length > 0 && (
        <section id="portfolio" className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Portfolio</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {portfolio.items.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
                  {item.image_path && (
                    <div className="aspect-w-16 aspect-h-9">
                      <img
                        src={getImageUrl(item.image_path)}
                        alt={item.title}
                        className="w-full h-48 object-cover"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-gray-600 mb-4">{item.description}</p>
                    )}
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center text-sm font-medium ${theme.text} hover:underline`}
                      >
                        View Project
                        <ExternalLink className="h-4 w-4 ml-1" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Why Choose Me Section */}
      {portfolio.why_json && Array.isArray(portfolio.why_json) && portfolio.why_json.length > 0 && (
        <section id="why" className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Me</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {portfolio.why_json.map((point, index) => (
                <div key={index} className="text-center">
                  <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6">
                    <div className={`w-12 h-12 rounded-full ${theme.accent} flex items-center justify-center mx-auto mb-4`}>
                      <Star className={`h-6 w-6 ${theme.text}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {point.title}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {point.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact Section */}
      <section id="contact" className={`py-20 ${
        portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-br from-gray-50 via-white to-yellow-50/30' :
        portfolio.theme === 'lime' ? 'bg-gradient-to-br from-gray-50 via-white to-lime-50/30' :
        'bg-gray-50'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className={`text-4xl font-bold mb-6 ${
              portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-gray-900 via-yellow-700 to-green-800 bg-clip-text text-transparent' :
              portfolio.theme === 'lime' ? 'bg-gradient-to-r from-gray-900 via-lime-700 to-green-800 bg-clip-text text-transparent' :
              'text-gray-900'
            }`}>Let's Work Together</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Ready to bring your vision to life? Get in touch to discuss your project requirements and how we can help you achieve your goals.
            </p>
          </div>

          {/* Main Contact Buttons */}
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            <a
              href="mailto:sparkingasia@gmail.com"
              className={`inline-flex items-center px-8 py-4 text-white font-bold text-lg rounded-xl transition-all hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1 ${
                portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-600 to-green-700 hover:from-yellow-700 hover:to-green-800' :
                portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-600 to-green-700 hover:from-lime-700 hover:to-green-800' :
                theme.primary
              }`}
            >
              <Mail className="h-6 w-6 mr-3" />
              📧 Email Me
            </a>
            
            <a
              href="https://wa.me/923408989196"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center px-8 py-4 text-white font-bold text-lg rounded-xl transition-all hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1 ${
                'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
              }`}
            >
              <MessageCircle className="h-6 w-6 mr-3" />
              � WhatsApp
            </a>

            {portfolio.contact_json?.upwork_profile && (
              <a
                href={portfolio.contact_json.upwork_profile}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center px-6 py-3 border-2 font-medium rounded-lg transition-colors ${
                  portfolio.theme === 'sparkingasia' ? 'border-yellow-600 text-green-800 hover:bg-yellow-50' :
                  portfolio.theme === 'lime' ? 'border-lime-600 text-green-900 hover:bg-lime-50' :
                  theme.primaryOutline
                }`}
              >
                💼 Upwork Profile
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            )}
          </div>

          {/* Social Media & Links Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 max-w-4xl mx-auto">
            <a
              href="https://www.sparkingasia.com/"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center p-6 bg-white rounded-2xl shadow-sm ring-1 transition-all hover:shadow-md hover:scale-105 ${
                portfolio.theme === 'sparkingasia' ? 'ring-yellow-100 hover:ring-yellow-200' :
                portfolio.theme === 'lime' ? 'ring-lime-100 hover:ring-lime-200' :
                'ring-gray-100'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                'bg-gradient-to-r from-blue-500 to-blue-600'
              }`}>
                <Globe className="h-6 w-6 text-white" />
              </div>
              <span className="font-medium text-gray-900">Website</span>
              <span className="text-sm text-gray-500 mt-1">sparkingasia.com</span>
            </a>

            <a
              href="https://www.facebook.com/sparkingasia/"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center p-6 bg-white rounded-2xl shadow-sm ring-1 transition-all hover:shadow-md hover:scale-105 ${
                portfolio.theme === 'sparkingasia' ? 'ring-yellow-100 hover:ring-yellow-200' :
                portfolio.theme === 'lime' ? 'ring-lime-100 hover:ring-lime-200' :
                'ring-gray-100'
              }`}
            >
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-3">
                <Facebook className="h-6 w-6 text-white" />
              </div>
              <span className="font-medium text-gray-900">Facebook</span>
              <span className="text-sm text-gray-500 mt-1">@sparkingasia</span>
            </a>

            <a
              href="https://www.instagram.com/sparkingasia/"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center p-6 bg-white rounded-2xl shadow-sm ring-1 transition-all hover:shadow-md hover:scale-105 ${
                portfolio.theme === 'sparkingasia' ? 'ring-yellow-100 hover:ring-yellow-200' :
                portfolio.theme === 'lime' ? 'ring-lime-100 hover:ring-lime-200' :
                'ring-gray-100'
              }`}
            >
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-3">
                <Instagram className="h-6 w-6 text-white" />
              </div>
              <span className="font-medium text-gray-900">Instagram</span>
              <span className="text-sm text-gray-500 mt-1">@sparkingasia</span>
            </a>

            <a
              href="https://pk.linkedin.com/company/sparkingasia"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center p-6 bg-white rounded-2xl shadow-sm ring-1 transition-all hover:shadow-md hover:scale-105 ${
                portfolio.theme === 'sparkingasia' ? 'ring-yellow-100 hover:ring-yellow-200' :
                portfolio.theme === 'lime' ? 'ring-lime-100 hover:ring-lime-200' :
                'ring-gray-100'
              }`}
            >
              <div className="w-12 h-12 bg-blue-700 rounded-full flex items-center justify-center mb-3">
                <Linkedin className="h-6 w-6 text-white" />
              </div>
              <span className="font-medium text-gray-900">LinkedIn</span>
              <span className="text-sm text-gray-500 mt-1">SparkingAsia</span>
            </a>

            <a
              href="https://www.youtube.com/@sparkingasia"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center p-6 bg-white rounded-2xl shadow-sm ring-1 transition-all hover:shadow-md hover:scale-105 ${
                portfolio.theme === 'sparkingasia' ? 'ring-yellow-100 hover:ring-yellow-200' :
                portfolio.theme === 'lime' ? 'ring-lime-100 hover:ring-lime-200' :
                'ring-gray-100'
              }`}
            >
              <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center mb-3">
                <Youtube className="h-6 w-6 text-white" />
              </div>
              <span className="font-medium text-gray-900">YouTube</span>
              <span className="text-sm text-gray-500 mt-1">@sparkingasia</span>
            </a>

            <a
              href="https://www.tiktok.com/@sparkingasia"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center p-6 bg-white rounded-2xl shadow-sm ring-1 transition-all hover:shadow-md hover:scale-105 ${
                portfolio.theme === 'sparkingasia' ? 'ring-yellow-100 hover:ring-yellow-200' :
                portfolio.theme === 'lime' ? 'ring-lime-100 hover:ring-lime-200' :
                'ring-gray-100'
              }`}
            >
              <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-3">
                <span className="text-white font-bold text-sm">TT</span>
              </div>
              <span className="font-medium text-gray-900">TikTok</span>
              <span className="text-sm text-gray-500 mt-1">@sparkingasia</span>
            </a>

            <a
              href="https://twitter.com/sparking_asia"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center p-6 bg-white rounded-2xl shadow-sm ring-1 transition-all hover:shadow-md hover:scale-105 ${
                portfolio.theme === 'sparkingasia' ? 'ring-yellow-100 hover:ring-yellow-200' :
                portfolio.theme === 'lime' ? 'ring-lime-100 hover:ring-lime-200' :
                'ring-gray-100'
              }`}
            >
              <div className="w-12 h-12 bg-sky-500 rounded-full flex items-center justify-center mb-3">
                <Twitter className="h-6 w-6 text-white" />
              </div>
              <span className="font-medium text-gray-900">Twitter</span>
              <span className="text-sm text-gray-500 mt-1">@sparking_asia</span>
            </a>
          </div>

          {/* Professional Contact Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Business Information Cards */}
            <div className="lg:col-span-2 space-y-8">
              {/* Contact Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email Card */}
                <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <div className={`p-3 rounded-lg ${
                      portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-100 to-green-100' :
                      portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-100 to-green-100' :
                      'bg-blue-100'
                    }`}>
                      <Mail className={`h-6 w-6 ${
                        portfolio.theme === 'sparkingasia' ? 'text-green-700' :
                        portfolio.theme === 'lime' ? 'text-green-700' :
                        'text-blue-600'
                      }`} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 ml-3">Email</h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">General Inquiries</p>
                  <a href="mailto:contact@sparkingasia.com" 
                     className={`font-medium transition-colors ${
                       portfolio.theme === 'sparkingasia' ? 'text-green-700 hover:text-green-800' :
                       portfolio.theme === 'lime' ? 'text-green-700 hover:text-green-800' :
                       'text-blue-600 hover:text-blue-700'
                     }`}>
                    contact@sparkingasia.com
                  </a>
                </div>

                {/* Phone Card */}
                <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <div className={`p-3 rounded-lg ${
                      portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-100 to-green-100' :
                      portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-100 to-green-100' :
                      'bg-blue-100'
                    }`}>
                      <Phone className={`h-6 w-6 ${
                        portfolio.theme === 'sparkingasia' ? 'text-green-700' :
                        portfolio.theme === 'lime' ? 'text-green-700' :
                        'text-blue-600'
                      }`} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 ml-3">Phone</h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">Direct Line</p>
                  <a href="tel:+923408989196" 
                     className={`font-medium transition-colors ${
                       portfolio.theme === 'sparkingasia' ? 'text-green-700 hover:text-green-800' :
                       portfolio.theme === 'lime' ? 'text-green-700 hover:text-green-800' :
                       'text-blue-600 hover:text-blue-700'
                     }`}>
                    +92 340 8989196
                  </a>
                </div>

                {/* Location Card */}
                <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <div className={`p-3 rounded-lg ${
                      portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-100 to-green-100' :
                      portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-100 to-green-100' :
                      'bg-blue-100'
                    }`}>
                      <MapPin className={`h-6 w-6 ${
                        portfolio.theme === 'sparkingasia' ? 'text-green-700' :
                        portfolio.theme === 'lime' ? 'text-green-700' :
                        'text-blue-600'
                      }`} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 ml-3">Location</h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">Service Area</p>
                  <p className="text-gray-800 font-medium">
                    Asia Pacific Region<br />
                    <span className="text-gray-600 font-normal">Remote Services Available</span>
                  </p>
                </div>

                {/* Website Card */}
                <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <div className={`p-3 rounded-lg ${
                      portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-100 to-green-100' :
                      portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-100 to-green-100' :
                      'bg-blue-100'
                    }`}>
                      <Globe className={`h-6 w-6 ${
                        portfolio.theme === 'sparkingasia' ? 'text-green-700' :
                        portfolio.theme === 'lime' ? 'text-green-700' :
                        'text-blue-600'
                      }`} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 ml-3">Website</h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">Company Portal</p>
                  <a href="https://sparkingasia.com" 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className={`font-medium transition-colors ${
                       portfolio.theme === 'sparkingasia' ? 'text-green-700 hover:text-green-800' :
                       portfolio.theme === 'lime' ? 'text-green-700 hover:text-green-800' :
                       'text-blue-600 hover:text-blue-700'
                     }`}>
                    www.sparkingasia.com
                  </a>
                </div>
              </div>

              {/* Business Hours Card */}
              <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
                <div className="flex items-center mb-6">
                  <div className={`p-3 rounded-lg ${
                    portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-100 to-green-100' :
                    portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-100 to-green-100' :
                    'bg-blue-100'
                  }`}>
                    <Clock className={`h-6 w-6 ${
                      portfolio.theme === 'sparkingasia' ? 'text-green-700' :
                      portfolio.theme === 'lime' ? 'text-green-700' :
                      'text-blue-600'
                    }`} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 ml-3">Business Hours</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Availability</h4>
                    <div className="space-y-2 text-gray-600">
                      <div className="flex justify-between">
                        <span>Monday - Friday</span>
                        <span className="font-medium">9:00 AM - 6:00 PM</span>
                      </div>
                      <p className="text-sm text-gray-500">Pakistan Standard Time (PKT)</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Response Time</h4>
                    <div className="space-y-2 text-gray-600">
                      <div className="flex justify-between">
                        <span>Email Inquiries</span>
                        <span className="font-medium">Within 24 hours</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Urgent Requests</span>
                        <span className="font-medium">Within 4 hours</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Project Collaboration Sidebar */}
            <div className="space-y-6">
              {/* Custom Upwork Profile */}
              {portfolio.contact_json?.upwork_profile && (
                <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
                  <div className="text-center">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                      portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-100 to-green-100' :
                      portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-100 to-green-100' :
                      'bg-blue-100'
                    }`}>
                      <Briefcase className={`h-8 w-8 ${
                        portfolio.theme === 'sparkingasia' ? 'text-green-700' :
                        portfolio.theme === 'lime' ? 'text-green-700' :
                        'text-blue-600'
                      }`} />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Work with {portfolio.name}</h3>
                    <p className="text-gray-600 mb-6">
                      Ready to start your project? Connect with me on Upwork for professional collaboration.
                    </p>
                    <a 
                      href={portfolio.contact_json.upwork_profile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center justify-center px-8 py-3 rounded-lg font-semibold text-white transition-all duration-300 transform hover:scale-105 ${
                        portfolio.theme === 'sparkingasia' 
                          ? 'bg-gradient-to-r from-yellow-600 to-green-700 hover:from-yellow-700 hover:to-green-800 shadow-lg hover:shadow-xl' 
                          : portfolio.theme === 'lime'
                          ? 'bg-gradient-to-r from-lime-600 to-green-700 hover:from-lime-700 hover:to-green-800 shadow-lg hover:shadow-xl'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <Briefcase className="h-5 w-5 mr-2" />
                      Hire on Upwork
                    </a>
                  </div>
                </div>
              )}

              {/* Professional Services Card */}
              <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Our Services</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-3 ${
                      portfolio.theme === 'sparkingasia' ? 'bg-green-600' :
                      portfolio.theme === 'lime' ? 'bg-green-600' :
                      'bg-blue-600'
                    }`}></div>
                    <span className="text-gray-700">Web Development & Design</span>
                  </div>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-3 ${
                      portfolio.theme === 'sparkingasia' ? 'bg-green-600' :
                      portfolio.theme === 'lime' ? 'bg-green-600' :
                      'bg-blue-600'
                    }`}></div>
                    <span className="text-gray-700">Digital Marketing Solutions</span>
                  </div>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-3 ${
                      portfolio.theme === 'sparkingasia' ? 'bg-green-600' :
                      portfolio.theme === 'lime' ? 'bg-green-600' :
                      'bg-blue-600'
                    }`}></div>
                    <span className="text-gray-700">Virtual Assistant Services</span>
                  </div>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-3 ${
                      portfolio.theme === 'sparkingasia' ? 'bg-green-600' :
                      portfolio.theme === 'lime' ? 'bg-green-600' :
                      'bg-blue-600'
                    }`}></div>
                    <span className="text-gray-700">Content Creation & Strategy</span>
                  </div>
                </div>
              </div>

              {/* Professional Guarantee */}
              <div className={`rounded-xl p-6 ${
                portfolio.theme === 'sparkingasia' ? 'bg-gradient-to-r from-yellow-50 to-green-50 border border-yellow-200' :
                portfolio.theme === 'lime' ? 'bg-gradient-to-r from-lime-50 to-green-50 border border-lime-200' :
                'bg-blue-50 border border-blue-200'
              }`}>
                <h4 className={`font-semibold mb-2 ${
                  portfolio.theme === 'sparkingasia' ? 'text-green-800' :
                  portfolio.theme === 'lime' ? 'text-green-800' :
                  'text-blue-800'
                }`}>Quality Assurance</h4>
                <p className="text-gray-700 text-sm">
                  We guarantee professional service delivery, timely communication, and exceptional results for every project.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © {new Date().getFullYear()} {portfolio.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}