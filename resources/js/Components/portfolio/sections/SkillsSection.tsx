import React from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { PortfolioFormInput } from '@/Components/portfolio/schema';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Code, Plus, Trash2, Tag } from 'lucide-react';

export default function SkillsSection({ form }: { form: UseFormReturn<PortfolioFormInput> }) {
  const { control, register, formState: { errors }, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'skills_json' });

  const addSkillToGroup = (groupIndex: number) => {
    const currentGroup = watch(`skills_json.${groupIndex}`);
    const currentItems = currentGroup?.items || [];
    form.setValue(`skills_json.${groupIndex}.items`, [...currentItems, '']);
  };

  const removeSkillFromGroup = (groupIndex: number, skillIndex: number) => {
    const currentGroup = watch(`skills_json.${groupIndex}`);
    const currentItems = currentGroup?.items || [];
    const newItems = currentItems.filter((_, index) => index !== skillIndex);
    form.setValue(`skills_json.${groupIndex}.items`, newItems);
  };

  const updateSkillInGroup = (groupIndex: number, skillIndex: number, value: string) => {
    const currentGroup = watch(`skills_json.${groupIndex}`);
    const currentItems = currentGroup?.items || [];
    const newItems = [...currentItems];
    newItems[skillIndex] = value;
    form.setValue(`skills_json.${groupIndex}.items`, newItems);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center pb-6 border-b border-slate-100">
        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Code className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Skills & Technologies</h2>
        <p className="text-slate-600">Organize your skills into categories for better presentation</p>
      </div>

      <div className="space-y-8">
        {fields.map((field, groupIdx) => (
          <div key={field.id} className="border border-slate-200 rounded-xl p-6 bg-slate-50">
            <div className="mb-6">
              <Input
                {...register(`skills_json.${groupIdx}.title` as const)}
                label="Skill Category"
                placeholder="Frontend Technologies"
                icon={<Tag className="h-4 w-4" />}
                required
                maxLength={100}
                showCharCount
                value={watch(`skills_json.${groupIdx}.title`) || ''}
                error={errors.skills_json?.[groupIdx]?.title?.message}
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">Skills in this category</label>
              {(watch(`skills_json.${groupIdx}.items`) || []).map((skill, skillIdx) => (
                <div key={skillIdx} className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="JavaScript"
                      value={skill}
                      onChange={(e) => updateSkillInGroup(groupIdx, skillIdx, e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      maxLength={50}
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => removeSkillFromGroup(groupIdx, skillIdx)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button 
                type="button" 
                variant="outline"
                onClick={() => addSkillToGroup(groupIdx)}
                className="w-full border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Skill
              </Button>
            </div>
            
            <div className="flex justify-end pt-6 border-t border-slate-200 mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => remove(groupIdx)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Category
              </Button>
            </div>
          </div>
        ))}
        
        {fields.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
            <Code className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No skill categories added</h3>
            <p className="text-slate-600 mb-4">Add skill categories to showcase your technical expertise</p>
          </div>
        )}
        
        <div className="flex justify-center">
          <Button 
            type="button" 
            onClick={() => append({ title: '', items: [] })}
            className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Skill Category
          </Button>
        </div>
      </div>
    </div>
  );
}
