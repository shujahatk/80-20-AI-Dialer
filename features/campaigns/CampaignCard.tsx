'use client';

import React from 'react';
import type { Campaign } from '@/types';
import { Icon } from '@/lib/ui/icons';

interface CampaignCardProps {
  campaign: Campaign;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onViewDetails?: () => void;
  onEdit?: () => void;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  onStart,
  onPause,
  onResume,
  onViewDetails,
  onEdit,
}) => {
  const isRunning = campaign.status === 'running' || campaign.status === 'live';
  const isPaused = campaign.status === 'paused';
  const isDraft = campaign.status === 'draft';
  const isScheduled = campaign.status === 'scheduled';
  const isCompleted = campaign.status === 'completed';
  const isCancelled = campaign.status === 'cancelled';

  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-semibold bg-success-surface text-success border border-success/20">
          Running
        </span>
      );
    }
    if (isPaused) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-semibold bg-warning-surface text-warning border border-warning/20">
          Paused
        </span>
      );
    }
    if (isScheduled) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-semibold bg-info-surface text-info border border-info/20">
          Scheduled
        </span>
      );
    }
    if (isCompleted) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-semibold bg-surface-secondary text-on-surface border border-border">
          Completed
        </span>
      );
    }
    if (isCancelled) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-semibold bg-error-surface text-error border border-error/20">
          Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-semibold bg-surface-secondary text-on-surface-variant border border-border">
        Draft
      </span>
    );
  };

  const calledCount = campaign.detailedMetrics?.attempted ?? campaign.completedLeads;
  const connectedCount = campaign.detailedMetrics?.connected ?? campaign.stats?.connectedPickups ?? 0;
  const qualifiedCount = campaign.detailedMetrics?.qualified ?? campaign.stats?.aiQualified ?? 0;
  const appointmentsCount = campaign.detailedMetrics?.appointments ?? campaign.stats?.bookedAppointments ?? 0;

  return (
    <div className="rm-card flex flex-col gap-4 p-5">
      {/* Header: Title, Status, Schedule */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold">
            <Icon name="campaign" size={22} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-[17px] font-bold text-on-surface">
                {campaign.name}
              </h3>
              {getStatusBadge()}
            </div>
            <span className="text-[13px] text-on-surface-variant">
              {campaign.description || 'Outbound calling campaign'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[13px] text-on-surface-variant bg-surface-secondary px-3 py-1.5 rounded-md border border-border">
          <Icon name="schedule" size={16} />
          <span>{campaign.scheduleWindow}</span>
        </div>
      </div>

      {/* Restrained Linear Progress Bar */}
      <div className="flex flex-col gap-1.5 bg-surface-secondary rounded-lg p-3.5 border border-border">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-on-surface font-semibold">
            Calling Progress
          </span>
          <span className="text-primary font-bold">
            {calledCount.toLocaleString()} / {campaign.leadCount.toLocaleString()} leads ({campaign.progressPercent}%)
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-surface-elevated overflow-hidden">
          <div
            className="h-full origin-left rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.min(100, campaign.progressPercent)}%` }}
          />
        </div>
      </div>

      {/* 5 Business Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center text-[13px]">
        <div className="p-3 rounded-lg bg-surface-secondary border border-border">
          <span className="text-on-surface-variant block mb-0.5 text-[12px]">Leads</span>
          <span className="text-[16px] font-bold text-on-surface">
            {campaign.leadCount.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-surface-secondary border border-border">
          <span className="text-on-surface-variant block mb-0.5 text-[12px]">Called</span>
          <span className="text-[16px] font-bold text-on-surface">
            {calledCount.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-surface-secondary border border-border">
          <span className="text-on-surface-variant block mb-0.5 text-[12px]">Connected</span>
          <span className="text-[16px] font-bold text-success">
            {connectedCount.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-surface-secondary border border-border">
          <span className="text-on-surface-variant block mb-0.5 text-[12px]">Qualified</span>
          <span className="text-[16px] font-bold text-primary">
            {qualifiedCount.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-surface-secondary border border-border col-span-2 sm:col-span-1">
          <span className="text-on-surface-variant block mb-0.5 text-[12px]">Appointments</span>
          <span className="text-[16px] font-bold text-success">
            {appointmentsCount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Footer: AI Persona & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border text-[13px]">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <Icon name="smart_toy" size={18} className="text-primary" />
          <span>Assigned Persona: <strong className="text-on-surface">{campaign.agentName}</strong></span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {(isDraft || isScheduled) && (
            <button
              onClick={onStart}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-primary hover:bg-primary-hover text-on-primary font-semibold transition-colors shadow-sm"
              type="button"
              title="Start calling campaign"
            >
              <Icon name="play_arrow" size={16} />
              <span>Start Campaign</span>
            </button>
          )}

          {isRunning && (
            <button
              onClick={onPause}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-surface text-on-surface hover:bg-surface-secondary font-semibold transition-colors border border-border"
              type="button"
              title="Pause campaign"
            >
              <Icon name="pause" size={16} />
              <span>Pause</span>
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResume}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-primary text-on-primary hover:bg-primary-hover font-semibold transition-colors shadow-sm"
              type="button"
              title="Resume campaign"
            >
              <Icon name="play_arrow" size={16} />
              <span>Resume</span>
            </button>
          )}

          {!isCompleted && !isCancelled && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface hover:bg-surface-secondary text-on-surface font-medium transition-colors border border-border"
              type="button"
              title="Edit campaign settings"
            >
              <Icon name="edit" size={16} />
              <span>Edit</span>
            </button>
          )}

          <button
            onClick={onViewDetails}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-surface-secondary text-on-surface hover:bg-surface-elevated font-semibold transition-colors border border-border"
            type="button"
            title="View campaign details"
          >
            <span>View Leads</span>
            <Icon name="arrow_forward" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
