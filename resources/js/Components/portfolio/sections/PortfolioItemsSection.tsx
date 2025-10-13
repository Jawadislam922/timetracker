import React from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { PortfolioFormInput } from '@/Components/portfolio/schema';
import ImageUploader from '@/Components/portfolio/ImageUploader';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Textarea } from '@/Components/ui/textarea';
import { Folder, ExternalLink, Type, AlignLeft } from 'lucide-react';

export default function PortfolioItemsSection({ form }: { form: UseFormReturn<PortfolioFormInput> }) {
  const { control, register, setValue, formState: { errors }, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center pb-6 border-b border-slate-100">
        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Folder className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Portfolio Projects</h2>
        <p className="text-slate-600">Showcase your best work and achievements</p>
      </div>

      <div className="space-y-6">
        {fields.map((field, idx) => (
          <div key={field.id} className="border border-slate-200 rounded-xl p-6 bg-slate-50">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <ImageUploader
                  value={watch(`items.${idx}.image_path`) || ''}
                  onChange={(path) => setValue(`items.${idx}.image_path` as const, path || '')}
                  label="Project Image"
                />
              </div>
              <div className="lg:col-span-2 space-y-4">
                <Input
                  {...register(`items.${idx}.title` as const)}
                  label="Project Title"
                  placeholder="My Awesome Project"
                  icon={<Type className="h-4 w-4" />}
                  required
                  maxLength={255}
                  showCharCount
                  value={watch(`items.${idx}.title`) || ''}
                  error={errors.items?.[idx]?.title?.message}
                />
                
                <Input
                  {...register(`items.${idx}.link` as const)}
                  label="Project Link"
                  placeholder="https://myproject.com"
                  icon={<ExternalLink className="h-4 w-4" />}
                  type="url"
                  maxLength={500}
                  showCharCount
                  value={watch(`items.${idx}.link`) || ''}
                  error={errors.items?.[idx]?.link?.message}
                />
                
                <Textarea
                  {...register(`items.${idx}.description` as const)}
                  label="Project Description"
                  placeholder="Describe what this project does, technologies used, and key features..."
                  rows={3}
                  maxLength={1000}
                  showCharCount
                  value={watch(`items.${idx}.description`) || ''}
                  error={errors.items?.[idx]?.description?.message}
                />
                
                <div className="flex justify-end pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => remove(idx)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    Remove Project
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {fields.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
            <Folder className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No projects yet</h3>
            <p className="text-slate-600 mb-4">Add your first project to showcase your work</p>
          </div>
        )}
        
        <div className="flex justify-center">
          <Button 
            type="button" 
            onClick={() => append({ title: '', description: '', image_path: '', link: '', sort_order: fields.length })}
            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
          >
            Add New Project
          </Button>
        </div>
      </div>
    </div>
  );
}
