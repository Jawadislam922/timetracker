<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PortfolioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isDraft = $this->boolean('is_draft', false);
        
        $rules = [
            'slug' => [
                'required',
                'string',
                'max:255',
                'regex:/^[a-z0-9\-]+$/',
                Rule::unique('employee_portfolios', 'slug')->ignore($this->route('id'))
            ],
            'name' => 'required|string|max:255',
            'title' => 'required|string|max:255',
            'tagline' => 'nullable|string|max:500',
            'about' => 'nullable|string|max:2000',
            'profile_image_path' => 'nullable|string|max:500',
            'stats_json' => 'nullable|array',
            'stats_json.*.label' => 'required|string|max:50',
            'stats_json.*.value' => 'required|string|max:30',
            'services_json' => 'nullable|array',
            'services_json.*.title' => 'required|string|max:100',
            'services_json.*.description' => 'nullable|string|max:300',
            'employment_json' => 'nullable|array',
            'employment_json.*.role' => 'required|string|max:100',
            'employment_json.*.company' => 'required|string|max:100',
            'employment_json.*.start' => 'required|string|max:50',
            'employment_json.*.end' => 'nullable|string|max:50',
            'employment_json.*.description' => 'nullable|string|max:500',
            'skills_json' => 'nullable|array',
            'skills_json.*.title' => 'required|string|max:100',
            'skills_json.*.items' => 'nullable|array',
            'skills_json.*.items.*' => 'required|string|max:50',
            'why_json' => 'nullable|array',
            'why_json.*.title' => 'required|string|max:100',
            'why_json.*.description' => 'nullable|string|max:300',
            'contact_json' => 'nullable|array',
            'contact_json.upwork_profile' => 'nullable|url|max:500',
            'theme' => 'nullable|string|in:emerald,indigo,rose,amber,sparkingasia,lime',
            'items' => 'nullable|array',
            'items.*.title' => 'required|string|max:255',
            'items.*.description' => 'nullable|string|max:1000',
            'items.*.image_path' => 'nullable|string|max:500',
            'items.*.link' => 'nullable|url|max:500',
            'items.*.sort_order' => 'nullable|integer',
            'is_draft' => 'boolean',
        ];

        if (!$isDraft) {
            $rules['about'] = 'required|string|min:10|max:2000';
        } else {
            $rules['about'] = 'nullable|string|max:2000';
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'slug.required' => 'Portfolio URL slug is required.',
            'slug.regex' => 'Portfolio URL slug can only contain lowercase letters, numbers, and hyphens.',
            'slug.unique' => 'This portfolio URL is already taken. Please choose another.',
            'slug.max' => 'Portfolio URL slug must not exceed 255 characters.',
            'name.required' => 'Full name is required.',
            'name.max' => 'Full name must not exceed 255 characters.',
            'title.required' => 'Professional title is required.',
            'title.max' => 'Professional title must not exceed 255 characters.',
            'tagline.max' => 'Tagline must not exceed 500 characters.',
            'about.required' => 'About section is required when publishing your portfolio.',
            'about.min' => 'About section must be at least 10 characters long.',
            'about.max' => 'About section must not exceed 2,000 characters.',
            'stats_json.*.label.required' => 'Statistic label is required.',
            'stats_json.*.label.max' => 'Statistic label must not exceed 50 characters.',
            'stats_json.*.value.required' => 'Statistic value is required.',
            'stats_json.*.value.max' => 'Statistic value must not exceed 30 characters.',
            'services_json.*.title.required' => 'Service title is required.',
            'services_json.*.title.max' => 'Service title must not exceed 100 characters.',
            'services_json.*.description.max' => 'Service description must not exceed 300 characters.',
            'employment_json.*.role.required' => 'Job title is required.',
            'employment_json.*.role.max' => 'Job title must not exceed 100 characters.',
            'employment_json.*.company.required' => 'Company name is required.',
            'employment_json.*.company.max' => 'Company name must not exceed 100 characters.',
            'employment_json.*.start.required' => 'Start date is required.',
            'employment_json.*.start.max' => 'Start date must not exceed 50 characters.',
            'employment_json.*.end.max' => 'End date must not exceed 50 characters.',
            'employment_json.*.description.max' => 'Job description must not exceed 500 characters.',
            'skills_json.*.title.required' => 'Skill category title is required.',
            'skills_json.*.title.max' => 'Skill category title must not exceed 100 characters.',
            'skills_json.*.items.*.required' => 'Skill name is required.',
            'skills_json.*.items.*.max' => 'Skill name must not exceed 50 characters.',
            'why_json.*.title.required' => 'Advantage title is required.',
            'why_json.*.title.max' => 'Advantage title must not exceed 100 characters.',
            'why_json.*.description.max' => 'Advantage description must not exceed 300 characters.',
            'contact_json.upwork_profile.url' => 'Please enter a valid Upwork profile URL.',
            'contact_json.upwork_profile.max' => 'Upwork profile URL must not exceed 500 characters.',
            'items.*.title.required' => 'Project title is required.',
            'items.*.title.max' => 'Project title must not exceed 255 characters.',
            'items.*.description.max' => 'Project description must not exceed 1,000 characters.',
            'items.*.link.url' => 'Please enter a valid project URL.',
            'items.*.link.max' => 'Project URL must not exceed 500 characters.',
            'theme.in' => 'Please select a valid theme color.',
        ];
    }

    public function attributes(): array
    {
        return [
            'slug' => 'portfolio URL slug',
            'name' => 'full name',
            'title' => 'professional title',
            'tagline' => 'tagline',
            'about' => 'about section',
            'stats_json.*.label' => 'statistic label',
            'stats_json.*.value' => 'statistic value',
            'services_json.*.title' => 'service title',
            'services_json.*.description' => 'service description',
            'employment_json.*.role' => 'job title',
            'employment_json.*.company' => 'company name',
            'employment_json.*.start' => 'start date',
            'employment_json.*.end' => 'end date',
            'employment_json.*.description' => 'job description',
            'skills_json.*.title' => 'skill category title',
            'skills_json.*.items.*' => 'skill name',
            'why_json.*.title' => 'advantage title',
            'why_json.*.description' => 'advantage description',
            'contact_json.upwork_profile' => 'Upwork profile URL',
            'items.*.title' => 'project title',
            'items.*.description' => 'project description',
            'items.*.link' => 'project URL',
            'theme' => 'theme',
        ];
    }
}