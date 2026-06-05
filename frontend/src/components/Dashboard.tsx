import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Plus, Search, FolderKanban, Settings, Loader2, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Project {
  id: string;
  name: string;
  description?: string;
  acronym: string;
  createdAt: string;
  userRole: string;
  memberCount: number;
}

interface DashboardProps {
  onSelectProject: (projectId: string, view: 'board' | 'settings') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectProject }) => {
  const { logout, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Create Project Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', acronym: '', description: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await api.projects.list();
      setProjects(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newProject.name.trim() || !newProject.acronym.trim()) {
      setFormError('Name and Acronym are required.');
      return;
    }

    if (newProject.acronym.trim().length > 10) {
      setFormError('Acronym must be 10 characters or less.');
      return;
    }

    setSubmitting(true);
    try {
      await api.projects.create(newProject);
      setNewProject({ name: '', acronym: '', description: '' });
      setIsModalOpen(false);
      fetchProjects();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.acronym.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'Administrator':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Manager':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/30 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <FolderKanban className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                ASYNCFLOW
              </span>
              <span className="text-[10px] block text-brand-400 font-semibold tracking-wider uppercase -mt-1">
                Project Hub
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
              <img 
                src={user?.avatarUrl} 
                alt={user?.name} 
                className="h-6 w-6 rounded-full ring-1 ring-slate-800" 
              />
              <span className="text-sm font-medium text-slate-300">{user?.name}</span>
            </div>
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg border border-slate-800 hover:border-rose-500/20 transition-all duration-200"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Your Projects</h1>
            <p className="text-sm text-slate-400 mt-1">Manage, search, and switch workspaces</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter by name or acronym..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 text-sm bg-slate-900/60 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all"
              />
            </div>

            {/* Create Project Trigger */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-brand-500/10 hover:shadow-brand-500/20 transition-all duration-200"
            >
              <Plus className="h-4.5 w-4.5" />
              New Project
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-brand-500 animate-spin" />
            <p className="text-slate-400 text-sm mt-4">Loading your workspace...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 rounded-2xl border border-dashed border-slate-800 bg-slate-900/10">
            <FolderKanban className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-200">No projects found</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              {search ? "No projects match your search criteria. Try a different query." : "You are not associated with any projects yet. Create one to get started!"}
            </p>
            {!search && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-semibold transition-all"
              >
                <Plus className="h-4 w-4" />
                Create your first project
              </button>
            )}
          </div>
        ) : (
          /* Projects Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div 
                key={project.id}
                className="group flex flex-col justify-between p-6 rounded-xl border border-slate-800 bg-slate-900/30 backdrop-blur-md hover:border-slate-700 hover:bg-slate-900/50 transition-all duration-300 relative overflow-hidden"
              >
                {/* Visual hover ambient glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-brand-600/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-brand-500/10 text-brand-400 border border-brand-500/20">
                      {project.acronym}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold tracking-wide rounded-md border ${getRoleBadgeStyle(project.userRole)}`}>
                      {project.userRole}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors duration-200 line-clamp-1">
                    {project.name}
                  </h3>
                  
                  <p className="text-sm text-slate-400 mt-2 line-clamp-2 min-h-[40px]">
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                <div className="border-t border-slate-800/80 pt-4 mt-6 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {project.memberCount} {project.memberCount === 1 ? 'member' : 'members'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectProject(project.id, 'settings')}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-transparent hover:border-slate-700 transition-all"
                      title="Project Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onSelectProject(project.id, 'board')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-all"
                    >
                      Kanban Board
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-2">Create New Project</h2>
            <p className="text-xs text-slate-400 mb-6">Initialize a new collaborative Agile workspace</p>

            {formError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mobile Application"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Project Acronym *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MOBILE (Max 10 chars)"
                  value={newProject.acronym}
                  onChange={(e) => setNewProject({ ...newProject, acronym: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Summarize the project scope..."
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setNewProject({ name: '', acronym: '', description: '' });
                    setFormError('');
                  }}
                  disabled={submitting}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm shadow-md transition-all"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
