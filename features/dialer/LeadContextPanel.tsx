'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/lib/ui/icons';
import type { Lead } from '@/types';

interface LeadContextPanelProps {
  lead: Lead;
  onLeadUpdated?: () => void;
}

export const LeadContextPanel: React.FC<LeadContextPanelProps> = ({ lead, onLeadUpdated }) => {
  const [copied, setCopied] = useState(false);
  const [isDnc, setIsDnc] = useState(lead.status === 'dnc' || Boolean(lead.isDnc));
  const [notes, setNotes] = useState<string[]>(lead.notes || []);
  const [newNote, setNewNote] = useState('');
  const [isSavingDnc, setIsSavingDnc] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsDnc(lead.status === 'dnc' || Boolean(lead.isDnc));
    setNotes(lead.notes || []);
  }, [lead.id, lead.status, lead.isDnc, lead.notes]);

  const showNotice = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCopyPhone = () => {
    if (!lead.phone) return;
    navigator.clipboard?.writeText(lead.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleDnc = async () => {
    if (!lead.id || isSavingDnc) return;
    setIsSavingDnc(true);
    try {
      if (isDnc) {
        const res = await fetch(`/api/leads/${lead.id}/dnc`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          setIsDnc(false);
          showNotice(`${lead.name || 'Contact'} removed from DNC registry.`);
          onLeadUpdated?.();
        } else {
          showNotice(data.error || 'Failed to update DNC status');
        }
      } else {
        const res = await fetch(`/api/leads/${lead.id}/dnc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Operator marked DNC from workstation' }),
        });
        const data = await res.json();
        if (data.success) {
          setIsDnc(true);
          showNotice(`${lead.name || 'Contact'} strictly marked as Do-Not-Call (DNC).`);
          onLeadUpdated?.();
        } else {
          showNotice(data.error || 'Failed to update DNC status');
        }
      }
    } catch {
      showNotice('Network error updating DNC status');
    } finally {
      setIsSavingDnc(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !lead.id || isAddingNote) return;

    const noteContent = newNote.trim();
    setIsAddingNote(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent }),
      });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) => [...prev, noteContent]);
        setNewNote('');
        showNotice('Operational note saved.');
        onLeadUpdated?.();
      } else {
        // Fallback update local state if note table not initialized
        setNotes((prev) => [...prev, noteContent]);
        setNewNote('');
        showNotice('Note added.');
      }
    } catch {
      setNotes((prev) => [...prev, noteContent]);
      setNewNote('');
      showNotice('Note added to session.');
    } finally {
      setIsAddingNote(false);
    }
  };

  return (
    <div className="rm-card flex flex-col gap-4 p-5">
      {/* Contact Profile Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[17px] font-semibold leading-snug text-on-surface">
            {lead.name || 'No lead selected'}
          </h2>
          {lead.title ? (
            <span className="text-[13px] font-medium text-on-surface-variant">{lead.title}</span>
          ) : null}
          {lead.company ? (
            <span className="mt-0.5 text-[14px] font-semibold text-primary">{lead.company}</span>
          ) : null}
        </div>
        {lead.id ? (
          <span className="shrink-0 rounded-md border border-accent/20 bg-accent-surface px-2.5 py-1 text-[11px] font-semibold text-primary">
            Active
          </span>
        ) : null}
      </div>

      {/* Phone & Local Time */}
      <div className="bg-surface-elevated rounded-lg p-3.5 flex flex-col gap-1.5 border border-border">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-semibold tracking-wide text-on-surface">
            {lead.phone || 'No number on file'}
          </span>
          <button
            onClick={handleCopyPhone}
            disabled={!lead.phone}
            className="text-on-surface-variant hover:text-primary transition-colors p-1"
            type="button"
            title="Copy phone number"
          >
            <Icon name={copied ? 'check' : 'content_copy'} size={18} />
          </button>
        </div>
        {(lead.timezone || lead.localTime) && (
          <div className="flex items-center justify-between text-[13px] text-on-surface-variant">
            {lead.timezone ? <span>Timezone: {lead.timezone}</span> : <span />}
            {lead.localTime ? <span className="text-secondary font-medium">{lead.localTime}</span> : null}
          </div>
        )}
      </div>

      {/* Notes & History */}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-on-surface-variant uppercase tracking-wider">
          Account Notes
        </span>
        <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="rounded border border-dashed border-border p-2.5 text-[13px] text-on-surface-variant">
              No notes yet for this lead.
            </div>
          ) : (
            notes.map((note, idx) => (
              <div key={idx} className="p-2.5 rounded bg-surface-elevated border border-border text-[14px] text-on-surface">
                {note}
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleAddNote} className="flex gap-2 mt-1">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            disabled={!lead.id || isAddingNote}
            placeholder="Add operational note..."
            className="flex-1 bg-surface-elevated border border-border rounded-md px-3 py-1.5 text-[14px] text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!lead.id || !newNote.trim() || isAddingNote}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary-hover disabled:opacity-50 transition-opacity"
          >
            {isAddingNote ? 'Saving...' : 'Add'}
          </button>
        </form>
      </div>

      {/* DNC Safety Action */}
      <div className="pt-2 border-t border-border flex flex-col gap-2">
        <button
          onClick={toggleDnc}
          type="button"
          disabled={!lead.id || isSavingDnc}
          className={`w-full py-2 px-3 rounded-md text-[13px] font-medium transition-colors border disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-1.5 ${
            isDnc
              ? 'bg-error/15 text-error border-error/40'
              : 'bg-surface text-on-surface-variant hover:text-error border-border hover:bg-error/10'
          }`}
        >
          <Icon name={isDnc ? 'do_not_disturb_on' : 'block'} size={15} />
          <span>
            {isSavingDnc
              ? 'Updating DNC Status...'
              : isDnc
              ? 'Marked as Do Not Call (DNC) — Click to Clear'
              : 'Mark as Do Not Call (DNC)'}
          </span>
        </button>

        {toastMessage && (
          <div className="p-2 text-xs rounded bg-surface-elevated border border-primary/30 text-primary font-medium text-center animate-in fade-in">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
};
