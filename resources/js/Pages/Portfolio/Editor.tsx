import React, { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PortfolioFormSchema, PortfolioFormData, PortfolioFormInput, defaultPortfolioValues } from '@/Components/portfolio/schema';
import { Button } from '@/Components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { toast } from 'react-hot-toast';
import { Save, Eye, Globe, ArrowLeft, CheckCircle, Clock } from 'lucide-react';

// Form sections (we'll create these next)
import ProfileSection from '@/Components/portfolio/sections/ProfileSection';
import AboutSection from '@/Components/portfolio/sections/AboutSection';
import ServicesSection from '@/Components/portfolio/sections/ServicesSection';
import EmploymentSection from '@/Components/portfolio/sections/EmploymentSection';
import SkillsSection from '@/Components/portfolio/sections/SkillsSection';
import PortfolioItemsSection from '@/Components/portfolio/sections/PortfolioItemsSection';
import WhySection from '@/Components/portfolio/sections/WhySection';
import ContactSection from '@/Components/portfolio/sections/ContactSection';
import ThemeSection from '@/Components/portfolio/sections/ThemeSection';
import StatsSection from '@/Components/portfolio/sections/StatsSection';
import PublicPreview from '@/Components/portfolio/preview/PublicPreview';

interface Props {
  auth: {
    user: any;
  };
  portfolio?: any;
  defaultData?: any;
}

