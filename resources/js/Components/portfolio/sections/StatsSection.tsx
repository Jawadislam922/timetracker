import React from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { PortfolioFormInput } from '@/Components/portfolio/schema';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { BarChart3, Hash, Trophy, Plus, Trash2 } from 'lucide-react';

export default function StatsSection({ form }: { form: UseFormReturn<PortfolioFormInput> }) {
  const { control, register, formState: { errors }, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'stats_json' });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center pb-6 border-b border-slate-100">
        <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Key Statistics</h2>
        <p className="text-slate-600">Showcase impressive numbers and achievements</p>
      </div>

      <div className="space-y-6">
        {fields.map((field, idx) => (
          <div key={field.id} className="border border-slate-200 rounded-xl p-6 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                {...register(`stats_json.${idx}.label` as const)}
                label="Statistic Label"
                placeholder="Projects Completed"
                icon={<Hash className="h-4 w-4" />}
                required
                maxLength={50}
                showCharCount
                value={watch(`stats_json.${idx}.label`) || ''}
                error={errors.stats_json?.[idx]?.label?.message}
              />
              
              <Input
                {...register(`stats_json.${idx}.value` as const)}
                label="Value"
                placeholder="50+"
                icon={<Trophy className="h-4 w-4" />}
                required
                maxLength={30}
                showCharCount
                value={watch(`stats_json.${idx}.value`) || ''}
                error={errors.stats_json?.[idx]?.value?.message}
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
                Remove Stat
              </Button>
            </div>
          </div>
        ))}
        
        {fields.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
            <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No statistics added</h3>
            <p className="text-slate-600 mb-4">Add impressive numbers to showcase your achievements</p>
          </div>
        )}
        
        <div className="flex justify-center">
          <Button 
            type="button" 
            onClick={() => append({ label: '', value: '' })}
            className="bg-gradient-to-r from-teal-500 to-green-600 hover:from-teal-600 hover:to-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Statistic
          </Button>
        </div>
      </div>
    </div>
  );
}