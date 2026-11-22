import React from 'react';
import Link from 'next/link';
import { ChartFrame } from '@/components/ui/chart-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';

interface AgentItem {
  id: string;
  name: string;
  role: string;
  status: string;
}

interface AgentLeaderboardProps {
  agents?: AgentItem[];
}

export const AgentLeaderboard: React.FC<AgentLeaderboardProps> = ({ agents = [] }) => {
  return (
    <ChartFrame
      title="AI agents"
      description="Published and draft personas"
      action={
        <Link href="/agents" className="text-[12.5px] font-semibold text-primary hover:underline">
          Open studio
        </Link>
      }
    >
      {agents.length === 0 ? (
        <EmptyState icon="smart_toy" title="No agents yet" description="Create an AI agent in Agent Studio." />
      ) : (
        <div className="flex flex-col gap-2">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-[12px] font-bold text-primary-foreground">
                  {agent.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold text-on-surface">{agent.name}</div>
                  <div className="truncate text-[12px] text-on-surface-variant">{agent.role}</div>
                </div>
              </div>
              <Badge tone={agent.status === 'published' || agent.status === 'active' ? 'success' : 'neutral'}>
                {agent.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </ChartFrame>
  );
};
