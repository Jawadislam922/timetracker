import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { PortfolioFormInput } from '@/Components/portfolio/schema';

const themes = [
  { value: 'sparkingasia', label: 'SparkingAsia (Yellow & Green)', preview: 'bg-gradient-to-r from-yellow-400 to-green-500' },
  { value: 'lime', label: 'Fresh Lime (Bright Green)', preview: 'bg-gradient-to-r from-lime-400 to-green-600' },
  { value: 'emerald', label: 'Professional Emerald', preview: 'bg-gradient-to-r from-emerald-400 to-emerald-600' },
  { value: 'indigo', label: 'Corporate Indigo', preview: 'bg-gradient-to-r from-indigo-400 to-indigo-600' },
  { value: 'rose', label: 'Creative Rose', preview: 'bg-gradient-to-r from-rose-400 to-rose-600' },
  { value: 'amber', label: 'Warm Amber', preview: 'bg-gradient-to-r from-amber-400 to-amber-600' },
] as const;

export default function ThemeSection({ form }: { form: UseFormReturn<PortfolioFormInput> }) {
  const { register, watch } = form;
  const selectedTheme = watch('theme');
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center pb-6 border-b border-slate-100">
        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Portfolio Theme</h2>
        <p className="text-slate-600">Choose a color scheme that represents your brand</p>
      </div>

      <div className="space-y-6">
        <label className="block text-sm font-medium text-slate-700 mb-4">Select Theme Color</label>
        
        <div className="grid grid-cols-1 gap-4">
          {themes.map((theme) => (
            <label key={theme.value} className="relative cursor-pointer">
              <input
                {...register('theme')}
                type="radio"
                value={theme.value}
                className="sr-only"
              />
              <div className={`p-4 rounded-xl border-2 transition-all ${
                selectedTheme === theme.value 
                  ? 'border-blue-500 bg-blue-50 shadow-md' 
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}>
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-8 rounded-md ${theme.preview} shadow-sm`}></div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{theme.label}</div>
                    {theme.value === 'sparkingasia' && (
                      <div className="text-sm text-slate-500 mt-1">Recommended - Vibrant and modern</div>
                    )}
                  </div>
                  {selectedTheme === theme.value && (
                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-amber-800">Theme Recommendation</h3>
              <p className="text-sm text-amber-700 mt-1">
                The SparkingAsia theme uses a professional yellow and green color palette that conveys energy, growth, and innovation - perfect for showcasing your expertise.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
