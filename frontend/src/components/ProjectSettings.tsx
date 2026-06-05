import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { ArrowLeft, UserMinus, ShieldAlert, Loader2, Save, Trash2, UserPlus, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Participant {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  roleName: string;
  joinedAt: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  description?: string;
  acronym: string;
  createdAt: string;
  currentUserRole: string;
  participants: Participant[];
}

interface ProjectSettingsProps {
  projectId: string;
  onBack: () => void;
  onDeleteSuccess: () => void;
}

export const ProjectSettings: React.FC<ProjectSettingsProps> = ({ projectId, onBack, onDeleteSuccess }) => {
  const { user } = useAuth();
  
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState<'details' | 'team' | 'danger'>('details');

  // Metadata Form State (Admin only)
  const [metadata, setMetadata] = useState({ name: '', acronym: '', description: '' });
  const [savingMetadata, setSavingMetadata] = useState(false);

  // Invite Form State (Admin & Manager)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Normal');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Role Change / Action Loader State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchProjectDetails = async () => {
    setLoading(true);
    try {
      const data = await api.projects.get(projectId);
      setProject(data);
      setMetadata({
        name: data.name,
        acronym: data.acronym,
        description: data.description || ''
      });
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load project details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 text-brand-500 animate-spin" />
        <p className="text-slate-400 text-sm mt-4">Retrieving workspace settings...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="p-6 max-w-md bg-slate-900 border border-slate-800 rounded-xl text-center">
          <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white">Error Loading Project</h3>
          <p className="text-slate-400 text-sm mt-2">{error || "Project could not be found."}</p>
          <button 
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition-all"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const role = project.currentUserRole;
  const isAdmin = role === 'Administrator';
  const isManager = role === 'Manager';
  const canManageTeam = isAdmin || isManager;

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSuccess('');
    setError('');

    if (!metadata.name.trim() || !metadata.acronym.trim()) {
      setError('Project Name and Acronym are required.');
      return;
    }

    setSavingMetadata(true);
    try {
      await api.projects.update(projectId, metadata);
      setSuccess('Project metadata updated successfully.');
      // Update local acronym / name representation
      setProject({
        ...project,
        name: metadata.name.trim(),
        acronym: metadata.acronym.trim().toUpperCase(),
        description: metadata.description.trim()
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update metadata.');
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTeam) return;
    setInviteError('');
    setSuccess('');

    if (!inviteEmail.trim()) {
      setInviteError('Email is required.');
      return;
    }

    setInviting(true);
    try {
      await api.team.addParticipant(projectId, {
        email: inviteEmail.trim(),
        roleName: inviteRole
      });
      setInviteEmail('');
      setInviteRole('Normal');
      setSuccess('Participant added successfully.');
      fetchProjectDetails(); // Reload participant list
    } catch (err: any) {
      setInviteError(err.message || 'Failed to add participant.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveParticipant = async (targetUserId: string, targetName: string) => {
    if (!canManageTeam) return;
    if (!window.confirm(`Are you sure you want to remove ${targetName} from the project?`)) return;

    setSuccess('');
    setError('');
    setActionLoadingId(targetUserId);

    try {
      await api.team.removeParticipant(projectId, targetUserId);
      setSuccess(`${targetName} removed from the project.`);
      fetchProjectDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to remove participant.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleChangeRole = async (targetUserId: string, targetName: string, newRoleName: string) => {
    if (!isAdmin) return;
    
    setSuccess('');
    setError('');
    setActionLoadingId(targetUserId);

    try {
      await api.team.updateRole(projectId, targetUserId, newRoleName);
      setSuccess(`Updated role of ${targetName} to ${newRoleName}.`);
      fetchProjectDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to update role.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLeaveProject = async () => {
    const confirmMsg = isAdmin 
      ? "Are you sure you want to leave? If you are the last Administrator, you must promote another user first, or the project will be deleted."
      : "Are you sure you want to leave this project?";

    if (!window.confirm(confirmMsg)) return;

    setSuccess('');
    setError('');
    setLoading(true);

    try {
      await api.projects.leave(projectId);
      onDeleteSuccess(); // Treat leaving like project removal, redirecting to dashboard
    } catch (err: any) {
      setError(err.message || 'Failed to leave project.');
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!isAdmin) return;
    const confirmName = window.prompt(`CAUTION: This will permanently delete the project and all associated tasks/comments. To confirm, type the project acronym "${project.acronym}":`);
    
    if (confirmName !== project.acronym) {
      alert("Acronym mismatch. Project deletion cancelled.");
      return;
    }

    setSuccess('');
    setError('');
    setLoading(true);

    try {
      await api.projects.delete(projectId);
      onDeleteSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to delete project.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/30 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 rounded-lg transition-all"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>
            <div>
              <h1 className="text-md font-bold text-white">{project.name} Settings</h1>
              <span className="text-xs text-slate-500 uppercase font-semibold">{project.acronym}</span>
            </div>
          </div>

          <button
            onClick={handleLeaveProject}
            className="px-3 py-1.5 border border-slate-800 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg text-xs font-semibold transition-all"
          >
            Leave Project
          </button>
        </div>
      </header>

      {/* Main Form container */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full flex flex-col md:flex-row gap-8">
        {/* Sidebar tabs */}
        <aside className="w-full md:w-56 shrink-0 space-y-1">
          <button
            onClick={() => setActiveTab('details')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'details' ? 'bg-brand-600/10 text-brand-400 border border-brand-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
          >
            General Details
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'team' ? 'bg-brand-600/10 text-brand-400 border border-brand-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
          >
            Team Directory
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('danger')}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'danger' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'text-slate-400 hover:text-rose-400 hover:bg-slate-900'}`}
            >
              Danger Zone
            </button>
          )}
        </aside>

        {/* Content panel */}
        <div className="flex-1 rounded-xl bg-slate-900/20 border border-slate-800/80 p-6 md:p-8 backdrop-blur-md">
          {success && (
            <div className="p-3 mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              {success}
            </div>
          )}
          {error && (
            <div className="p-3 mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* TAB 1: General Details */}
          {activeTab === 'details' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Project Metadata</h2>
              <p className="text-xs text-slate-400 mb-6">
                {isAdmin ? "Update project name, key acronym, and details." : "General project descriptors (Read-only for your current role)."}
              </p>

              <form onSubmit={handleSaveMetadata} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={metadata.name}
                    onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 disabled:opacity-60 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Acronym Key (Sequential ID prefix)
                  </label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={metadata.acronym}
                    onChange={(e) => setMetadata({ ...metadata, acronym: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 disabled:opacity-60 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    disabled={!isAdmin}
                    value={metadata.description}
                    onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 disabled:opacity-60 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all resize-none"
                  />
                </div>

                {isAdmin && (
                  <div className="pt-4 border-t border-slate-800/65 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingMetadata}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm shadow-md transition-all"
                    >
                      {savingMetadata ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Changes
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* TAB 2: Team Directory */}
          {activeTab === 'team' && (
            <div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Project Members</h2>
                  <p className="text-xs text-slate-400 mt-1">Manage team access and role privileges</p>
                </div>
              </div>

              {/* Add Member section (Manager / Admin only) */}
              {canManageTeam && (
                <div className="p-4 mb-8 rounded-xl bg-slate-900/40 border border-slate-800/80">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-brand-400" />
                    Invite Team Member
                  </h3>

                  {inviteError && (
                    <div className="p-2 mb-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                      {inviteError}
                    </div>
                  )}

                  <form onSubmit={handleAddParticipant} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      required
                      placeholder="Enter user's email address..."
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-brand-500 transition-all"
                    />

                    {/* Managers cannot assign Administrator role */}
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-sm focus:outline-none focus:border-brand-500 transition-all"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Manager">Manager</option>
                      {isAdmin && <option value="Administrator">Administrator</option>}
                    </select>

                    <button
                      type="submit"
                      disabled={inviting}
                      className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      {inviting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Add Member
                    </button>
                  </form>
                </div>
              )}

              {/* Member List */}
              <div className="space-y-3">
                {project.participants.map((member) => (
                  <div 
                    key={member.userId}
                    className="flex items-center justify-between p-4 bg-slate-900/25 border border-slate-850 rounded-xl hover:border-slate-800 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={member.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${member.userId}`} 
                        alt={member.name}
                        className="h-10 w-10 rounded-full border border-slate-800" 
                      />
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          {member.name}
                          {member.userId === user?.id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              You
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Role representation or changer */}
                      {isAdmin && member.userId !== user?.id ? (
                        <select
                          disabled={actionLoadingId === member.userId}
                          value={member.roleName}
                          onChange={(e) => handleChangeRole(member.userId, member.name, e.target.value)}
                          className="px-2 py-1 bg-slate-950 border border-slate-850 hover:border-slate-700 rounded text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-all"
                        >
                          <option value="Normal">Normal</option>
                          <option value="Manager">Manager</option>
                          <option value="Administrator">Administrator</option>
                        </select>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-900 border border-slate-850 text-slate-400">
                          {member.roleName}
                        </span>
                      )}

                      {/* Remove button (conditional) */}
                      {canManageTeam && member.userId !== user?.id && (
                        // Manager cannot remove Admins or Managers
                        (!isManager || (member.roleName !== 'Administrator' && member.roleName !== 'Manager')) ? (
                          <button
                            disabled={actionLoadingId === member.userId}
                            onClick={() => handleRemoveParticipant(member.userId, member.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 border border-transparent hover:border-rose-500/10 rounded-lg transition-all"
                            title="Remove Member"
                          >
                            {actionLoadingId === member.userId ? (
                              <Loader2 className="h-4.5 w-4.5 animate-spin" />
                            ) : (
                              <UserMinus className="h-4.5 w-4.5" />
                            )}
                          </button>
                        ) : null
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Danger Zone (Admin only) */}
          {activeTab === 'danger' && isAdmin && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-rose-500 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Danger Zone Actions
                </h2>
                <p className="text-xs text-slate-400 mt-1">Irreversible and high-privilege configuration options</p>
              </div>

              <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="max-w-md">
                  <h4 className="text-sm font-bold text-slate-200">Delete Project</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Permanently delete this project, including its board status, task keys, files, and comment threads. This action is irreversible.
                  </p>
                </div>
                <button
                  onClick={handleDeleteProject}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-rose-500/10 transition-all flex items-center gap-2 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Project
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
