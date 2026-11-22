import React from 'react';
import { Icon } from '@/lib/ui/icons';

export const ScriptFrameworkCard: React.FC = () => {
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
                Dynamic Objection Handling Matrix
              </span>
            </div>
            <button
              onClick={() => alert('Add node to objection decision tree')}
              className="text-primary font-label-caps text-label-caps hover:underline"
              type="button"
            >
              + Add Node
            </button>
          </div>

          <div className="flex flex-col gap-space-2xs font-body-sm text-body-sm">
            <div className="p-space-xs rounded bg-surface-container-lowest flex items-start justify-between gap-space-xs border border-outline-variant/10">
              <div className="flex flex-col">
                <span className="font-label-caps text-label-caps text-error uppercase">
                  IF MATCH: &quot;Not interested&quot; / &quot;Busy&quot;
                </span>
                <span className="text-on-surface text-body-sm">
                  Pivot: Acknowledge time constraint; ask for 20-second summary benchmark.
                </span>
              </div>
              <Icon name="alt_route" size={16} className="text-tertiary" />
            </div>

            <div className="p-space-xs rounded bg-surface-container-lowest flex items-start justify-between gap-space-xs border border-outline-variant/10">
              <div className="flex flex-col">
                <span className="font-label-caps text-label-caps text-primary uppercase">
                  IF MATCH: &quot;Using competitor / {'{{competitor}}'}&quot;
                </span>
                <span className="text-on-surface text-body-sm">
                  Counter: Highlight RM&apos;s verified 18% deadhead reduction over legacy routing.
                </span>
              </div>
              <Icon name="alt_route" size={16} className="text-tertiary" />
            </div>

            <div className="p-space-xs rounded bg-surface-container-lowest flex items-start justify-between gap-space-xs border border-outline-variant/10">
              <div className="flex flex-col">
                <span className="font-label-caps text-label-caps text-secondary uppercase">
                  IF MATCH: &quot;Just send info over email&quot;
                </span>
                <span className="text-on-surface text-body-sm">
                  Action: Validate target email address and lock down 5-min briefing slot.
                </span>
              </div>
              <Icon name="alt_route" size={16} className="text-tertiary" />
            </div>
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
