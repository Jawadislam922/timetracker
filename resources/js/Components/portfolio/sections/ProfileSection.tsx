import React from 'react';
import ImageUploader from '@/Components/portfolio/ImageUploader';
import { UseFormReturn } from 'react-hook-form';
import { PortfolioFormInput } from '@/Components/portfolio/schema';
import { Input } from '@/Components/ui/input';
import { User, Tag, Briefcase, Zap } from 'lucide-react';

export default function ProfileSection({ form }: { form: UseFormReturn<PortfolioFormInput> }) {
  const { register, setValue, formState: { errors } } = form;
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center pb-6 border-b border-slate-100">
        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <User className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Profile Information</h2>
        <p className="text-slate-600">Tell visitors who you are and what you do</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Fields */}
        <div className="space-y-6">
          <Input
            {...register('slug')}
            label="Portfolio URL Slug"
            placeholder="your-name"
            helper="This will be your portfolio URL: /portfolio/your-name"
            error={errors.slug?.message}
            icon={<Tag className="h-4 w-4" />}
            required
            maxLength={255}
            showCharCount
            value={form.watch('slug')}
          />
          
          <Input
            {...register('name')}
            label="Full Name"
            placeholder="John Doe"
            error={errors.name?.message}
            icon={<User className="h-4 w-4" />}
            required
            maxLength={255}
            showCharCount
            value={form.watch('name')}
          />
          
          <Input
            {...register('title')}
            label="Professional Title"
            placeholder="Full Stack Developer"
            error={errors.title?.message}
            icon={<Briefcase className="h-4 w-4" />}
            required
            maxLength={255}
            showCharCount
            value={form.watch('title')}
          />
          
          <Input
            {...register('tagline')}
            label="Tagline"
            placeholder="I build fast, scalable web applications"
            helper="A short, catchy phrase that describes what you do"
            icon={<Zap className="h-4 w-4" />}
            maxLength={500}
            showCharCount
            value={form.watch('tagline')}
          />
        </div>

        {/* Profile Image */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Profile Photo</h3>
              <p className="text-sm text-slate-600">Upload a professional headshot</p>
            </div>
            <ImageUploader
              value={form.getValues('profile_image_path') || ''}
              circle
              label="Profile Photo"
              onChange={(path) => setValue('profile_image_path', path || '', { shouldDirty: true, shouldTouch: true })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
