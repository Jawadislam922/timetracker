import React from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { PortfolioFormInput } from '@/Components/portfolio/schema';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Textarea } from '@/Components/ui/textarea';
import { Briefcase, Type, FileText, Plus, Trash2 } from 'lucide-react';

export default function ServicesSection({ form }: { form: UseFormReturn<PortfolioFormInput> }) {
  const { control, register, formState: { errors }, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'services_json' });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center pb-6 border-b border-slate-100">
        <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Briefcase className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Services Offered</h2>
        <p className="text-slate-600">List the services you provide to clients</p>
      </div>

      <div className="space-y-6">
        {fields.map((field, idx) => (
          <div key={field.id} className="border border-slate-200 rounded-xl p-6 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                {...register(`services_json.${idx}.title` as const)}
                label="Service Title"
                placeholder="Web Development"
                icon={<Type className="h-4 w-4" />}
                required
                maxLength={100}
                showCharCount
                value={watch(`services_json.${idx}.title`) || ''}
                error={errors.services_json?.[idx]?.title?.message}
              />
              
              <Textarea
                {...register(`services_json.${idx}.description` as const)}
                label="Service Description"
                placeholder="Custom website development with modern technologies..."
                rows={3}
                maxLength={300}
                showCharCount
                value={watch(`services_json.${idx}.description`) || ''}
                error={errors.services_json?.[idx]?.description?.message}
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
                Remove Service
              </Button>
            </div>
          </div>
        ))}
        
        {fields.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
            <Briefcase className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No services added</h3>
            <p className="text-slate-600 mb-4">Add services you provide to potential clients</p>
          </div>
        )}
        
        <div className="flex justify-center">
          <Button 
            type="button" 
            onClick={() => append({ title: '', description: '' })}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Service
          </Button>
        </div>
      </div>
    </div>
  );
}
