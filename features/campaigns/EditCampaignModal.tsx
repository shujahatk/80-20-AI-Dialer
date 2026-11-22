'use client';

import React, { useState, useEffect } from 'react';
import type { Campaign } from '@/types';
import { Icon } from '@/lib/ui/icons';

interface EditCampaignModalProps {
  isOpen: boolean;
  campaign: Campaign | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export const EditCampaignModal: React.FC<EditCampaignModalProps> = ({
  isOpen,
  campaign,
  onClose,
  onUpdated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [callingWindowStart, setCallingWindowStart] = useState('09:00');
  const [callingWindowEnd, setCallingWindowEnd] = useState('17:00');
  const [maxAttempts, setMaxAttempts] = useState('4');
  const [retryDelayMinutes, setRetryDelayMinutes] = useState('60');
  const [concurrencyLimit, setConcurrencyLimit] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (campaign) {
      setName(campaign.name);
      setDescription(campaign.description || '');
      setCallingWindowStart(campaign.callingWindowStart || '09:00');
      setCallingWindowEnd(campaign.callingWindowEnd || '17:00');
      setMaxAttempts(String(campaign.maxAttempts || 4));
      setRetryDelayMinutes(String(campaign.retryDelayMinutes || 60));
      setConcurrencyLimit(String(campaign.concurrentLines || 10));
      setErrorMessage(null);
    }
  }, [campaign]);

  if (!isOpen || !campaign) return null;

  const isRunning = campaign.status === 'running' || campaign.status === 'live';
  const isTerminal = campaign.status === 'completed' || campaign.status === 'cancelled';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please enter a campaign name');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        description: description.trim(),
        callingWindowStart,
        callingWindowEnd,
        retryDelayMinutes: parseInt(retryDelayMinutes, 10) || 60,
        concurrencyLimit: parseInt(concurrencyLimit, 10) || 10,
      };

      // Only allow modifying maxAttempts if NOT running
      if (!isRunning) {
        payload.maxAttemptsPerLead = parseInt(maxAttempts, 10) || 4;
      }

      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update campaign');
      }

      onUpdated?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while updating the campaign.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-container-lowest/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-surface-container-low rounded-2xl p-6 shadow-2xl border border-outline-variant/20 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
              <Icon name="edit" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Edit Campaign</h2>
              <p className="text-xs text-on-surface-variant">
                Status: <strong className="capitalize">{campaign.status}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            type="button"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {isRunning && (
          <div className="p-2.5 rounded-lg bg-secondary-container/20 border border-secondary/20 text-secondary text-xs flex items-center gap-2">
            <Icon name="info" size={16} />
            <span>
              This campaign is currently running. Core structural rules (max attempts, assigned agent) are locked. Pause campaign first to modify them.
            </span>
          </div>
        )}

        {isTerminal && (
          <div className="p-2.5 rounded-lg bg-error-container/20 border border-error/20 text-error text-xs flex items-center gap-2">
            <Icon name="lock" size={16} />
            <span>
              This campaign has ended and is read-only.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-error-container/30 border border-error/20 text-error text-xs flex items-center gap-2">
            <Icon name="error" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-on-surface">Campaign Name *</label>
            <input
              type="text"
              required
              disabled={isTerminal}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-surface-container text-on-surface rounded-lg px-3 py-2 border border-outline-variant/10 text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-on-surface">Description</label>
            <textarea
              rows={2}
              disabled={isTerminal}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-surface-container text-on-surface rounded-lg px-3 py-2 border border-outline-variant/10 text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-on-surface">Calling Window Start</label>
              <input
                type="time"
                disabled={isTerminal}
                value={callingWindowStart}
                onChange={(e) => setCallingWindowStart(e.target.value)}
                className="bg-surface-container text-on-surface rounded-lg px-2.5 py-1.5 border border-outline-variant/10 text-xs disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-on-surface">Calling Window End</label>
              <input
                type="time"
                disabled={isTerminal}
                value={callingWindowEnd}
                onChange={(e) => setCallingWindowEnd(e.target.value)}
                className="bg-surface-container text-on-surface rounded-lg px-2.5 py-1.5 border border-outline-variant/10 text-xs disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-on-surface">
                Max Attempts {isRunning && '(Locked while running)'}
              </label>
              <input
                type="number"
                min={1}
                max={10}
                disabled={isRunning || isTerminal}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                className="bg-surface-container text-on-surface rounded-lg px-2.5 py-1.5 border border-outline-variant/10 text-xs disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-on-surface">Retry Delay (Minutes)</label>
              <input
                type="number"
                min={5}
                max={2880}
                disabled={isTerminal}
                value={retryDelayMinutes}
                onChange={(e) => setRetryDelayMinutes(e.target.value)}
                className="bg-surface-container text-on-surface rounded-lg px-2.5 py-1.5 border border-outline-variant/10 text-xs disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors"
            >
              Cancel
            </button>
            {!isTerminal && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary text-xs font-bold shadow-sm transition-all"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
