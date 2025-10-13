import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { PortfolioFormInput } from '@/Components/portfolio/schema';
import { Textarea } from '@/Components/ui/textarea';
import { FileText } from 'lucide-react';

export default function AboutSection({ form }: { form: UseFormReturn<PortfolioFormInput> }) {
  const { register, formState: { errors }, watch } = form;
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center pb-6 border-b border-slate-100">
        <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <FileText className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">About You</h2>
        <p className="text-slate-600">Share your story, background, and what makes you unique</p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Textarea
          {...register('about')}
          label="Your Story"
          placeholder="Tell visitors about your background, experience, and what drives you in your career. Share your passion for technology, notable achievements, or what makes you unique as a professional..."
          rows={8}
          error={errors.about?.message}
          helper="Write 2-4 paragraphs about yourself. This helps potential clients connect with you personally."
          required
          maxLength={2000}
          showCharCount
          value={watch('about')}
        />
        
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
          <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Writing Tips</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Start with your current role and expertise</li>
            <li>• Mention your years of experience</li>
            <li>• Highlight key technologies you work with</li>
            <li>• Include personal interests that humanize you</li>
            <li>• End with your goals or what you're passionate about</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
