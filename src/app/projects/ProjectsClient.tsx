'use client';

import { useState } from "react";
import Link from "next/link";
import { ProjectListItem } from "@/types";
import EmptyState from "@/components/shared/EmptyState";

interface ProjectsClientProps {
  projects: ProjectListItem[];
}

export function ProjectsClient({ projects }: ProjectsClientProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        }),
      });

      if (response.ok) {
        const project = await response.json();
        window.location.href = `/projects`;
      } else {
        console.error('Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <EmptyState
          title="No projects yet"
          description="Create your first project to start managing background tasks"
        />
        <button
          onClick={() => setShowCreateForm(true)}
          className="mt-6 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Create Project
        </button>

        {/* Create project modal/form */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">Create New Project</h3>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="My TaskPulse Project"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-400 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="Brief description of your project"
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormData({ name: '', description: '' });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !formData.name.trim()}
                    className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    {isCreating ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Create project button */}
      <div className="mb-6">
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Create Project
        </button>
      </div>

      {/* Projects grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/${project.slug}`}
            className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:bg-gray-800/50 transition-colors group"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-100 group-hover:text-violet-400 transition-colors">
                {project.name}
              </h3>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-violet-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {project.description && (
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                {project.description}
              </p>
            )}

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-100">{project.memberCount}</div>
                <div className="text-xs text-gray-400">Members</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-100">{project.taskCount}</div>
                <div className="text-xs text-gray-400">Tasks</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-100">{project.recentRunCount}</div>
                <div className="text-xs text-gray-400">Runs</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <span className="text-xs text-gray-500">Updated {formatTimeAgo(project.updatedAt)}</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                <span className="text-xs text-gray-400">Active</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Create project modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Create New Project</h3>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="My TaskPulse Project"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-400 mb-1">
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="Brief description of your project"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({ name: '', description: '' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !formData.name.trim()}
                  className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}