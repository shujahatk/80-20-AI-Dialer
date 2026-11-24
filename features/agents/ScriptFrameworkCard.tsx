'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

interface ObjectionNode {
  id: string;
  trigger: string;
  response: string;
  color: string;
}

export const ScriptFrameworkCard: React.FC = () => {
  const [nodes, setNodes] = useState<ObjectionNode[]>([
    {
      id: 'node-1',
      trigger: '"Not interested" / "Busy"',
      response: 'Pivot: Acknowledge time constraint; ask for 20-second summary benchmark.',
      color: 'text-error',
    },
    {
      id: 'node-2',
      trigger: '"Using competitor / {{competitor}}"',
      response: "Counter: Highlight RM's verified 18% deadhead reduction over legacy routing.",
      color: 'text-primary',
    },
    {
      id: 'node-3',
      trigger: '"Just send info over email"',
      response: 'Action: Validate target email address and lock down 5-min briefing slot.',
      color: 'text-secondary',
    },
  ]);

  const [isAddingNode, setIsAddingNode] = useState(false);
  const [newTrigger, setNewTrigger] = useState('');
  const [newResponse, setNewResponse] = useState('');

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrigger.trim() || !newResponse.trim()) return;

    setNodes((prev) => [
      ...prev,
      {
        id: `node-${Date.now()}`,
        trigger: newTrigger.trim(),
        response: newResponse.trim(),
        color: 'text-primary',
      },
    ]);
    setNewTrigger('');
    setNewResponse('');
    setIsAddingNode(false);
  };
  return (
    <div className="rounded-xl bg-surface-container-low p-space-base flex flex-col gap-space-md shadow-sm border border-outline-variant/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <Icon name="schema" size={18} className="text-primary" />
          <h2 className="font-headline-md text-body-md text-on-surface uppercase tracking-wider font-semibold">
            Script Flow &amp; BANT Framework
          </h2>
        </div>
        <span className="font-label-caps text-label-caps px-space-xs py-space-2xs rounded bg-surface-container text-tertiary border border-tertiary/20">
          4 Active Phases
        </span>
      </div>

      <div className="flex flex-col gap-space-sm">
        {/* Phase 1: Opening Hook */}
        <div className="p-space-sm rounded-lg bg-surface-container flex flex-col gap-space-xs border border-outline-variant/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="w-5 h-5 rounded-full bg-primary-container text-on-primary-container font-label-caps text-label-caps flex items-center justify-center font-bold">
                1
              </span>
              <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                Opening Hook &amp; Disarming Permission
              </span>
            </div>
            <span className="font-label-caps text-label-caps text-tertiary">91% Pass Rate</span>
          </div>
          <div className="bg-surface-container-lowest p-space-sm rounded font-data-tabular text-body-sm text-on-surface border border-outline-variant/10">
            &quot;Hi <span className="text-primary font-semibold">{'{{first_name}}'}</span>, this is
            Rachel calling from RM Logistics Automation. I noticed{' '}
            <span className="text-primary font-semibold">{'{{company}}'}</span> operates roughly{' '}
            <span className="text-primary font-semibold">{'{{fleet_size}}'}</span> regional assets.
            Catching you at an okay minute, or are you mid-dispatch?&quot;
          </div>
        </div>

        {/* Phase 2: Qualification (BANT) */}
        <div className="p-space-sm rounded-lg bg-surface-container flex flex-col gap-space-xs border border-outline-variant/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="w-5 h-5 rounded-full bg-surface-container-high text-on-surface font-label-caps text-label-caps flex items-center justify-center font-bold border border-outline-variant/10">
                2
              </span>
              <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                Qualification Criteria (BANT Protocol)
              </span>
            </div>
            <span className="font-label-caps text-label-caps text-secondary font-medium">
              B2B Logistic Gates
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs pt-space-2xs font-body-sm text-body-sm">
            <div className="p-space-xs rounded bg-surface-container-low flex items-center gap-space-xs border border-outline-variant/10">
              <Icon name="check_circle" size={16} className="text-tertiary" />
              <span className="text-on-surface">Fleet Size &gt; 50 Trucks</span>
            </div>
            <div className="p-space-xs rounded bg-surface-container-low flex items-center gap-space-xs border border-outline-variant/10">
              <Icon name="check_circle" size={16} className="text-tertiary" />
              <span className="text-on-surface">Active TMS / ELD (Samsara/Motive)</span>
            </div>
          </div>
        </div>

        {/* Phase 3: Dynamic Objection Rules Matrix */}
        <div className="p-space-sm rounded-lg bg-surface-container flex flex-col gap-space-xs border border-outline-variant/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="w-5 h-5 rounded-full bg-surface-container-high text-on-surface font-label-caps text-label-caps flex items-center justify-center font-bold border border-outline-variant/10">
                3
              </span>
              <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                Dynamic Objection Handling Matrix ({nodes.length} Rules)
              </span>
            </div>
            <button
              onClick={() => setIsAddingNode((prev) => !prev)}
              className="text-primary font-label-caps text-label-caps hover:underline"
              type="button"
            >
              {isAddingNode ? 'Cancel' : '+ Add Node'}
            </button>
          </div>

          {isAddingNode && (
            <form onSubmit={handleAddNode} className="p-space-sm rounded bg-surface-container-lowest border border-primary/30 flex flex-col gap-2 animate-in fade-in">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">IF MATCH Pattern (Prospect Objection)</label>
                <input
                  type="text"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  placeholder='e.g. "Too expensive" / "Budget freeze"'
                  className="px-2.5 py-1.5 rounded bg-surface-elevated text-xs border border-border text-on-surface focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">AI Pivot / Counter Strategy</label>
                <input
                  type="text"
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  placeholder="e.g. Pivot: Clarify that initial pilot requires zero capital expenditure."
                  className="px-2.5 py-1.5 rounded bg-surface-elevated text-xs border border-border text-on-surface focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNode(false)}
                  className="px-2.5 py-1 text-xs rounded border border-border text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-xs rounded bg-primary text-on-primary font-semibold hover:bg-primary-hover"
                >
                  Save Node
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-col gap-space-2xs font-body-sm text-body-sm">
            {nodes.map((node) => (
              <div key={node.id} className="p-space-xs rounded bg-surface-container-lowest flex items-start justify-between gap-space-xs border border-outline-variant/10">
                <div className="flex flex-col">
                  <span className={`font-label-caps text-label-caps uppercase ${node.color}`}>
                    IF MATCH: {node.trigger}
                  </span>
                  <span className="text-on-surface text-body-sm">
                    {node.response}
                  </span>
                </div>
                <Icon name="alt_route" size={16} className="text-tertiary shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        </div>

        {/* Phase 4: Closing & Meeting Booking */}
        <div className="p-space-sm rounded-lg bg-surface-container flex flex-col gap-space-xs border border-outline-variant/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="w-5 h-5 rounded-full bg-surface-container-high text-on-surface font-label-caps text-label-caps flex items-center justify-center font-bold border border-outline-variant/10">
                4
              </span>
              <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                Calendar Integration &amp; Slot Lock
              </span>
            </div>
            <span className="font-label-caps text-label-caps text-primary">
              ChiliPiper API Ready
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Auto-detect prospect local timezone (CST) and present two exact timeslots within next 48h.
          </p>
        </div>
      </div>
    </div>
  );
};
