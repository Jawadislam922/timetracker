import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { PortfolioFormInput } from '@/Components/portfolio/schema';
import { Input } from '@/Components/ui/input';
import { Briefcase, Info } from 'lucide-react';

export default function ContactSection({ form }: { form: UseFormReturn<PortfolioFormInput> }) {
  const { register, formState: { errors }, watch } = form;
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center pb-6 border-b border-slate-100">
        <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Briefcase className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Contact Information</h2>
        <p className="text-slate-600">Add your professional profile links</p>
      </div>

      {/* SparkingAsia Default Info */}
      <div className="bg-gradient-to-r from-yellow-50 to-green-50 border border-yellow-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-green-800 mb-2">Default SparkingAsia Contact Information</h3>
            <p className="text-sm text-green-700 mb-3">
              The following contact information will be displayed automatically on your portfolio:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-green-700">
              <div>📧 sparkingasia@gmail.com</div>
              <div>📱 +92 340 8989196</div>
              <div>🌐 www.sparkingasia.com</div>
              <div>📘 Facebook: sparkingasia</div>
              <div>📸 Instagram: sparkingasia</div>
              <div>💼 LinkedIn: sparkingasia</div>
              <div>🎵 TikTok: @sparkingasia</div>
              <div>🐦 Twitter: @sparking_asia</div>
              <div>📺 YouTube: @sparkingasia</div>
            </div>
          </div>
        </div>
      </div>

      {/* Upwork Profile Input */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Your Professional Profile</h3>
        <Input
          {...register('contact_json.upwork_profile')}
          label="Upwork Profile URL"
          placeholder="https://www.upwork.com/freelancers/~your-profile"
          type="url"
          icon={<Briefcase className="h-4 w-4" />}
          maxLength={500}
          showCharCount
          value={watch('contact_json.upwork_profile')}
          error={errors.contact_json?.upwork_profile?.message}
          helper="Add your Upwork profile to showcase your freelance work"
        />
      </div>
    </div>
  );
}
