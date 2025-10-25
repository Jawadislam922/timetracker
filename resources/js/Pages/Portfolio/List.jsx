import React from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PrimaryButton from '@/Components/PrimaryButton';
import { Eye, Edit, Globe, Copy } from 'lucide-react';

export default function List({ auth, portfolios }) {
  const handleCopyUrl = (slug) => {
    const url = `${window.location.origin}/portfolio/${slug}`;
    navigator.clipboard.writeText(url);
    // You could add a toast notification here
    alert('URL copied to clipboard!');
  };

  return (
    <AuthenticatedLayout user={auth.user}>
      <Head title="My Portfolios" />

      <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen">
        <div className="px-6 lg:px-12 xl:px-16 py-8 space-y-8">
          {/* Header Card with Gradient Icon */}
          <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl shadow-lg">
                  <Globe className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">My Portfolios</h2>
                  <p className="text-slate-600 mt-1">Manage your public portfolio pages</p>
                </div>
              </div>
              <Link href="/app/portfolio/new">
                <button className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg shadow-sm font-medium transition-all duration-200 hover:shadow-md">
                  Create New Portfolio
                </button>
              </Link>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            {portfolios.length === 0 ? (
              <div className="text-center py-20 px-6">
                <Globe className="mx-auto h-16 w-16 text-slate-400 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900">No portfolios yet</h3>
                <p className="mt-2 text-slate-600 max-w-sm mx-auto">
                  Get started by creating your first portfolio page to showcase your work.
                </p>
                <div className="mt-8">
                  <Link href="/app/portfolio/new">
                    <button className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg shadow-sm font-medium transition-all duration-200 hover:shadow-md">
                      Create Portfolio
                    </button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr className="bg-gradient-to-r from-orange-500 to-amber-500">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Portfolio
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Updated
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {portfolios.map((portfolio) => (
                      <tr key={portfolio.id} className="hover:bg-slate-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {portfolio.name}
                            </div>
                            <div className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                              <Globe className="w-3 h-3" />
                              /portfolio/{portfolio.slug}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            portfolio.is_published 
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                            {portfolio.is_published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                          {portfolio.items_count} items
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {new Date(portfolio.updated_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {portfolio.is_published && (
                              <>
                                <a
                                  href={`/portfolio/${portfolio.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-all duration-200 hover:shadow-md"
                                  title="View Public Page"
                                >
                                  <Eye className="h-4 w-4" />
                                </a>
                                <button
                                  onClick={() => handleCopyUrl(portfolio.slug)}
                                  className="bg-slate-600 hover:bg-slate-700 text-white p-2 rounded-lg transition-all duration-200 hover:shadow-md"
                                  title="Copy URL"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <Link
                              href={`/app/portfolio/${portfolio.id}/edit`}
                              className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded-lg transition-all duration-200 hover:shadow-md"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}