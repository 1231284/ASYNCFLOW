import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { ArrowLeft, Search, Plus, Loader2, AlertCircle, ArrowUpCircle, AlertTriangle, ArrowDownCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserDTO {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface Issue {
  id: string;
  sequentialKey: string;
  summary: string;
  description?: string;
  projectId: string;
  issueTypeId: number;
  issueType: string;
  priorityId: number;
  priority: string;
  statusId: number;
  status: string;
  reporter: UserDTO;
  assignee?: UserDTO;
  createdAt: string;
  updatedAt: string;
}

interface Participant {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface KanbanBoardProps {
  projectId: string;
  onBack: () => void;
  onSelectIssue: (issueId: string) => void;
  refreshTrigger: number; // Increment this to trigger reload from outside (e.g. after comments or edits in drawer)
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId, onBack, onSelectIssue, refreshTrigger }) => {
  useAuth();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [projectAcronym, setProjectAcronym] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [onlyMyIssues, setOnlyMyIssues] = useState(false);

  // Issue Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newIssue, setNewIssue] = useState({
    summary: '',
    description: '',
    issueTypeId: 1, // Default to Task
    priorityId: 2,   // Default to Medium
    assigneeId: ''   // Default to Unassigned
  });
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [createError, setCreateError] = useState('');

  // Drag state
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);

  // Debouncing Search Input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  // Load Board Data
  const loadBoardData = async () => {
    setLoading(true);
    try {
      // Fetch project metadata to get participants and acronym
      const proj = await api.projects.get(projectId);
      setParticipants(proj.participants);
      setProjectAcronym(proj.acronym);

      // Fetch filtered issues
      const issuesList = await api.issues.list(projectId, debouncedSearch, onlyMyIssues);
      setIssues(issuesList);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch board data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoardData();
  }, [projectId, debouncedSearch, onlyMyIssues, refreshTrigger]);

  // Create Issue handler
  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssue.summary.trim()) {
      setCreateError('Issue summary is required.');
      return;
    }

    setSubmittingIssue(true);
    setCreateError('');

    try {
      await api.issues.create(projectId, {
        summary: newIssue.summary.trim(),
        description: newIssue.description.trim() || null,
        issueTypeId: Number(newIssue.issueTypeId),
        priorityId: Number(newIssue.priorityId),
        statusId: 1, // Always default to To Do (Id = 1)
        assigneeId: newIssue.assigneeId || null
      });

      setIsCreateOpen(false);
      setNewIssue({
        summary: '',
        description: '',
        issueTypeId: 1,
        priorityId: 2,
        assigneeId: ''
      });
      loadBoardData(); // Reload board
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create issue.');
    } finally {
      setSubmittingIssue(false);
    }
  };

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    e.dataTransfer.setData('text/plain', issueId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, columnId: number) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatusId: number) => {
    e.preventDefault();
    setDragOverColumn(null);

    const issueId = e.dataTransfer.getData('text/plain');
    if (!issueId) return;

    // Find issue and update state locally first (Optimistic update)
    const draggedIssue = issues.find(i => i.id === issueId);
    if (!draggedIssue || draggedIssue.statusId === targetStatusId) return;

    const previousStatusId = draggedIssue.statusId;
    
    // Perform optimistic UI state modification
    setIssues(prevIssues => 
      prevIssues.map(i => 
        i.id === issueId 
          ? { ...i, statusId: targetStatusId, status: targetStatusId === 1 ? 'To Do' : targetStatusId === 2 ? 'In Progress' : 'Done' }
          : i
      )
    );

    try {
      // Update asynchronously on the backend
      await api.issues.updateStatus(issueId, targetStatusId);
    } catch (err: any) {
      console.error("Failed to transition issue status on server:", err);
      // Revert back on error
      setIssues(prevIssues => 
        prevIssues.map(i => 
          i.id === issueId 
            ? { ...i, statusId: previousStatusId, status: previousStatusId === 1 ? 'To Do' : previousStatusId === 2 ? 'In Progress' : 'Done' }
            : i
        )
      );
      alert(err.message || "Failed to update issue status. Rolled back transition.");
    }
  };

  const getPriorityIcon = (priorityId: number) => {
    switch (priorityId) {
      case 4: // Critical
        return <span title="Critical Priority"><AlertCircle className="h-3.5 w-3.5 text-rose-500 fill-rose-500/10" /></span>;
      case 3: // High
        return <span title="High Priority"><ArrowUpCircle className="h-3.5 w-3.5 text-orange-500" /></span>;
      case 2: // Medium
        return <span title="Medium Priority"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /></span>;
      default: // Low
        return <span title="Low Priority"><ArrowDownCircle className="h-3.5 w-3.5 text-slate-500" /></span>;
    }
  };

  const getIssueTypeBadge = (issueType: string) => {
    switch (issueType) {
      case 'Bug':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Story':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default: // Task
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    }
  };

  // Categorize issues
  const columns = [
    { id: 1, title: 'To Do', color: 'border-slate-800' },
    { id: 2, title: 'In Progress', color: 'border-brand-500/30' },
    { id: 3, title: 'Done', color: 'border-emerald-500/30' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/30 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 rounded-lg transition-all"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>
            <div>
              <span className="text-[10px] block text-brand-400 font-bold tracking-wider uppercase">
                Project Board
              </span>
              <h1 className="text-sm font-extrabold text-white leading-tight -mt-0.5">
                {projectAcronym ? `[${projectAcronym}] Kanban Board` : 'Kanban Board'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* My Issues toggle switch */}
            <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900/60 transition-all select-none">
              <input 
                type="checkbox" 
                checked={onlyMyIssues}
                onChange={(e) => setOnlyMyIssues(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-7 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-brand-600 peer-checked:after:bg-white relative"></div>
              <span className="text-xs font-semibold text-slate-300">Only My Issues</span>
            </label>

            {/* Create Issue Trigger */}
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
            >
              <Plus className="h-4 w-4" />
              Create Issue
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar / Search */}
      <section className="bg-slate-900/10 border-b border-slate-800/40 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search issues by summary or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800/80 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-brand-500/80 transition-all"
            />
          </div>
        </div>
      </section>

      {/* Board Columns container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex flex-col md:flex-row gap-6 overflow-hidden">
        {error && (
          <div className="w-full p-4 mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm h-fit">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24">
            <Loader2 className="h-10 w-10 text-brand-500 animate-spin" />
            <p className="text-slate-400 text-sm mt-4">Syncing board cards...</p>
          </div>
        ) : (
          columns.map((column) => {
            const columnIssues = issues.filter(i => i.statusId === column.id);

            return (
              <div 
                key={column.id}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleDragEnter(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`flex-1 flex flex-col rounded-xl border border-slate-850/80 bg-slate-900/10 p-4 min-h-[450px] transition-all duration-200 ${dragOverColumn === column.id ? 'drag-over' : ''}`}
              >
                {/* Column Title */}
                <div className={`border-l-2 ${column.color} pl-2 flex items-center justify-between mb-4`}>
                  <h3 className="text-sm font-bold text-slate-200">{column.title}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-slate-500 border border-slate-800">
                    {columnIssues.length}
                  </span>
                </div>

                {/* Cards stack */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-270px)] pr-1">
                  {columnIssues.length === 0 ? (
                    <div className="text-center py-10 rounded-lg border border-dashed border-slate-850 text-slate-600 text-xs">
                      No issues in this column
                    </div>
                  ) : (
                    columnIssues.map((issue) => (
                      <div
                        key={issue.id}
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, issue.id)}
                        onClick={() => onSelectIssue(issue.id)}
                        className="group p-4 bg-slate-900 border border-slate-800/60 hover:border-slate-700/80 rounded-xl cursor-grab active:cursor-grabbing hover:shadow-lg hover:shadow-black/20 hover:scale-[1.01] transition-all duration-200 flex flex-col gap-3 relative overflow-hidden"
                      >
                        {/* Hover glow line */}
                        <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                        {/* Card metadata row */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${getIssueTypeBadge(issue.issueType)}`}>
                            {issue.issueType}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 tracking-wider">
                            {issue.sequentialKey}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-sm font-bold text-slate-200 group-hover:text-brand-400 transition-colors line-clamp-2 leading-snug">
                          {issue.summary}
                        </h4>

                        {/* Bottom Row */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/40">
                          {/* Priority badge */}
                          <div className="flex items-center gap-1.5">
                            {getPriorityIcon(issue.priorityId)}
                            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                              {issue.priority}
                            </span>
                          </div>

                          {/* Assignee Avatar */}
                          <div>
                            {issue.assignee ? (
                              <img 
                                src={issue.assignee.avatarUrl} 
                                alt={issue.assignee.name}
                                className="h-5.5 w-5.5 rounded-full ring-1 ring-slate-800"
                                title={`Assigned to ${issue.assignee.name}`} 
                              />
                            ) : (
                              <div className="h-5.5 w-5.5 rounded-full bg-slate-900 border border-slate-800/85 flex items-center justify-center" title="Unassigned">
                                <span className="text-[8px] text-slate-600 font-extrabold font-mono">U</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Create Issue Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-2">Create New Issue</h2>
            <p className="text-xs text-slate-400 mb-6">File a new task, bug, or story under this project board</p>

            {createError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Summary / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Summarize the core requirement or defect..."
                  value={newIssue.summary}
                  onChange={(e) => setNewIssue({ ...newIssue, summary: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Provide details, step-to-reproduce, or checklists..."
                  value={newIssue.description}
                  onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Issue Type
                  </label>
                  <select
                    value={newIssue.issueTypeId}
                    onChange={(e) => setNewIssue({ ...newIssue, issueTypeId: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-sm focus:outline-none focus:border-brand-500 transition-all"
                  >
                    <option value={1}>Task</option>
                    <option value={2}>Bug</option>
                    <option value={3}>Story</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={newIssue.priorityId}
                    onChange={(e) => setNewIssue({ ...newIssue, priorityId: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-sm focus:outline-none focus:border-brand-500 transition-all"
                  >
                    <option value={1}>Low</option>
                    <option value={2}>Medium</option>
                    <option value={3}>High</option>
                    <option value={4}>Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Assignee
                  </label>
                  <select
                    value={newIssue.assigneeId}
                    onChange={(e) => setNewIssue({ ...newIssue, assigneeId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-sm focus:outline-none focus:border-brand-500 transition-all"
                  >
                    <option value="">Unassigned</option>
                    {participants.map(p => (
                      <option key={p.userId} value={p.userId}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-800/50 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setNewIssue({
                      summary: '',
                      description: '',
                      issueTypeId: 1,
                      priorityId: 2,
                      assigneeId: ''
                    });
                    setCreateError('');
                  }}
                  disabled={submittingIssue}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIssue}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm shadow-md transition-all"
                >
                  {submittingIssue && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
