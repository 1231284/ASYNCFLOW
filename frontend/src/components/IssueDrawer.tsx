import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { X, Trash2, Send, Loader2, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserDTO {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isActive?: boolean;
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

interface Comment {
  id: string;
  issueId: string;
  author: UserDTO;
  commentBody: string;
  timestamp: string;
}

interface Participant {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface IssueDrawerProps {
  issueId: string;
  onClose: (didUpdate: boolean) => void;
  projectRole: string; // The user's role in the current project to enforce delete permissions
}

export const IssueDrawer: React.FC<IssueDrawerProps> = ({ issueId, onClose, projectRole }) => {
  useAuth();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [error, setError] = useState('');

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  // New Comment state
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const isAdminOrManager = projectRole === 'Administrator' || projectRole === 'Manager';

  // Load Issue details and comments
  const loadDetails = async () => {
    setLoading(true);
    try {
      const issueData = await api.issues.get(issueId);
      setIssue(issueData);
      setEditedSummary(issueData.summary);
      setEditedDescription(issueData.description || '');

      // Load participants to fill assignee dropdown
      const proj = await api.projects.get(issueData.projectId);
      setParticipants(proj.participants);
      
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load issue details.');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      const commentsList = await api.comments.list(issueId);
      setComments(commentsList);
    } catch (err: any) {
      console.error("Failed to load comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
    loadComments();
  }, [issueId]);

  const handleFieldChange = async (fields: Partial<Issue>) => {
    if (!issue) return;

    // Build the request body blending the changes
    const updated = {
      summary: fields.summary !== undefined ? fields.summary : issue.summary,
      description: fields.description !== undefined ? fields.description : issue.description,
      issueTypeId: fields.issueTypeId !== undefined ? fields.issueTypeId : issue.issueTypeId,
      priorityId: fields.priorityId !== undefined ? fields.priorityId : issue.priorityId,
      statusId: fields.statusId !== undefined ? fields.statusId : issue.statusId,
      assigneeId: fields.assignee !== undefined 
        ? (fields.assignee ? fields.assignee.id : null) 
        : (issue.assignee ? issue.assignee.id : null)
    };

    try {
      const response = await api.issues.update(issueId, updated);
      setIssue(response);
    } catch (err: any) {
      alert(err.message || "Failed to update field on server.");
    }
  };

  const handleSaveTextEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedSummary.trim()) return;

    setSavingDetails(true);
    try {
      await handleFieldChange({
        summary: editedSummary.trim(),
        description: editedDescription.trim() || undefined
      });
      setIsEditing(false);
    } finally {
      setSavingDetails(false);
    }
  };

  const handleDeleteIssue = async () => {
    if (!isAdminOrManager) return;
    if (!window.confirm("Are you sure you want to permanently delete this issue?")) return;

    try {
      await api.issues.delete(issueId);
      onClose(true); // Close drawer and notify board of update
    } catch (err: any) {
      alert(err.message || "Failed to delete issue.");
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const posted = await api.comments.create(issueId, { commentBody: newComment.trim() });
      setComments(prev => [...prev, posted]); // Add chronologically at the bottom
      setNewComment('');
    } catch (err: any) {
      alert(err.message || "Failed to post comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="fixed top-0 right-0 h-full w-full sm:w-[480px] md:w-[540px] bg-slate-900 border-l border-slate-800 shadow-2xl z-40 flex flex-col items-center justify-center p-6">
        <Loader2 className="h-8 w-8 text-brand-500 animate-spin mb-3" />
        <span className="text-sm text-slate-400">Loading issue details...</span>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="fixed top-0 right-0 h-full w-full sm:w-[480px] md:w-[540px] bg-slate-900 border-l border-slate-800 shadow-2xl z-40 p-6">
        <div className="flex justify-between items-center mb-6">
          <span className="text-sm text-slate-400 font-bold">Error</span>
          <button onClick={() => onClose(false)} className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="text-center py-20 bg-slate-950/20 border border-slate-850 rounded-xl">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
          <p className="text-sm text-slate-300 font-semibold">{error || "Failed to retrieve issue."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 right-0 h-full w-full sm:w-[480px] md:w-[540px] bg-slate-900 border-l border-slate-800 shadow-2xl z-40 flex flex-col justify-between overflow-hidden animate-slide-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-850 uppercase tracking-wider">
            {issue.sequentialKey}
          </span>
          <span className="text-xs text-slate-500 font-semibold">
            Created {formatDate(issue.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isAdminOrManager && (
            <button
              onClick={handleDeleteIssue}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg transition-all"
              title="Delete Issue"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          )}
          <button
            onClick={() => onClose(true)} // Close and trigger reload
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Title & Description Form */}
        {isEditing ? (
          <form onSubmit={handleSaveTextEdits} className="space-y-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Summary
              </label>
              <input
                type="text"
                required
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-brand-500 outline-none rounded-lg text-slate-200 text-sm transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-brand-500 outline-none rounded-lg text-slate-200 text-sm transition-all resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditedSummary(issue.summary);
                  setEditedDescription(issue.description || '');
                }}
                className="px-2.5 py-1 text-xs border border-slate-800 text-slate-400 hover:text-slate-200 rounded transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingDetails}
                className="px-3 py-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold text-xs rounded shadow transition-all flex items-center gap-1"
              >
                {savingDetails && <Loader2 className="h-3 w-3 animate-spin" />}
                Save
              </button>
            </div>
          </form>
        ) : (
          <div 
            onClick={() => setIsEditing(true)}
            className="p-4 bg-slate-900/40 border border-slate-850 hover:border-slate-700/60 rounded-xl cursor-pointer transition-all"
            title="Click to edit"
          >
            <h2 className="text-lg font-bold text-white leading-snug">{issue.summary}</h2>
            <div className="text-sm text-slate-400 mt-3 whitespace-pre-wrap leading-relaxed">
              {issue.description || <span className="text-slate-600 italic">No description provided. Click to add one.</span>}
            </div>
          </div>
        )}

        {/* Dropdowns properties Grid */}
        <div className="grid grid-cols-2 gap-4 bg-slate-900/20 p-4 rounded-xl border border-slate-850">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={issue.statusId}
              onChange={(e) => handleFieldChange({ statusId: Number(e.target.value) })}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-all"
            >
              <option value={1}>To Do</option>
              <option value={2}>In Progress</option>
              <option value={3}>Done</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Assignee
            </label>
            <select
              value={issue.assignee ? issue.assignee.id : ''}
              onChange={(e) => {
                const targetId = e.target.value;
                const match = participants.find(p => p.userId === targetId);
                handleFieldChange({ assignee: match ? { id: match.userId, name: match.name, email: match.email, isActive: true } : undefined });
              }}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-all"
            >
              <option value="">Unassigned</option>
              {participants.map(p => (
                <option key={p.userId} value={p.userId}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={issue.priorityId}
              onChange={(e) => handleFieldChange({ priorityId: Number(e.target.value) })}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-all"
            >
              <option value={1}>Low</option>
              <option value={2}>Medium</option>
              <option value={3}>High</option>
              <option value={4}>Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Issue Type
            </label>
            <select
              value={issue.issueTypeId}
              onChange={(e) => handleFieldChange({ issueTypeId: Number(e.target.value) })}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-all"
            >
              <option value={1}>Task</option>
              <option value={2}>Bug</option>
              <option value={3}>Story</option>
            </select>
          </div>
        </div>

        {/* Reporter info */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/10 border border-slate-850 text-xs">
          <span className="text-slate-500 font-bold uppercase tracking-wider">Reporter</span>
          <div className="flex items-center gap-2">
            <img src={issue.reporter.avatarUrl} alt={issue.reporter.name} className="h-5 w-5 rounded-full" />
            <span className="text-slate-300 font-semibold">{issue.reporter.name}</span>
          </div>
        </div>

        {/* Comments Feed Section */}
        <div className="space-y-4 pt-4 border-t border-slate-800/80">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <MessageSquare className="h-4.5 w-4.5 text-brand-400" />
            Discussion Thread
          </h3>

          {/* Comment list */}
          {commentsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 text-brand-500 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No comments have been posted yet. Start the conversation!</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-3 text-xs">
                  <img 
                    src={comment.author.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.author.id}`} 
                    alt={comment.author.name}
                    className="h-8 w-8 rounded-full border border-slate-800 mt-0.5 shrink-0" 
                  />
                  <div className="flex-1 bg-slate-950 p-3 rounded-xl border border-slate-850">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-300">{comment.author.name}</span>
                      <span className="text-[10px] text-slate-500">{formatDate(comment.timestamp)}</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed whitespace-pre-wrap">{comment.commentBody}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comment Editor */}
      <form onSubmit={handlePostComment} className="p-4 border-t border-slate-800 bg-slate-900 flex items-center gap-3">
        <textarea
          rows={1}
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:outline-none rounded-lg text-xs text-slate-300 transition-all resize-none max-h-20"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || submittingComment}
          className="p-2.5 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-40 text-white rounded-lg transition-all"
        >
          {submittingComment ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
        </button>
      </form>
    </div>
  );
};
