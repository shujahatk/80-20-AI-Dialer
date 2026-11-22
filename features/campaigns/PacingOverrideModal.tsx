'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

interface PacingOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (channels: number) => void;
}

export const PacingOverrideModal: React.FC<PacingOverrideModalProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const [channels, setChannels] = useState(50);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply?.(channels);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      id="pacing-drawer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-w-xl w-full bg-surface rounded-xl p-6 flex flex-col gap-4 shadow-xl relative border border-border animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary text-on-primary">
              <Icon name="tune" size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[17px] font-bold text-on-surface">
                Outbound Calling Pacing
              </span>
              <span className="text-[13px] text-on-surface-variant">
                Adjust concurrent channel allocation
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-secondary text-on-surface-variant hover:text-on-surface transition-colors"
            id="close-drawer-btn"
            type="button"
            aria-label="Close dialog"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2 bg-surface-elevated p-4 rounded-xl border border-border">
            <div className="flex justify-between items-center">
              <span className="text-[14px] font-semibold text-on-surface">
                Maximum Concurrent Lines
              </span>
              <span
                className="text-[20px] font-bold text-primary"
                id="drawer-channel-val"
              >
                {channels} Lines
              </span>
            </div>
            <input
              className="w-full accent-primary h-2 bg-surface-secondary rounded-lg cursor-pointer"
              id="drawer-channel-slider"
              max="100"
              min="5"
              step="5"
              type="range"
              value={channels}
              onChange={(e) => setChannels(Number(e.target.value))}
              aria-label="Max outbound concurrent channels"
            />
            <div className="flex justify-between text-on-surface-variant text-[12px] pt-1">
              <span>Min: 5 Lines</span>
              <span>Current Allocation: 28</span>
              <span>Max: 100 Lines</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-on-surface-variant uppercase">
                Voice Detection Response
              </label>
              <div className="flex items-center justify-between p-2.5 bg-surface-elevated rounded-lg border border-border">
                <span className="text-[14px] text-on-surface">
                  450 ms
                </span>
                <span className="text-[11px] font-semibold text-success bg-success-surface px-2 py-0.5 rounded">Optimal</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-on-surface-variant uppercase">
                Answering Machine Detection
              </label>
              <div className="flex items-center justify-between p-2.5 bg-surface-elevated rounded-lg border border-border">
                <span className="text-[14px] text-on-surface">
                  Standard Voice Filter
                </span>
                <span className="text-[11px] font-semibold text-primary bg-surface-secondary px-2 py-0.5 rounded">Enabled</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface text-on-surface text-[14px] font-medium border border-border hover:bg-surface-secondary transition-colors"
            id="cancel-pacing-btn"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-[14px] font-semibold hover:bg-primary-hover transition-colors shadow-sm"
            id="save-pacing-btn"
            type="button"
          >
            Save Pacing Settings
          </button>
        </div>
      </div>
    </div>
  );
};
