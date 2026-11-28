'use client';

import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api/client';
import { Icon } from '@/lib/ui/icons';
import type { Lead } from '@/types';
import type { HydratedLeadNote } from '@/repositories/lead-notes.repository';
import type { LeadTagRow } from '@/repositories/lead-tags.repository';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  leadStatusLabel,
  leadStatusTone,
  priorityLabel,
  priorityTone,
  callOutcomeLabel,
  callOutcomeTone,
} from '@/lib/ui/status';

export interface LeadCallRecord {
  id: string;
  retell_call_id?: string | null;
  provider_call_id?: string | null;
  lead_id?: string | null;
  campaign_id?: string | null;
  status: string;
  direction?: string;
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number;
  disconnection_reason?: string | null;
  outcome: string;
  outcome_notes?: string | null;
  outcome_recorded_at?: string | null;
  transcript?: string | null;
  transcript_turns?: Array<{ id: string; body: string; created_at?: string }>;
  recording_url?: string | null;
  analysis?: {
    summary?: string;
    call_outcome?: string;
    sentiment?: string;
    sentiment_score?: number;
    is_successful?: boolean;
    in_voicemail?: boolean;
    qualification?: {
      outcome?: string;
      isQualified?: boolean;
      decisionMakerInvolved?: boolean;
      materialInterest?: string | null;
      estimatedVolume?: string | null;
      materialGrade?: string | null;
      purchaseIntent?: string | null;
      commercialRequirements?: string | null;
      customerObjections?: string | null;
      nextSteps?: string | null;
      callbackRequested?: boolean;
      callbackTime?: string | null;
      disqualificationReasons?: string[];
      evidence?: string[];
      contactName?: string | null;
      companyName?: string | null;
      jobTitle?: string | null;
      emailAddress?: string | null;
      directPhoneNumber?: string | null;
      customData?: Record<string, unknown>;
    };
  } | null;
}

interface LeadDrawerProps {
  leadId: string | null;
  initialEditMode?: boolean;
  onClose: () => void;
  onLeadUpdated: () => void;
  onInstantDial?: (lead: Lead) => void;
  onRequestDelete?: (lead: Lead) => void;
}

