import React from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { PortfolioFormInput } from '@/Components/portfolio/schema';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Textarea } from '@/Components/ui/textarea';
import { Building2, User, Calendar, FileText, Plus, Trash2 } from 'lucide-react';

export default function EmploymentSection({ form }: { form: UseFormReturn<PortfolioFormInput> }) {
  const { control, register, formState: { errors }, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'employment_json' });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center pb-6 border-b border-slate-100">
        <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Work Experience</h2>
        <p className="text-slate-600">Share your professional background and achievements</p>
      </div>

      <div className="space-y-6">
        {fields.map((field, idx) => (
          <div key={field.id} className="border border-slate-200 rounded-xl p-6 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                {...register(`employment_json.${idx}.role` as const)}
                label="Job Title"
                placeholder="Senior Developer"
                icon={<User className="h-4 w-4" />}
                required
                maxLength={100}
                showCharCount
                value={watch(`employment_json.${idx}.role`) || ''}
                error={errors.employment_json?.[idx]?.role?.message}
              />
              
              <Input
                {...register(`employment_json.${idx}.company` as const)}
                label="Company Name"
                placeholder="Tech Company Inc."
                icon={<Building2 className="h-4 w-4" />}
                required
                maxLength={100}
                showCharCount
                value={watch(`employment_json.${idx}.company`) || ''}
                error={errors.employment_json?.[idx]?.company?.message}
              />
              
              <Input
                {...register(`employment_json.${idx}.start` as const)}
                label="Start Date"
                placeholder="Jan 2020"
                icon={<Calendar className="h-4 w-4" />}
                required
                maxLength={50}
                showCharCount
                value={watch(`employment_json.${idx}.start`) || ''}
                error={errors.employment_json?.[idx]?.start?.message}
              />
              
              <Input
                {...register(`employment_json.${idx}.end` as const)}
                label="End Date"
                placeholder="Present or Dec 2023"
                icon={<Calendar className="h-4 w-4" />}
                maxLength={50}
                showCharCount
                value={watch(`employment_json.${idx}.end`) || ''}
                error={errors.employment_json?.[idx]?.end?.message}
              />
            </div>
            
            <div className="mt-6">
              <Textarea
                {...register(`employment_json.${idx}.description` as const)}
                label="Job Description"
                placeholder="Describe your responsibilities, achievements, and key projects..."
                rows={3}
                maxLength={500}
                showCharCount
                value={watch(`employment_json.${idx}.description`) || ''}
                error={errors.employment_json?.[idx]?.description?.message}
              />
            </div>
            
            <div className="flex justify-end pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => remove(idx)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Position
              </Button>
            </div>
          </div>
        ))}
        
        {fields.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
            <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No work experience added</h3>
            <p className="text-slate-600 mb-4">Add your professional experience to showcase your career</p>
          </div>
        )}
        
        <div className="flex justify-center">
          <Button 
            type="button" 
            onClick={() => append({ role: '', company: '', start: '', end: '', description: '' })}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Work Experience
          </Button>
        </div>
      </div>
    </div>
  );
}
