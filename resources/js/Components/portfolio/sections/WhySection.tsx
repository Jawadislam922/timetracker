import React from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { PortfolioFormInput } from '@/Components/portfolio/schema';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Textarea } from '@/Components/ui/textarea';
import { Star, Type, FileText, Plus, Trash2 } from 'lucide-react';

export default function WhySection({ form }: { form: UseFormReturn<PortfolioFormInput> }) {
  const { control, register, formState: { errors }, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'why_json' });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center pb-6 border-b border-slate-100">
        <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Star className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Why Choose Me</h2>
        <p className="text-slate-600">Highlight what makes you stand out from the competition</p>
      </div>

      <div className="space-y-6">
        {fields.map((field, idx) => (
          <div key={field.id} className="border border-slate-200 rounded-xl p-6 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                {...register(`why_json.${idx}.title` as const)}
                label="Advantage Title"
                placeholder="Fast Delivery"
                icon={<Type className="h-4 w-4" />}
                required
                maxLength={100}
                showCharCount
                value={watch(`why_json.${idx}.title`) || ''}
                error={errors.why_json?.[idx]?.title?.message}
              />
              
              <Textarea
                {...register(`why_json.${idx}.description` as const)}
                label="Description"
                placeholder="I deliver projects on time without compromising on quality..."
                rows={3}
                maxLength={300}
                showCharCount
                value={watch(`why_json.${idx}.description`) || ''}
                error={errors.why_json?.[idx]?.description?.message}
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
                Remove Advantage
              </Button>
            </div>
          </div>
        ))}
        
        {fields.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
            <Star className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No advantages added</h3>
            <p className="text-slate-600 mb-4">Add reasons why clients should choose you</p>
          </div>
        )}
        
        <div className="flex justify-center">
          <Button 
            type="button" 
            onClick={() => append({ title: '', description: '' })}
            className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Advantage
          </Button>
        </div>
      </div>
    </div>
  );
}