export const LeadDrawer: React.FC<LeadDrawerProps> = ({
  leadId,
  initialEditMode = false,
  onClose,
  onLeadUpdated,
  onInstantDial,
  onRequestDelete,
}) => {
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<HydratedLeadNote[]>([]);
  const [tags, setTags] = useState<LeadTagRow[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isDnc, setIsDnc] = useState(false);
  const [dncReason, setDncReason] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [leadCalls, setLeadCalls] = useState<LeadCallRecord[]>([]);
  const [callsLoaded, setCallsLoaded] = useState(false);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [showTranscriptCallId, setShowTranscriptCallId] = useState<string | null>(null);
  const [leadEmails, setLeadEmails] = useState<any[]>([]);
  const [leadEmailJobs, setLeadEmailJobs] = useState<any[]>([]);
  const [leadCallbacks, setLeadCallbacks] = useState<any[]>([]);
  const [emailsLoaded, setEmailsLoaded] = useState(false);

  useEffect(() => {
    if (!leadId) return;

    let isMounted = true;
    setIsLoading(true);
    setDrawerTab('overview');
    setIsEditing(Boolean(initialEditMode));
    setShowDeleteConfirm(false);
    setCallsLoaded(false);
    setLeadCalls([]);
    setEmailsLoaded(false);
    setLeadEmails([]);
    setLeadEmailJobs([]);
    setLeadCallbacks([]);
    setExpandedCallId(null);
    setShowTranscriptCallId(null);

    authenticatedFetch(`/api/leads/${leadId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !data.success) return;
        setLead(data.data);
        setIsDnc(Boolean(data.data.status === 'dnc' || data.data.isDnc));
        setDncReason(data.data.dncReason ?? null);
        setNotes(data.data.notesList || []);
        setTags(data.data.tagsList || []);
        setEditForm({
          name: data.data.name || '',
          title: data.data.title || '',
          company: data.data.company || '',
          phone: data.data.phone || '',
          email: data.data.email || '',
          status: data.data.status || 'new',
          priority: data.data.priority || 'medium',
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [leadId, initialEditMode]);

  useEffect(() => {
    if (!leadId || (drawerTab !== 'calls' && drawerTab !== 'intelligence') || callsLoaded) return;
    authenticatedFetch(`/api/leads/${leadId}/calls?limit=50`)
      .then((res) => res.json())
      .then((data) => {
        const rows = Array.isArray(data.data) ? (data.data as LeadCallRecord[]) : [];
        setLeadCalls(rows);
        setCallsLoaded(true);
      })
      .catch(() => setCallsLoaded(true));
  }, [leadId, drawerTab, callsLoaded]);

  useEffect(() => {
    if (!leadId || (drawerTab !== 'emails' && drawerTab !== 'overview' && drawerTab !== 'activity') || emailsLoaded) return;
    authenticatedFetch(`/api/leads/${leadId}/emails`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setLeadEmails(Array.isArray(data.data.messages) ? data.data.messages : []);
          setLeadEmailJobs(Array.isArray(data.data.jobs) ? data.data.jobs : []);
          setLeadCallbacks(Array.isArray(data.data.callbacks) ? data.data.callbacks : []);
        }
        setEmailsLoaded(true);
      })
      .catch(() => setEmailsLoaded(true));
  }, [leadId, drawerTab, emailsLoaded]);

  if (!leadId) return null;

  const handleToggleDnc = async () => {
    if (!lead) return;
    setIsSaving(true);
    try {
      if (isDnc) {
        if (!confirm(`Are you sure you want to remove the Do Not Call (DNC) restriction for "${lead.name}"?`)) {
          setIsSaving(false);
          return;
        }

        const res = await authenticatedFetch(`/api/leads/${lead.id}/dnc`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          setIsDnc(false);
          setDncReason(null);
          setFeedback('Do Not Call restriction removed.');
          onLeadUpdated();
        }
      } else {
        const reason = prompt('Reason for marking as Do Not Call:', 'Requested by prospect');
        if (!reason) {
          setIsSaving(false);
          return;
        }

        const res = await authenticatedFetch(`/api/leads/${lead.id}/dnc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
        const data = await res.json();
        if (data.success) {
          setIsDnc(true);
          setDncReason(reason);
          setFeedback(`Marked as Do Not Call: ${reason}`);
          onLeadUpdated();
        }
      }
    } catch {
      setFeedback('Failed to update DNC status');
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleArchive = async () => {
    if (!lead) return;
    if (onRequestDelete) {
      onRequestDelete(lead);
      return;
    }
    setShowDeleteConfirm(true);
  };

  const executeConfirmedDelete = async () => {
    if (!lead) return;
    setIsSaving(true);
    try {
      const res = await authenticatedFetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setShowDeleteConfirm(false);
        onLeadUpdated();
        onClose();
      } else {
        setFeedback(data.error || 'Failed to delete lead');
      }
    } catch {
      setFeedback('Failed to delete lead');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !newNote.trim()) return;

    try {
      const res = await authenticatedFetch(`/api/leads/${lead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) => [data.data, ...prev]);
        setNewNote('');
        setFeedback('Note added successfully');
        setTimeout(() => setFeedback(null), 2500);
      }
    } catch {
      setFeedback('Failed to save note');
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !newTag.trim()) return;

    try {
      const res = await authenticatedFetch(`/api/leads/${lead.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagName: newTag.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTags((prev) => [...prev, data.data]);
        setNewTag('');
        onLeadUpdated();
      }
    } catch {
      setFeedback('Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!lead) return;
    try {
      await authenticatedFetch(`/api/leads/${lead.id}/tags?tagId=${tagId}`, { method: 'DELETE' });
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      onLeadUpdated();
    } catch {
      setFeedback('Failed to remove tag');
    }
  };

  const handleSaveEdit = async () => {
    if (!lead) return;
    setIsSaving(true);
    try {
      const parts = editForm.name.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';

      const res = await authenticatedFetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          title: editForm.title,
          companyName: editForm.company,
          phone: editForm.phone,
          email: editForm.email || null,
          status: editForm.status,
          priority: editForm.priority,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLead(data.data);
        setIsEditing(false);
        setFeedback('Lead updated successfully');
        onLeadUpdated();
      } else {
        setFeedback(data.error || 'Failed to update lead');
      }
    } catch {
      setFeedback('Failed to update lead');
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close lead drawer" className="absolute inset-0 rm-overlay rm-fade" onClick={onClose} />
      <div
        className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-border bg-surface shadow-lg rm-drawer-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border bg-surface-elevated p-5">
          {isLoading || !lead ? (
            <div className="flex flex-col gap-2 w-full animate-pulse">
              <div className="h-6 bg-surface-container-high rounded w-2/3" />
              <div className="h-4 bg-surface-container-high rounded w-1/3" />
            </div>
          ) : (
            <div className="flex flex-col gap-space-2xs min-w-0">
              <div className="flex items-center gap-space-xs flex-wrap">
                <h2 className="font-headline-md text-headline-md font-bold text-on-surface truncate">
                  {lead.name}
                </h2>
                {isDnc ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-error/15 text-error text-xs font-semibold">
                    Do Not Call
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium uppercase">
                    {lead.status}
                  </span>
                )}
              </div>
              <span className="text-sm text-on-surface-variant truncate">
                {lead.title ? `${lead.title} • ` : ''}
                <strong className="text-on-surface">{lead.company}</strong>
              </span>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface flex items-center justify-center transition-colors border border-outline-variant/10 flex-shrink-0"
            type="button"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {feedback && (
          <div className="px-space-md py-space-xs bg-primary text-on-primary text-xs font-semibold flex items-center justify-between animate-in fade-in">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)}>×</button>
          </div>
        )}

        {/* Action Bar */}
        {lead && (
          <div className="px-space-base py-space-sm bg-surface-container-high/40 border-b border-outline-variant/10 flex items-center justify-between gap-space-xs flex-wrap">
            <div className="flex items-center gap-space-xs">
              <button
                type="button"
                disabled={isDnc}
                onClick={() => {
                  if (isDnc) {
                    setFeedback(`Cannot call ${lead.name}: Contact is marked as Do Not Call.`);
                    return;
                  }
                  onInstantDial?.(lead);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isDnc
                  ? 'bg-surface-container text-on-surface-variant/40 cursor-not-allowed'
                  : 'bg-primary text-on-primary hover:brightness-110 shadow-sm'
                  }`}
                title={isDnc ? 'Cannot call: Marked as Do Not Call' : 'Call Lead'}
              >
                <Icon name="call" size={14} />
                <span>{isDnc ? 'DNC Blocked' : 'Call Lead'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-bright text-xs border border-outline-variant/10 transition-colors font-medium"
              >
                <Icon name={isEditing ? 'visibility' : 'edit'} size={14} />
                <span>{isEditing ? 'View' : 'Edit'}</span>
              </button>
            </div>

            <div className="flex items-center gap-space-xs">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleToggleDnc}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isDnc
                  ? 'bg-tertiary/10 text-tertiary border-tertiary/20'
                  : 'bg-error/10 text-error border-error/20'
                  }`}
              >
                <Icon name={isDnc ? 'check_circle' : 'do_not_disturb_on'} size={14} />
                <span>{isDnc ? 'Remove DNC' : 'Mark as DNC'}</span>
              </button>

              <button
                type="button"
                onClick={handleArchive}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-error-surface text-error hover:bg-error hover:text-white border border-error/25 transition-colors text-xs font-medium"
                title="Delete lead"
              >
                <Icon name="delete" size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}

        {showDeleteConfirm && lead && (
          <div className="mx-4 mt-3 rounded-lg border border-error/30 bg-error-surface p-3.5 text-xs flex flex-col gap-2.5 rm-fade">
            <div className="font-semibold text-on-surface">
              Delete &ldquo;{lead.name}&rdquo; ({lead.company || 'No company'})?
            </div>
            <p className="text-on-surface-variant leading-relaxed">
              This lead will be removed from active CRM lists and excluded from future campaign queues. Historical call sessions, transcripts, and campaign logs will remain intact.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 rounded border border-border bg-surface text-on-surface font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={executeConfirmedDelete}
                className="px-3 py-1 rounded bg-error text-white font-semibold"
              >
                {isSaving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}

        {lead && !isEditing && (
          <div className="border-b border-border px-4 py-2">
            <Tabs
              value={drawerTab}
              onChange={setDrawerTab}
              items={[
                { id: 'overview', label: 'Overview' },
                { id: 'calls', label: 'Call History' },
                { id: 'intelligence', label: 'AI Analysis' },
                { id: 'emails', label: 'Emails' },
                { id: 'activity', label: 'Campaign Activity' },
              ]}
            />
          </div>
        )}

        {/* Drawer Scrollable Content */}
        <div className="p-space-base sm:p-space-lg flex-1 overflow-y-auto flex flex-col gap-space-lg">
          {isLoading || !lead ? (
            <div className="flex items-center justify-center p-space-xl text-on-surface-variant">
              <span>Loading lead details...</span>
            </div>
          ) : isEditing ? (
            /* EDIT FORM */
            <div className="flex flex-col gap-space-md p-space-md rounded-xl bg-surface-container border border-outline-variant/10">
              <h3 className="font-semibold text-sm text-on-surface">Edit Lead Information</h3>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Full Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-space-sm py-1.5 rounded bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/15"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Job Title</label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-space-sm py-1.5 rounded bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/15"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Company</label>
                <input
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  className="w-full px-space-sm py-1.5 rounded bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/15"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Phone</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-space-sm py-1.5 rounded bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/15 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Email</label>
                <input
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-space-sm py-1.5 rounded bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/15"
                />
              </div>
              <div className="grid grid-cols-2 gap-space-sm">
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-space-sm py-1.5 rounded bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/15"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="needs-review">Needs Review</option>
                    <option value="qualified">Qualified</option>
                    <option value="converted">Meeting Booked</option>
                    <option value="unqualified">Unreachable</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full px-space-sm py-1.5 rounded bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/15"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-space-md py-1.5 rounded bg-surface-container-high text-on-surface text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveEdit}
                  className="px-space-md py-1.5 rounded bg-primary text-on-primary text-xs font-semibold"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            /* VIEW MODE */
            <>
              {(drawerTab === 'overview') && (
                <div className="flex flex-col gap-4">
                  {/* SECTION 1: CONTACT */}
                  <div className="flex flex-col gap-space-xs p-space-md rounded-xl border border-border bg-surface-elevated">
                    <span className="text-xs font-semibold uppercase text-on-surface-variant tracking-wider">
                      Contact
                    </span>
                    <div className="grid grid-cols-2 gap-space-sm pt-1">
                      <div>
                        <span className="text-xs text-on-surface-variant block">Name</span>
                        <span className="text-sm font-semibold text-on-surface">{lead.name}</span>
                      </div>
                      <div>
                        <span className="text-xs text-on-surface-variant block">Company</span>
                        <span className="text-sm font-semibold text-on-surface">{lead.company}</span>
                      </div>
                      <div>
                        <span className="text-xs text-on-surface-variant block">Role</span>
                        <span className="text-sm text-on-surface">{lead.title || '—'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-on-surface-variant block">Phone</span>
                        <span className="text-sm font-mono text-on-surface">{lead.phone}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-on-surface-variant block">Email</span>
                        <span className="text-sm text-on-surface">{lead.email || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: STATUS */}
                  <div className="flex flex-col gap-space-xs p-space-md rounded-xl bg-surface-container border border-outline-variant/10">
                    <span className="text-xs font-semibold uppercase text-on-surface-variant tracking-wider">
                      Status
                    </span>
                    <div className="grid grid-cols-2 gap-space-sm pt-1">
                      <div>
                        <span className="text-xs text-on-surface-variant block">Lead Status</span>
                        <span className="text-sm font-semibold text-on-surface capitalize">{lead.status}</span>
                      </div>
                      <div>
                        <span className="text-xs text-on-surface-variant block">Priority</span>
                        <span className="text-sm text-on-surface capitalize">{editForm.priority || 'Medium'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-on-surface-variant block">Do Not Call (DNC)</span>
                        <span className="text-sm text-on-surface">
                          {isDnc ? (
                            <span className="text-error font-medium">Protected ({dncReason || 'Customer requested'})</span>
                          ) : (
                            <span className="text-tertiary font-medium">Callable</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: FOLLOW-UP & CALLBACKS */}
                  <div className="flex flex-col gap-space-xs p-space-md rounded-xl bg-surface-container border border-outline-variant/10">
                    <span className="text-xs font-semibold uppercase text-on-surface-variant tracking-wider">
                      Follow-Up &amp; Campaign Context
                    </span>
                    <div className="grid grid-cols-2 gap-space-sm pt-1">
                      <div>
                        <span className="text-xs text-on-surface-variant block">Assigned Campaign</span>
                        <span className="text-sm font-medium text-on-surface">
                          {lead.campaignName || 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-on-surface-variant block">Dial Attempts</span>
                        <span className="text-sm font-medium text-on-surface">
                          {lead.attempts ?? 0} / {lead.maxAttempts ?? 3}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-on-surface-variant block">Last Call Outcome</span>
                        <span className="text-sm text-on-surface">
                          {lead.lastOutcome || 'Not contacted yet'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-on-surface-variant block">Next Action</span>
                        <span className="text-sm text-primary font-medium">
                          {lead.nextAction?.description || 'Ready for calling'}
                        </span>
                      </div>
                    </div>

                    {leadCallbacks.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-outline-variant/15 flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-tertiary">
                          Scheduled Callbacks ({leadCallbacks.length})
                        </span>
                        {leadCallbacks.map((cb: any) => (
                          <div
                            key={cb.id}
                            className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/10 text-xs flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="font-semibold text-on-surface">
                                {new Date(cb.scheduled_at || cb.scheduled_for).toLocaleString()}
                              </div>
                              <div className="text-on-surface-variant">{cb.notes || 'Follow-up callback requested'}</div>
                            </div>
                            <Badge tone={cb.status === 'completed' ? 'success' : 'warning'}>
                              {cb.status || 'pending'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {drawerTab === 'notes' && (
                <div className="flex flex-col gap-space-md p-space-md rounded-xl border border-border bg-surface-elevated">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-on-surface-variant tracking-wider">
                      Notes &amp; Tags
                    </span>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="text-xs text-on-surface-variant block mb-1">Tags</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-high text-xs text-on-surface border border-outline-variant/15"
                        >
                          <span>{tag.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag.id)}
                            className="text-on-surface-variant hover:text-error ml-0.5"
                            title="Remove tag"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {tags.length === 0 && (
                        <span className="text-xs text-on-surface-variant/60">No tags assigned</span>
                      )}
                    </div>
                    <form onSubmit={handleAddTag} className="flex gap-2">
                      <input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Add tag..."
                        className="flex-1 px-space-sm py-1 rounded bg-surface-container-lowest text-xs text-on-surface border border-outline-variant/15"
                      />
                      <button
                        type="submit"
                        className="px-space-md py-1 rounded bg-surface-container-high hover:bg-surface-bright text-xs text-on-surface font-medium"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                  {/* Notes */}
                  <div className="pt-2 border-t border-outline-variant/10">
                    <label className="text-xs text-on-surface-variant block mb-1">Notes ({notes.length})</label>
                    <form onSubmit={handleAddNote} className="flex flex-col gap-2 mb-3">
                      <textarea
                        rows={2}
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a note..."
                        className="w-full px-space-sm py-1.5 rounded bg-surface-container-lowest text-xs text-on-surface border border-outline-variant/15"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="px-space-md py-1 rounded bg-primary text-on-primary text-xs font-semibold"
                        >
                          Save Note
                        </button>
                      </div>
                    </form>

                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                      {notes.map((note) => (
                        <div
                          key={note.id}
                          className="p-space-xs rounded bg-surface-container-low text-xs border border-outline-variant/10"
                        >
                          <div className="flex items-center justify-between text-on-surface-variant mb-1">
                            <span className="font-semibold text-on-surface">{note.author_name || 'Operator'}</span>
                            <span className="font-mono text-[10px]">
                              {new Date(note.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-on-surface whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === 'activity' && (
                <div className="flex flex-col gap-4">
                  {/* Campaign & Callbacks Summary */}
                  <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-border bg-surface-elevated">
                    <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                      Campaign Enrollment &amp; Callbacks
                    </span>
                    <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                      <div>
                        <span className="text-on-surface-variant block">Assigned Campaign</span>
                        <span className="font-semibold text-on-surface">{lead.campaignName || 'Unassigned'}</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block">Call Attempts</span>
                        <span className="font-semibold text-on-surface">
                          {lead.attempts ?? 0} of {lead.maxAttempts ?? 3}
                        </span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block">Last Outcome</span>
                        <span className="font-medium text-on-surface">{lead.lastOutcome || 'Not contacted'}</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block">Email Status</span>
                        <span className="font-medium text-on-surface capitalize">{lead.emailDeliveryStatus || 'None'}</span>
                      </div>
                    </div>

                    {leadCallbacks.length > 0 && (
                      <div className="mt-2 pt-2.5 border-t border-border flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-primary">
                          Scheduled Callbacks ({leadCallbacks.length})
                        </span>
                        {leadCallbacks.map((cb: any) => (
                          <div
                            key={cb.id}
                            className="p-2.5 rounded-lg bg-surface-secondary border border-border text-xs flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="font-semibold text-on-surface">
                                {new Date(cb.scheduled_at || cb.scheduled_for).toLocaleString()}
                              </div>
                              <div className="text-on-surface-variant">{cb.notes || 'Follow-up callback requested'}</div>
                            </div>
                            <Badge tone={cb.status === 'completed' ? 'success' : 'warning'}>
                              {cb.status || 'pending'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes & Tags Section inside Campaign Activity */}
                  <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-surface-elevated">
                    <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                      Notes &amp; Tags
                    </span>

                    <div>
                      <label className="text-xs text-on-surface-variant block mb-1">Tags</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-secondary text-xs text-on-surface border border-border"
                          >
                            <span>{tag.name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag.id)}
                              className="text-on-surface-variant hover:text-error ml-0.5"
                              title="Remove tag"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {tags.length === 0 && (
                          <span className="text-xs text-on-surface-muted">No tags assigned</span>
                        )}
                      </div>
                      <form onSubmit={handleAddTag} className="flex gap-2">
                        <input
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder="Add tag..."
                          className="flex-1 px-2.5 py-1 rounded-md bg-input text-xs text-on-surface border border-border"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1 rounded-md bg-surface-secondary hover:bg-surface text-xs text-on-surface font-medium border border-border"
                        >
                          Add
                        </button>
                      </form>
                    </div>

                    <div className="pt-2 border-t border-border">
                      <label className="text-xs text-on-surface-variant block mb-1">Notes ({notes.length})</label>
                      <form onSubmit={handleAddNote} className="flex flex-col gap-2 mb-3">
                        <textarea
                          rows={2}
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Add an operational note..."
                          className="w-full px-2.5 py-1.5 rounded-md bg-input text-xs text-on-surface border border-border"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold"
                          >
                            Save Note
                          </button>
                        </div>
                      </form>

                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                        {notes.map((note) => (
                          <div
                            key={note.id}
                            className="p-2.5 rounded-lg bg-surface-secondary text-xs border border-border"
                          >
                            <div className="flex items-center justify-between text-on-surface-variant mb-1">
                              <span className="font-semibold text-on-surface">{note.author_name || 'Operator'}</span>
                              <span className="font-mono text-[10px]">
                                {new Date(note.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-on-surface whitespace-pre-wrap">{note.content}</p>
                          </div>
                        ))}
                        {notes.length === 0 && (
                          <span className="text-xs text-on-surface-muted">No notes recorded yet.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === 'intelligence' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-space-xs p-space-md rounded-xl border border-border bg-surface-elevated">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                        Claude CRM Intelligence &amp; Qualification
                      </span>
                      <Badge tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</Badge>
                    </div>
                    {(() => {
                      const latestAnalyzedCall = leadCalls.find((c) => c.analysis?.qualification);
                      const q = latestAnalyzedCall?.analysis?.qualification as any;
                      const summary = latestAnalyzedCall?.outcome_notes || latestAnalyzedCall?.analysis?.summary;

                      if (!latestAnalyzedCall || !q) {
                        return (
                          <div className="pt-2 text-xs text-on-surface-variant">
                            <p>No structured post-call AI analysis recorded yet for this lead.</p>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="block text-xs text-on-surface-variant">Current Status</span>
                                <span className="font-semibold text-on-surface">{leadStatusLabel(lead.status)}</span>
                              </div>
                              <div>
                                <span className="block text-xs text-on-surface-variant">Recommended Action</span>
                                <span className="font-medium text-primary">{lead.nextAction?.description || 'Ready to dial'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-col gap-3 pt-2 text-xs">
                          {summary && (
                            <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/10 text-on-surface leading-relaxed">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary block mb-1">
                                Executive Call Summary
                              </span>
                              {summary}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2.5 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/15">
                            <div>
                              <span className="text-[10px] text-on-surface-variant block">Qualification Decision</span>
                              <span className="font-semibold text-on-surface">{q.outcome || latestAnalyzedCall.outcome}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-on-surface-variant block">Decision Maker</span>
                              <span className="font-semibold text-on-surface">
                                {q.decisionMakerInvolved ? 'Confirmed' : 'Not Confirmed'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-on-surface-variant block">Material / Product</span>
                              <span className="font-medium text-on-surface">{q.materialInterest || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-on-surface-variant block">Estimated Volume</span>
                              <span className="font-medium text-on-surface">{q.estimatedVolume || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-on-surface-variant block">Material Grade</span>
                              <span className="font-medium text-on-surface">{q.materialGrade || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-on-surface-variant block">Frequency / Timeline</span>
                              <span className="font-medium text-on-surface">
                                {[q.frequency, q.commercialTimeline || q.purchaseIntent].filter(Boolean).join(' • ') || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-on-surface-variant block">Delivery / Pickup Location</span>
                              <span className="font-medium text-on-surface">{q.deliveryOrPickupLocation || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-on-surface-variant block">Confirmed Email</span>
                              <span className="font-mono text-on-surface">{q.emailAddress || lead.email || '—'}</span>
                            </div>
                          </div>

                          {q.qualificationReason && (
                            <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/10">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant block mb-0.5">
                                Qualification Reasoning
                              </span>
                              <span className="text-on-surface">{q.qualificationReason}</span>
                            </div>
                          )}

                          {q.nextSteps && (
                            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary block mb-0.5">
                                Agreed Next Step
                              </span>
                              <span className="font-medium text-on-surface">{q.nextSteps}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {drawerTab === 'emails' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-1 border-b border-border">
                    <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                      Email History ({leadEmails.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailsLoaded(false);
                      }}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <Icon name="refresh" size={13} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {!emailsLoaded && (
                    <div className="py-6 text-center text-xs text-on-surface-variant">
                      Loading email history...
                    </div>
                  )}

                  {emailsLoaded && leadEmails.length === 0 && leadEmailJobs.length === 0 && (
                    <div className="p-4 text-center rounded-xl bg-surface-container-low border border-outline-variant/10 text-xs text-on-surface-variant">
                      No follow-up emails sent or queued for this lead yet. Automatic emails are triggered exclusively for qualified campaign leads.
                    </div>
                  )}

                  {leadEmails.map((msg: any) => (
                    <div
                      key={msg.id}
                      className="rounded-xl border border-border bg-surface-elevated p-3.5 text-xs flex flex-col gap-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-sm text-on-surface">{msg.subject}</div>
                          <div className="text-[11px] text-on-surface-variant">
                            To: <span className="font-mono text-on-surface">{msg.toEmail}</span> ·{' '}
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}
                          </div>
                        </div>
                        <Badge
                          tone={
                            msg.status === 'delivered' || msg.status === 'accepted'
                              ? 'success'
                              : msg.status === 'bounced' || msg.status === 'failed'
                              ? 'error'
                              : 'info'
                          }
                        >
                          {msg.status}
                        </Badge>
                      </div>

                      {msg.textBody && (
                        <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/10 whitespace-pre-wrap text-on-surface max-h-44 overflow-y-auto leading-relaxed">
                          {msg.textBody}
                        </div>
                      )}

                      {msg.lastError && (
                        <div className="text-error text-[11px] font-medium">
                          Delivery Error: {msg.lastError}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-outline-variant/10 text-[10px] font-mono text-on-surface-variant">
                        <span>Resend ID: {msg.resendId || 'Pending'}</span>
                        <span>
                          {msg.deliveredAt
                            ? `Delivered ${new Date(msg.deliveredAt).toLocaleTimeString()}`
                            : msg.acceptedAt
                            ? `Accepted ${new Date(msg.acceptedAt).toLocaleTimeString()}`
                            : 'Queued'}
                        </span>
                      </div>
                    </div>
                  ))}

                  {leadEmails.length === 0 &&
                    leadEmailJobs
                      .filter((j: any) => j.status === 'suppressed' || j.status === 'failed')
                      .map((job: any) => (
                        <div
                          key={job.id}
                          className="rounded-xl border border-border bg-surface-container-low p-3 text-xs flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-on-surface">Follow-Up Email Evaluation</span>
                            <Badge tone="warning">{job.status}</Badge>
                          </div>
                          <div className="text-on-surface-variant">
                            {job.lastError ||
                              (Array.isArray(job.eligibilityReasons) &&
                                job.eligibilityReasons.map((r: any) => r.message).join(' ')) ||
                              'Email was skipped based on qualification or eligibility rules.'}
                          </div>
                        </div>
                      ))}
                </div>
              )}

              {drawerTab === 'calls' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-1 border-b border-border">
                    <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                      Call History ({leadCalls.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCallsLoaded(false);
                        authenticatedFetch(`/api/leads/${leadId}/calls?limit=50`)
                          .then((res) => res.json())
                          .then((data) => {
                            setLeadCalls(Array.isArray(data.data) ? data.data : []);
                            setCallsLoaded(true);
                          })
                          .catch(() => setCallsLoaded(true));
                      }}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <Icon name="refresh" size={13} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {!callsLoaded && (
                    <div className="py-6 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
                      <Icon name="hourglass_empty" size={16} className="animate-spin" />
                      <span>Loading call records...</span>
                    </div>
                  )}

                  {callsLoaded && leadCalls.length === 0 && (
                    <div className="p-4 text-center rounded-xl bg-surface-container-low border border-outline-variant/10 text-xs text-on-surface-variant">
                      No calls recorded for this lead yet.
                    </div>
                  )}

                  {leadCalls.map((call, idx) => {
                    const isExpanded = expandedCallId === call.id;
                    const isTranscriptOpen = showTranscriptCallId === call.id;
                    const q = call.analysis?.qualification;
                    const summary = call.outcome_notes || call.analysis?.summary;
                    const attemptNumber = leadCalls.length - idx;

                    return (
                      <div
                        key={call.id}
                        className="rounded-xl border border-border bg-surface-elevated p-3.5 text-xs flex flex-col gap-2.5 transition-all shadow-sm"
                      >
                        {/* Call Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 font-semibold text-on-surface text-sm">
                              <Icon name="phone_forwarded" size={15} className="text-primary" />
                              <span>Attempt #{attemptNumber} · Outbound AI Call</span>
                              <span className="text-xs font-normal text-on-surface-variant">· {call.duration_seconds || 0}s</span>
                            </div>
                            <div className="text-[11px] text-on-surface-variant">
                              {call.started_at ? new Date(call.started_at).toLocaleString() : 'Time unavailable'}
                              {call.status ? ` · Technical Status: ${call.status}` : ''}
                            </div>
                          </div>
                          <Badge tone={callOutcomeTone(call.outcome)}>
                            {callOutcomeLabel(call.outcome)}
                          </Badge>
                        </div>

                        {/* Summary / Notes */}
                        {summary && (
                          <div className="p-2 rounded bg-surface-container-low border border-outline-variant/10 text-xs text-on-surface/90 italic leading-relaxed">
                            &ldquo;{summary}&rdquo;
                          </div>
                        )}

                        {/* Disconnection Reason if non-standard */}
                        {call.disconnection_reason && !['user_hangup', 'agent_hangup'].includes(call.disconnection_reason.toLowerCase()) && (
                          <div className="text-[11px] text-on-surface-variant flex items-center gap-1">
                            <span className="font-medium text-on-surface">Disconnection:</span>
                            <span>{call.disconnection_reason}</span>
                          </div>
                        )}

                        {/* Expandable Details Toggle */}
                        <div className="pt-1 flex items-center justify-between border-t border-outline-variant/10">
                          <button
                            type="button"
                            onClick={() => setExpandedCallId(isExpanded ? null : call.id)}
                            className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                          >
                            <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={15} />
                            <span>{isExpanded ? 'Hide Call Details' : 'View Call Details'}</span>
                          </button>

                          {call.retell_call_id && (
                            <span className="font-mono text-[10px] text-on-surface-variant/80" title="Retell Call ID">
                              ID: {call.retell_call_id.slice(0, 16)}...
                            </span>
                          )}
                        </div>

                        {/* Expanded Call Details */}
                        {isExpanded && (
                          <div className="mt-1 pt-2 border-t border-outline-variant/10 flex flex-col gap-3 animate-in fade-in">
                            {/* Qualification & Commercial Breakdown */}
                            <div className="bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant/15 flex flex-col gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                                Commercial Qualification
                              </span>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-[10px] text-on-surface-variant block">Decision Maker</span>
                                  <span className="font-medium text-on-surface">
                                    {q?.decisionMakerInvolved ? 'Yes (Confirmed)' : 'No / Unconfirmed'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-on-surface-variant block">Contact Name & Title</span>
                                  <span className="font-medium text-on-surface">
                                    {q?.contactName || '—'}{q?.jobTitle ? ` (${q.jobTitle})` : ''}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-on-surface-variant block">Material / Product</span>
                                  <span className="font-medium text-on-surface">{q?.materialInterest || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-on-surface-variant block">Estimated Volume</span>
                                  <span className="font-medium text-on-surface">{q?.estimatedVolume || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-on-surface-variant block">Material Grade</span>
                                  <span className="font-medium text-on-surface">{q?.materialGrade || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-on-surface-variant block">Purchase Timeline</span>
                                  <span className="font-medium text-on-surface">{q?.purchaseIntent || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-on-surface-variant block">Direct Phone</span>
                                  <span className="font-mono text-on-surface">{q?.directPhoneNumber || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-on-surface-variant block">Email Address</span>
                                  <span className="font-mono text-on-surface">{q?.emailAddress || '—'}</span>
                                </div>
                              </div>

                              {q?.commercialRequirements && (
                                <div className="pt-1 text-xs">
                                  <span className="text-[10px] text-on-surface-variant block">Commercial Requirements</span>
                                  <span className="text-on-surface">{q.commercialRequirements}</span>
                                </div>
                              )}

                              {q?.customerObjections && (
                                <div className="pt-1 text-xs">
                                  <span className="text-[10px] text-on-surface-variant block">Customer Objections</span>
                                  <span className="text-on-surface text-error">{q.customerObjections}</span>
                                </div>
                              )}

                              {q?.nextSteps && (
                                <div className="pt-1 text-xs">
                                  <span className="text-[10px] text-on-surface-variant block">Next Action Items</span>
                                  <span className="text-primary font-medium">{q.nextSteps}</span>
                                </div>
                              )}

                              {q?.callbackRequested && q.callbackTime && (
                                <div className="pt-1 text-xs">
                                  <span className="text-[10px] text-on-surface-variant block">Scheduled Callback</span>
                                  <span className="text-tertiary font-semibold">{q.callbackTime}</span>
                                </div>
                              )}

                              {q?.disqualificationReasons && q.disqualificationReasons.length > 0 && (
                                <div className="pt-1 text-xs">
                                  <span className="text-[10px] text-error font-medium block">Disqualification Reasons:</span>
                                  <ul className="list-disc list-inside text-[11px] text-on-surface-variant">
                                    {q.disqualificationReasons.map((reason, idx) => (
                                      <li key={idx}>{reason}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {/* Audio Recording */}
                            {call.recording_url && (
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                                  Call Audio Recording
                                </span>
                                <audio controls src={call.recording_url} className="w-full h-8" preload="none" />
                              </div>
                            )}

                            {/* Full Conversation Transcript Accordion */}
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => setShowTranscriptCallId(isTranscriptOpen ? null : call.id)}
                                className="flex items-center justify-between px-2.5 py-1.5 rounded bg-surface-container-high hover:bg-surface-bright text-xs text-on-surface transition-colors font-medium"
                              >
                                <span>Conversation Transcript</span>
                                <Icon name={isTranscriptOpen ? 'expand_less' : 'expand_more'} size={14} />
                              </button>

                              {isTranscriptOpen && (
                                <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/10 max-h-60 overflow-y-auto flex flex-col gap-1.5 text-xs">
                                  {call.transcript_turns && call.transcript_turns.length > 0 ? (
                                    call.transcript_turns.map((turn, tIdx) => {
                                      const isAi = turn.body.toLowerCase().startsWith('ai:') || turn.body.toLowerCase().startsWith('agent:');
                                      return (
                                        <div
                                          key={turn.id || tIdx}
                                          className={`p-1.5 rounded ${isAi ? 'bg-primary/5 border border-primary/15' : 'bg-surface-elevated border border-outline-variant/10'}`}
                                        >
                                          <div className={`font-semibold text-[10px] ${isAi ? 'text-primary' : 'text-on-surface'}`}>
                                            {isAi ? 'AI Agent' : 'Lead'}
                                          </div>
                                          <div className="text-on-surface text-xs whitespace-pre-wrap">
                                            {turn.body.replace(/^(ai|agent|lead|user|operator|system):\s*/i, '')}
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : call.transcript ? (
                                    <pre className="whitespace-pre-wrap font-sans text-xs text-on-surface leading-relaxed">
                                      {call.transcript}
                                    </pre>
                                  ) : (
                                    <span className="text-on-surface-variant italic">No transcript recorded for this call.</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Provider Reference */}
                            <div className="text-[10px] text-on-surface-variant font-mono flex items-center justify-between">
                              <span>Retell Call: {call.retell_call_id || 'N/A'}</span>
                              <span>Session: {call.id.slice(0, 8)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
