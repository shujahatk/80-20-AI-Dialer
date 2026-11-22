'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

export function GeneralSettingsPanel() {
  const [orgName, setOrgName] = useState('RM Global Materials & Logistics');
  const [workspaceSlug, setWorkspaceSlug] = useState('rm-materials-eu');
  const [primaryTimezone, setPrimaryTimezone] = useState('Europe/Brussels (CET - UTC+1)');
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('production');
  const [supportEmail, setSupportEmail] = useState('ops-alerts@rm-materials.com');

  return (
    <div className="flex flex-col gap-6">
      {/* Workspace Identity */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="business" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Organization & Workspace Identity</h2>
              <p className="text-xs text-on-surface-variant">
                Core identity settings for your multi-tenant calling instance.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-semibold border border-success/20">
            Enterprise Verified
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Organization Legal Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Workspace Slug</label>
            <div className="flex items-center rounded-lg bg-surface-elevated border border-border px-3.5 py-2.5 text-sm">
              <span className="text-on-surface-variant font-mono text-xs select-none">app.rmdialer.com/</span>
              <input
                type="text"
                value={workspaceSlug}
                onChange={(e) => setWorkspaceSlug(e.target.value)}
                className="bg-transparent border-none text-on-surface font-mono text-xs focus:outline-none flex-1 ml-1"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Primary Operations Timezone</label>
            <select
              value={primaryTimezone}
              onChange={(e) => setPrimaryTimezone(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="Europe/Brussels (CET - UTC+1)">Europe/Brussels (CET - UTC+1)</option>
              <option value="America/New_York (EST - UTC-5)">America/New_York (EST - UTC-5)</option>
              <option value="America/Chicago (CST - UTC-6)">America/Chicago (CST - UTC-6)</option>
              <option value="America/Los_Angeles (PST - UTC-8)">America/Los_Angeles (PST - UTC-8)</option>
              <option value="Europe/London (GMT - UTC+0)">Europe/London (GMT - UTC+0)</option>
              <option value="Asia/Singapore (SGT - UTC+8)">Asia/Singapore (SGT - UTC+8)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Operations Escalation Alert Email</label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Deployment Mode & Environment */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="dns" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Telephony Deployment Environment</h2>
              <p className="text-xs text-on-surface-variant">
                Select between live SIP production routing and safe test sandbox.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => setEnvironment('production')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${
              environment === 'production'
                ? 'border-primary bg-surface-elevated shadow-sm'
                : 'border-border bg-surface hover:border-border-strong'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <span className="text-sm font-bold text-on-surface">Live Production Mode</span>
              </div>
              <span className="font-mono text-xs font-bold text-success px-2 py-0.5 rounded bg-success/15">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Live Twilio voice trunks with Retell AI real-time audio bridge and real PSTN dialing.
            </p>
          </div>

          <div
            onClick={() => setEnvironment('sandbox')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${
              environment === 'sandbox'
                ? 'border-primary bg-surface-elevated shadow-sm'
                : 'border-border bg-surface hover:border-border-strong'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-warning" />
                <span className="text-sm font-bold text-on-surface">Enterprise Sandbox Simulator</span>
              </div>
              <span className="font-mono text-xs font-bold text-warning px-2 py-0.5 rounded bg-warning/15">
                SAFE
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Zero-cost simulated call loops with mock prospects for agent training and QA.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