export default function Editor({ auth, portfolio, defaultData }: Props) {
  const [activeTab, setActiveTab] = useState('profile');
  const [showPreview, setShowPreview] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const form = useForm<PortfolioFormInput>({
    resolver: zodResolver(PortfolioFormSchema),
    defaultValues: portfolio ? {
      slug: portfolio.slug,
      name: portfolio.name,
      title: portfolio.title,
      tagline: portfolio.tagline || '',
      stats_json: portfolio.stats_json || defaultPortfolioValues.stats_json,
      profile_image_path: portfolio.profile_image_path || '',
      about: portfolio.about,
      services_json: portfolio.services_json || defaultPortfolioValues.services_json,
      employment_json: portfolio.employment_json || [],
      skills_json: portfolio.skills_json || defaultPortfolioValues.skills_json,
      why_json: portfolio.why_json || defaultPortfolioValues.why_json,
      contact_json: portfolio.contact_json || defaultPortfolioValues.contact_json,
      theme: portfolio.theme || 'emerald',
      items: portfolio.items?.map((item: any) => ({
        id: item.id.toString(),
        title: item.title,
        description: item.description || '',
        image_path: item.image_path || '',
        link: item.link || '',
        sort_order: item.sort_order || 0,
      })) || [],
    } : {
      ...defaultPortfolioValues,
      ...defaultData,
      name: auth.user.name || '',
      contact_json: {
        ...defaultPortfolioValues.contact_json,
        email: auth.user.email || '',
      },
    },
  });

  const watchedData = form.watch();

  // Default show preview on large screens
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(min-width: 1024px)');
      if (mq.matches) setShowPreview(true);
    }
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(`portfolio:draft:${auth.user.id}`, JSON.stringify(watchedData));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [watchedData, auth.user.id]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (!portfolio) {
      const draft = localStorage.getItem(`portfolio:draft:${auth.user.id}`);
      if (draft) {
        try {
          const draftData = JSON.parse(draft);
          form.reset(draftData);
        } catch (error) {
          console.error('Failed to load draft:', error);
        }
      }
    }
  }, [portfolio, form, auth.user.id]);

  const onSubmit = async (data: PortfolioFormInput, shouldPublish = false) => {
    console.log('onSubmit called with:', { data, shouldPublish });
    
    // Clean and validate data before submission
    const cleanData = {
      ...data,
      // Ensure about field has minimum content when publishing
      about: data.about && data.about.trim().length >= 10 
        ? data.about 
        : shouldPublish 
          ? 'This is a professional portfolio showcasing my skills and experience.' 
          : data.about || '',
      // Filter out items without titles or add default titles
      items: data.items?.filter(item => item.title && item.title.trim()).map(item => ({
        ...item,
        title: item.title?.trim() || 'Untitled Project'
      })) || []
    };
    
    console.log('Cleaned data:', cleanData);
    
    try {
      if (portfolio) {
        console.log('Updating existing portfolio:', portfolio.id);
        router.put(`/app/portfolio/${portfolio.id}`, { ...cleanData, is_draft: !shouldPublish }, {
          onSuccess: (page) => {
            console.log('Update success:', page);
            const message = shouldPublish ? 'Portfolio published successfully!' : 'Portfolio saved successfully!';
            toast.success(message);
            if (shouldPublish && page.props.publicUrl) {
              toast.success(`Share this link: ${page.props.publicUrl}`, { duration: 10000 });
            }
            localStorage.removeItem(`portfolio:draft:${auth.user.id}`);
          },
          onError: (errors) => {
            console.error('Update errors:', errors);
            alert('Update failed! Check console for errors.');
            Object.keys(errors).forEach(key => {
              form.setError(key as any, { message: errors[key] });
            });
            toast.error('Please fix the errors and try again.');
          }
        });
      } else {
        console.log('Creating new portfolio');
        alert('Creating new portfolio...');
        router.post('/app/portfolio', { ...cleanData, is_draft: !shouldPublish }, {
          onSuccess: (page) => {
            console.log('Create success:', page);
            const message = shouldPublish ? 'Portfolio created and published!' : 'Portfolio created successfully!';
            toast.success(message);
            if (shouldPublish && page.props.publicUrl) {
              toast.success(`Share this link: ${page.props.publicUrl}`, { duration: 10000 });
            }
            localStorage.removeItem(`portfolio:draft:${auth.user.id}`);
          },
          onError: (errors) => {
            console.error('Create errors:', errors);
            Object.keys(errors).forEach(key => {
              form.setError(key as any, { message: errors[key] });
            });
            toast.error('Please fix the errors and try again.');
          }
        });
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('Catch block error: ' + String(error));
      toast.error('An error occurred. Please try again.');
    }
  };

  const onFormSubmit = async (data: PortfolioFormInput) => {
    console.log('Form submitted normally');
    return onSubmit(data, false);
  };

  const handleSaveAndPublish = () => {
    console.log('handleSaveAndPublish called');
    
    form.handleSubmit(
      (data) => {
        console.log('Form validation passed! Data:', data);
        return onSubmit(data, true);
      },
      (errors) => {
        console.log('Form validation failed! Errors:', errors);
        console.log('Detailed errors:', JSON.stringify(errors, null, 2));
        toast.error('Please fix the form errors and try again.');
      }
    )();
  };

  const handlePublish = async () => {
    if (!portfolio) {
      // If no portfolio exists, save and publish directly
      return handleSaveAndPublish();
    }

    setIsPublishing(true);
    try {
      router.post(`/app/portfolio/${portfolio.id}/publish`, {}, {
        onSuccess: (page) => {
          toast.success('Portfolio published successfully!');
          if (page.props.publicUrl) {
            toast.success(`Share this link: ${page.props.publicUrl}`, { duration: 10000 });
          }
        },
        onError: (errors) => {
          toast.error(errors.slug || 'Failed to publish portfolio.');
        },
        onFinish: () => setIsPublishing(false)
      });
    } catch (error) {
      toast.error('An error occurred while publishing.');
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <Head title={portfolio ? 'Edit Portfolio' : 'Create Portfolio'} />
      
      {/* Debug indicator - remove in production */}
      <div className="fixed top-2 right-2 z-[100] bg-green-500 text-white text-xs px-2 py-1 rounded">
        New UI v2.0 ✓
      </div>
      
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.visit('/app/portfolio')}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Back to Portfolios</span>
              </button>
              <div className="w-px h-6 bg-slate-300"></div>
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Globe className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  {portfolio ? 'Edit Portfolio' : 'Create Portfolio'}
                </h1>
                <div className="flex items-center space-x-2 text-sm text-slate-500">
                  {portfolio && (
                    <>
                      <div className={`w-2 h-2 rounded-full ${portfolio.is_published ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <span>{portfolio.is_published ? 'Published' : 'Draft'}</span>
                      <span>•</span>
                    </>
                  )}
                  <span className="font-mono text-blue-600">/portfolio/{watchedData.slug || 'your-slug'}</span>
                  {form.formState.isDirty && (
                    <>
                      <span>•</span>
                      <div className="flex items-center space-x-1 text-amber-600">
                        <Clock className="h-3 w-3" />
                        <span>Unsaved changes</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Save Status Indicator */}
              <div className="hidden md:flex items-center space-x-2 text-sm">
                {form.formState.isSubmitting ? (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </div>
                ) : form.formState.isSubmitSuccessful ? (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Saved</span>
                  </div>
                ) : form.formState.isDirty ? (
                  <span className="text-amber-600">Unsaved changes</span>
                ) : (
                  <span className="text-slate-500">Up to date</span>
                )}
              </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="hidden lg:flex items-center gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </Button>
              <Button
                type="button"
                onClick={form.handleSubmit((data) => onSubmit(data, false))}
                disabled={form.formState.isSubmitting}
                variant="outline"
                className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {form.formState.isSubmitting ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button
                type="button"
                onClick={handleSaveAndPublish}
                disabled={form.formState.isSubmitting}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg disabled:opacity-50"
              >
                <Globe className="h-4 w-4" />
                {form.formState.isSubmitting ? 'Publishing...' : 'Save & Publish'}
              </Button>
              {portfolio?.is_published && (
                <Button
                  type="button"
                  onClick={() => window.open(`/portfolio/${portfolio.slug}`, '_blank')}
                  variant="ghost"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                >
                  <Eye className="h-4 w-4" />
                  View Live
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-120px)]">
          {/* Editor Panel */}
          <div className="flex flex-col">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 flex-1 overflow-hidden">
              <div className="h-full flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                  {/* Enhanced Tab Navigation */}
                  <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                    <TabsList className="grid w-full grid-cols-3 lg:grid-cols-10 h-auto p-1 bg-white shadow-sm border border-slate-200">
                      <TabsTrigger value="profile" className="text-xs py-2.5">Profile</TabsTrigger>
                      <TabsTrigger value="stats" className="text-xs py-2.5">Stats</TabsTrigger>
                      <TabsTrigger value="about" className="text-xs py-2.5">About</TabsTrigger>
                      <TabsTrigger value="services" className="text-xs py-2.5">Services</TabsTrigger>
                      <TabsTrigger value="employment" className="text-xs py-2.5 hidden lg:inline-flex">Work</TabsTrigger>
                      <TabsTrigger value="skills" className="text-xs py-2.5 hidden lg:inline-flex">Skills</TabsTrigger>
                      <TabsTrigger value="portfolio" className="text-xs py-2.5 hidden lg:inline-flex">Portfolio</TabsTrigger>
                      <TabsTrigger value="why" className="text-xs py-2.5 hidden lg:inline-flex">Why Me</TabsTrigger>
                      <TabsTrigger value="contact" className="text-xs py-2.5 hidden lg:inline-flex">Contact</TabsTrigger>
                      <TabsTrigger value="theme" className="text-xs py-2.5 hidden lg:inline-flex">Theme</TabsTrigger>
                    </TabsList>
                    
                    {/* Mobile Tab Overflow Menu */}
                    <div className="lg:hidden mt-3">
                      <select
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="stats">Statistics</option>
                        <option value="employment">Work Experience</option>
                        <option value="skills">Skills</option>
                        <option value="portfolio">Portfolio Items</option>
                        <option value="why">Why Choose Me</option>
                        <option value="contact">Contact Info</option>
                        <option value="theme">Theme Settings</option>
                      </select>
                    </div>
                  </div>

                  {/* Form Content */}
                  <div className="flex-1 overflow-y-auto">
                    <form onSubmit={form.handleSubmit(onFormSubmit)} className="p-6">
                      <TabsContent value="profile" className="mt-0">
                        <ProfileSection form={form} />
                      </TabsContent>

                      <TabsContent value="stats" className="mt-0">
                        <StatsSection form={form} />
                      </TabsContent>

                      <TabsContent value="about" className="mt-0">
                        <AboutSection form={form} />
                      </TabsContent>

                      <TabsContent value="services" className="mt-0">
                        <ServicesSection form={form} />
                      </TabsContent>

                      <TabsContent value="employment" className="mt-0">
                        <EmploymentSection form={form} />
                      </TabsContent>

                      <TabsContent value="skills" className="mt-0">
                        <SkillsSection form={form} />
                      </TabsContent>

                      <TabsContent value="portfolio" className="mt-0">
                        <PortfolioItemsSection form={form} />
                      </TabsContent>

                      <TabsContent value="why" className="mt-0">
                        <WhySection form={form} />
                      </TabsContent>

                      <TabsContent value="contact" className="mt-0">
                        <ContactSection form={form} />
                      </TabsContent>

                      <TabsContent value="theme" className="mt-0">
                        <ThemeSection form={form} />
                      </TabsContent>
                    </form>
                  </div>
                </Tabs>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className={`flex flex-col ${showPreview ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 flex-1 overflow-hidden">
              <div className="h-full flex flex-col">
                {/* Preview Header */}
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/30 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Live Preview</h3>
                      <p className="text-sm text-slate-600">See how your portfolio will look to visitors</p>
                    </div>
                    <div className="flex space-x-1">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    </div>
                  </div>
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white">
                  <div className="p-4">
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                      <PublicPreview data={watchedData} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Buttons for Mobile */}
      <div className="fixed bottom-6 right-6 lg:hidden z-40 flex flex-col gap-3">
        <Button
          type="button"
          onClick={handleSaveAndPublish}
          disabled={form.formState.isSubmitting}
          size="lg"
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-2xl disabled:opacity-50 rounded-full"
        >
          <Globe className="h-5 w-5" />
          {form.formState.isSubmitting ? 'Publishing...' : 'Publish'}
        </Button>
        <Button
          type="button"
          onClick={form.handleSubmit((data) => onSubmit(data, false))}
          disabled={form.formState.isSubmitting}
          size="lg"
          variant="outline"
          className="flex items-center gap-2 bg-white border-slate-300 text-slate-700 shadow-2xl disabled:opacity-50 rounded-full"
        >
          <Save className="h-5 w-5" />
          Draft
        </Button>
      </div>

      {/* Save Success Toast */}
      {form.formState.isSubmitSuccessful && (
        <div className="fixed bottom-6 left-6 z-40 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-left duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span>Portfolio saved successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
}