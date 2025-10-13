import { z } from 'zod';

// Lean schema aligned with Editor.tsx usage
export const StatItemSchema = z.object({
  label: z.string().min(1, 'Label is required').max(50, 'Label must be 50 characters or less'),
  value: z.string().min(1, 'Value is required').max(30, 'Value must be 30 characters or less'),
});

export const ServiceItemSchema = z.object({
  title: z.string().min(1, 'Service title is required').max(100, 'Title must be 100 characters or less'),
  description: z.string().max(300, 'Description must be 300 characters or less').default(''),
});

export const EmploymentItemSchema = z.object({
  role: z.string().min(1, 'Role is required').max(100, 'Role must be 100 characters or less'),
  company: z.string().min(1, 'Company is required').max(100, 'Company must be 100 characters or less'),
  start: z.string().min(1, 'Start date is required').max(50, 'Start date must be 50 characters or less'),
  end: z.string().max(50, 'End date must be 50 characters or less').optional().or(z.literal('')),
  description: z.string().max(500, 'Description must be 500 characters or less').optional().or(z.literal('')),
});

export const SkillItemSchema = z.object({
  title: z.string().min(1, 'Skill group title is required').max(100, 'Title must be 100 characters or less'),
  items: z.array(z.string().min(1, 'Skill name is required').max(50, 'Skill name must be 50 characters or less')).default([]),
});

export const WhyItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  description: z.string().max(300, 'Description must be 300 characters or less').optional().or(z.literal('')),
});

export const ContactSchema = z.object({
  upwork_profile: z.string().url('Invalid Upwork profile URL').max(500, 'Upwork URL must be 500 characters or less').optional().or(z.literal('')),
});

export const PortfolioItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Project title is required').max(255, 'Title must be 255 characters or less').optional().or(z.literal('')),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional().or(z.literal('')),
  image_path: z.string().max(500, 'Image path too long').optional().or(z.literal('')),
  link: z.string().url('Invalid project URL').max(500, 'Link must be 500 characters or less').optional().or(z.literal('')),
  sort_order: z.number().int().nonnegative().default(0),
});

export const PortfolioFormSchema = z.object({
  slug: z.string().min(1, 'Portfolio URL slug is required').max(255, 'Slug must be 255 characters or less').regex(/^[a-z0-9\-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  name: z.string().min(1, 'Full name is required').max(255, 'Name must be 255 characters or less'),
  title: z.string().min(1, 'Professional title is required').max(255, 'Title must be 255 characters or less'),
  tagline: z.string().max(500, 'Tagline must be 500 characters or less').optional().or(z.literal('')),
  stats_json: z.array(StatItemSchema).default([]),
  profile_image_path: z.string().max(500, 'Image path too long').optional().or(z.literal('')),
  about: z.string().min(10, 'About section must be at least 10 characters').max(2000, 'About section must be 2000 characters or less').optional().or(z.literal('')),
  services_json: z.array(ServiceItemSchema).default([]),
  employment_json: z.array(EmploymentItemSchema).default([]),
  skills_json: z.array(SkillItemSchema).default([]),
  why_json: z.array(WhyItemSchema).default([]),
  contact_json: ContactSchema.default({}),
  theme: z.enum(['emerald','indigo','rose','amber','sparkingasia','lime']).default('emerald'),
  items: z.array(PortfolioItemSchema).default([]),
});

export type PortfolioFormData = z.infer<typeof PortfolioFormSchema>;
export type PortfolioFormInput = z.input<typeof PortfolioFormSchema>;

export const defaultPortfolioValues: Partial<PortfolioFormInput> = {
  slug: '',
  name: '',
  title: '',
  tagline: '',
  stats_json: [
    { label: 'Experience', value: '3+ years' },
    { label: 'Projects', value: '25+' },
  ],
  profile_image_path: '',
  about: '',
  services_json: [
    { title: 'Web Development', description: '' },
  ],
  employment_json: [],
  skills_json: [
    { title: 'Programming Languages', items: ['JavaScript', 'TypeScript', 'PHP'] },
    { title: 'Frameworks', items: ['React', 'Laravel', 'Node.js'] },
    { title: 'Tools', items: ['Git', 'Docker', 'VS Code'] },
  ],
  why_json: [
    { title: 'Reliable', description: 'I deliver on time.' },
  ],
  contact_json: {
    upwork_profile: '',
  },
  theme: 'sparkingasia',
  items: [],
};