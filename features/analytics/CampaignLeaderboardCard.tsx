import React from 'react';
import { mockCampaignLeaderboard } from '@/lib/mock/analytics';
import { Icon } from '@/lib/ui/icons';

export function CampaignLeaderboardCard() {
  const campaigns = mockCampaignLeaderboard;

  return (
    <div className="bg-surface p-6 rounded-xl shadow-sm flex flex-col gap-4 border border-border">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Icon name="leaderboard" size={20} className="text-primary" />
            <h2 className="text-[16px] font-bold text-on-surface">Campaign Performance</h2>
          </div>
          <span className="text-[13px] text-on-surface-variant">Performance comparison across active campaigns</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {campaigns.map((camp) => (
          <div
            key={camp.rank}
            className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated hover:bg-surface-secondary transition-colors border border-border"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded text-[13px] font-bold flex items-center justify-center ${
                  camp.rank === 1
                    ? 'bg-primary text-on-primary'
                    : camp.rank === 2
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface-secondary text-on-surface'
                }`}
              >
                {camp.rank}
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] text-on-surface font-semibold">{camp.name}</span>
                <span className="text-[12px] text-on-surface-variant">{camp.desc}</span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`text-[15px] font-bold ${
                  camp.rank === 1 ? 'text-success' : camp.rank === 2 ? 'text-primary' : 'text-on-surface'
                }`}
              >
                {camp.conversionRate}
              </span>
              <span className="block text-[12px] text-on-surface-variant">
                {camp.bookedCount.toLocaleString()} Booked
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
