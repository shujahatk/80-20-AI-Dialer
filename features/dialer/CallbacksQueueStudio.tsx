import React from 'react';
import Link from 'next/link';
import { Icon } from '@/lib/ui/icons';

interface PendingCallbackItem {
  id: string;
  leadName: string;
  company: string;
  phone: string;
  scheduledTime: string;
  countdown: string;
  notes: string;
}

const mockPendingCallbacksList: PendingCallbackItem[] = [
  {
    id: 'cb_1',
    leadName: 'Michael Scott',
    company: 'Scranton Paper Tech',
    phone: '+1 (415) 555-0192',
    scheduledTime: '2:00 PM EST',
    countdown: '14 mins',
    notes: 'Call after board meeting, interested in enterprise raw materials pricing tier.',
  },
  {
    id: 'cb_2',
    leadName: 'Sarah Connor',
    company: 'Cyberdyne Systems',
    phone: '+1 (212) 555-0144',
    scheduledTime: '2:30 PM EST',
    countdown: '44 mins',
    notes: 'Requested technical compliance docs verification and security architecture review.',
  },
  {
    id: 'cb_3',
    leadName: 'Liam Davies',
    company: 'Vertex Materials',
    phone: '+44 20 7946 0912',
    scheduledTime: '3:30 PM GMT',
    countdown: '1 hr 44 mins',
    notes: 'Follow-up on volume contract duration and multi-warehouse logistics SLA.',
  },
  {
    id: 'cb_4',
    leadName: 'Evelyn Vance',
    company: 'Apex Freightways',
    phone: '+1 (206) 555-0199',
    scheduledTime: '4:15 PM PST',
    countdown: '2 hrs 29 mins',
    notes: 'Prospect confirmed interest in autonomous AI dispatch routing bridge.',
  },
];

export const CallbacksQueueStudio: React.FC = () => {
  return (
    <div className="flex flex-col w-full bg-background min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-[1400px] w-full mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex flex-col gap-1">
            <Link
              href="/workstation"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
            >
              <Icon name="arrow_back" size={16} />
              <span>Back to Active Workstation</span>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2.5">
              <Icon name="schedule" size={26} className="text-warning" />
              <span>Pending Callbacks Queue</span>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
                {mockPendingCallbacksList.length} Scheduled Due
              </span>
            </h1>
            <p className="text-sm text-on-surface-variant">
              High-priority callbacks scheduled by AI voice agents or requested by prospects.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/workstation"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover shadow-sm flex items-center gap-2"
            >
              <Icon name="phone" size={16} />
              <span>Open Dialer Cockpit</span>
            </Link>
          </div>
        </div>

        {/* Callbacks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockPendingCallbacksList.map((cb: PendingCallbackItem) => (
            <div
              key={cb.id}
              className="p-5 rounded-xl bg-surface border border-border flex flex-col justify-between gap-4 shadow-sm hover:border-primary/50 transition-colors"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/30">
                    {cb.scheduledTime}
                  </span>
                  <span className="text-xs text-on-surface-variant font-mono">
                    Due in {cb.countdown}
                  </span>
                </div>

                <div className="mt-1">
                  <h3 className="text-base font-bold text-on-surface">{cb.leadName}</h3>
                  <p className="text-xs text-on-surface-variant">{cb.company}</p>
                </div>

                <div className="p-3 rounded-lg bg-surface-elevated border border-border text-xs text-on-surface-variant italic">
                  "{cb.notes}"
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="font-mono text-xs font-semibold text-on-surface">
                  {cb.phone}
                </span>
                <Link
                  href={`/workstation?dial=${encodeURIComponent(cb.phone)}`}
                  className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:bg-primary-hover flex items-center gap-1.5 shadow-xs"
                >
                  <Icon name="phone" size={14} />
                  <span>Call Now</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
